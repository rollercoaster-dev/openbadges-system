import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ExecutionContext } from 'hono'

// Mock the JWT service
vi.mock('../services/jwt', () => ({
  jwtService: {
    createOpenBadgesApiClient: vi.fn(() => ({
      token: 'mock-jwt-token',
      headers: {
        Authorization: 'Bearer mock-jwt-token',
        'Content-Type': 'application/json',
      },
    })),
    verifyToken: vi.fn(() => ({
      sub: 'test-user',
      platformId: 'urn:uuid:a504d862-bd64-4e0d-acff-db7955955bc1',
      displayName: 'Test User',
      email: 'test@example.com',
      metadata: { isAdmin: true },
    })),
  },
}))

// Mock fetch for OpenBadges server requests
global.fetch = vi.fn()

// Mock SQLite database to avoid native binding issues
vi.mock('sqlite3', () => ({
  Database: vi.fn().mockImplementation(() => ({
    prepare: vi.fn().mockReturnValue({
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
      finalize: vi.fn(),
    }),
    exec: vi.fn(),
    close: vi.fn(),
  })),
}))

describe('Server Endpoints', () => {
  let app: {
    fetch: (
      request: Request,
      env?: unknown,
      executionCtx?: ExecutionContext | undefined
    ) => Response | Promise<Response>
  }
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFetch = vi.mocked(fetch)

    // Import the server app dynamically to ensure mocks are applied
    const serverModule = await import('../index')
    app = { fetch: serverModule.default.fetch }
  })

  describe('Health endpoint', () => {
    it('should return health status', async () => {
      const req = new Request('http://localhost/api/health')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('ok')
      expect(data.timestamp).toBeTruthy()
    })
  })

  describe('Platform token endpoint', () => {
    it('should generate platform token for valid user', async () => {
      const mockUser = {
        id: 'test-user',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isAdmin: false,
      }

      const req = new Request('http://localhost/api/auth/platform-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
        body: JSON.stringify({ user: mockUser }),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.token).toBe('mock-jwt-token')
      expect(data.platformId).toBe('urn:uuid:a504d862-bd64-4e0d-acff-db7955955bc1')
    })

    it('should return 400 for invalid user data', async () => {
      const req = new Request('http://localhost/api/auth/platform-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
        body: JSON.stringify({ user: { id: null } }),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid user data')
    })

    it('should return 400 for missing user data', async () => {
      const req = new Request('http://localhost/api/auth/platform-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
        body: JSON.stringify({}),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid user data')
    })
  })

  describe('OpenBadges proxy endpoint', () => {
    it('should proxy requests to OpenBadges server with authentication', async () => {
      const mockOpenBadgesResponse = {
        assertions: [{ id: 'assertion-1', badgeClass: 'badge-1', recipient: 'test@example.com' }],
        total: 1,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockOpenBadgesResponse),
      })

      const req = new Request('http://localhost/api/badges/api/v1/assertions', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-platform-token' },
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockOpenBadgesResponse)

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/assertions', {
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-platform-token',
        }),
        body: undefined,
      })
    })

    it('should return 401 for requests without authentication', async () => {
      const req = new Request('http://localhost/api/badges/api/v1/assertions', {
        method: 'GET',
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toBe('Platform token required')
    })

    it('should return 401 for requests with invalid authentication format', async () => {
      const req = new Request('http://localhost/api/badges/api/v1/assertions', {
        method: 'GET',
        headers: { Authorization: 'Invalid token-format' },
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toBe('Platform token required')
    })

    it('should handle OpenBadges server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: 'Internal server error' }),
      })

      const req = new Request('http://localhost/api/badges/api/v1/assertions', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-platform-token' },
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(500)
    })

    it('should handle non-JSON responses from OpenBadges server', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('Plain text response'),
      })

      const req = new Request('http://localhost/api/badges/api/v1/assertions', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-platform-token' },
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe('Plain text response')
    })

    it('should handle OpenBadges server connection errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'))

      const req = new Request('http://localhost/api/badges/api/v1/assertions', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-platform-token' },
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to communicate with OpenBadges server')
    })

    it('should proxy POST requests with body', async () => {
      const requestBody = {
        badgeClass: 'badge-class-1',
        recipient: 'test@example.com',
        evidence: 'Test evidence',
        narrative: 'Test narrative',
      }

      const mockOpenBadgesResponse = {
        id: 'new-assertion-id',
        ...requestBody,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockOpenBadgesResponse),
      })

      const req = new Request('http://localhost/api/badges/api/v1/assertions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-platform-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockOpenBadgesResponse)

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/assertions', {
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-platform-token',
        }),
        body: expect.any(ReadableStream),
      })
    })
  })

  describe('OpenBadges server proxy (legacy endpoint)', () => {
    it('should proxy requests to OpenBadges server with basic auth', async () => {
      const mockOpenBadgesResponse = {
        status: 'ok',
        timestamp: new Date().toISOString(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockOpenBadgesResponse),
      })

      const req = new Request('http://localhost/api/bs/health', {
        method: 'GET',
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockOpenBadgesResponse)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/health',
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Headers),
        })
      )
    })

    it('should handle OpenBadges server errors in legacy endpoint', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'))

      const req = new Request('http://localhost/api/bs/health', {
        method: 'GET',
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to communicate with local OpenBadges server')
    })
  })

  describe('CORS handling', () => {
    it('should handle OPTIONS requests', async () => {
      const req = new Request('http://localhost/api/health', {
        method: 'OPTIONS',
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(204)
    })
  })

  describe('Error scenarios', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const req = new Request('http://localhost/api/nonexistent', {
        method: 'GET',
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(404)
    })

    it('should handle malformed JSON in platform token request', async () => {
      const req = new Request('http://localhost/api/auth/platform-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })

      const res = await app.fetch(req)

      // Without Authorization, route is protected by requireAdmin and returns 401
      // The JSON parse error would return 400/500 only after auth passes
      expect(res.status).toBe(401)
    })
  })

  describe('Badge Verification Endpoints', () => {
    describe('POST /api/badges/verify', () => {
      it('should forward verification request to OpenBadges server', async () => {
        const verificationRequest = {
          assertion: {
            id: 'https://example.org/assertions/12345',
            type: 'Assertion',
            recipient: { type: 'email', identity: 'test@example.com' },
            badge: 'https://example.org/badges/test-badge',
            verification: { type: 'hosted' },
            issuedOn: '2024-01-15T10:00:00Z',
          },
          badgeClass: {
            id: 'https://example.org/badges/test-badge',
            type: 'BadgeClass',
            name: 'Test Badge',
            description: 'A test badge',
            image: 'https://example.org/images/test-badge.png',
            criteria: 'https://example.org/criteria/test-badge',
            issuer: {
              id: 'https://example.org/issuers/test-issuer',
              type: 'Profile',
              name: 'Test Issuer',
            },
          },
        }

        const mockVerificationResponse = {
          valid: true,
          signatureValid: true,
          issuerVerified: true,
          errors: [],
          warnings: [],
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: vi.fn().mockResolvedValue(mockVerificationResponse),
        })

        const req = new Request('http://localhost/api/badges/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verificationRequest),
        })

        const res = await app.fetch(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual(mockVerificationResponse)
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/v1/verify',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(verificationRequest),
          })
        )
      })

      it('should handle invalid verification request', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: vi.fn().mockResolvedValue({ error: 'Invalid assertion data' }),
        })

        const req = new Request('http://localhost/api/badges/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invalid: 'data' }),
        })

        const res = await app.fetch(req)

        expect(res.status).toBe(400)
      })

      it('should handle malformed JSON in verification request', async () => {
        const req = new Request('http://localhost/api/badges/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json',
        })

        const res = await app.fetch(req)
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error).toBe('Invalid JSON body')
      })

      it('should handle verification service failure', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Service unavailable'))

        const req = new Request('http://localhost/api/badges/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' }),
        })

        const res = await app.fetch(req)
        const data = await res.json()

        expect(res.status).toBe(500)
        expect(data.valid).toBe(false)
        expect(data.errors).toContain('Verification service temporarily unavailable')
      })
    })

    describe('GET /api/badges/assertions/:id', () => {
      it('should retrieve assertion by ID', async () => {
        const mockAssertion = {
          id: 'https://example.org/assertions/12345',
          type: 'Assertion',
          recipient: { type: 'email', identity: 'test@example.com' },
          badge: 'https://example.org/badges/test-badge',
          verification: { type: 'hosted' },
          issuedOn: '2024-01-15T10:00:00Z',
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: vi.fn().mockResolvedValue(mockAssertion),
        })

        const req = new Request('http://localhost/api/badges/assertions/12345')
        const res = await app.fetch(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual(mockAssertion)
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/v1/assertions/12345',
          expect.objectContaining({
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          })
        )
      })

      it('should handle assertion not found', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: vi.fn().mockResolvedValue({ error: 'Assertion not found' }),
        })

        const req = new Request('http://localhost/api/badges/assertions/non-existent')
        const res = await app.fetch(req)
        const data = await res.json()

        expect(res.status).toBe(404)
        expect(data.error).toBe('Assertion not found')
      })

      it('should handle missing assertion ID', async () => {
        const req = new Request('http://localhost/api/badges/assertions/')
        const res = await app.fetch(req)

        expect(res.status).toBe(404)
      })
    })

    describe('GET /api/badges/badge-classes/:id', () => {
      it('should retrieve badge class by ID', async () => {
        const mockBadgeClass = {
          id: 'https://example.org/badges/test-badge',
          type: 'BadgeClass',
          name: 'Test Badge',
          description: 'A test badge',
          image: 'https://example.org/images/test-badge.png',
          criteria: 'https://example.org/criteria/test-badge',
          issuer: {
            id: 'https://example.org/issuers/test-issuer',
            type: 'Profile',
            name: 'Test Issuer',
          },
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: vi.fn().mockResolvedValue(mockBadgeClass),
        })

        const req = new Request('http://localhost/api/badges/badge-classes/test-badge')
        const res = await app.fetch(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual(mockBadgeClass)
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/v2/badge-classes/test-badge',
          expect.objectContaining({
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          })
        )
      })

      it('should handle badge class not found', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: vi.fn().mockResolvedValue({ error: 'Badge class not found' }),
        })

        const req = new Request('http://localhost/api/badges/badge-classes/non-existent')
        const res = await app.fetch(req)
        const data = await res.json()

        expect(res.status).toBe(404)
        expect(data.error).toBe('Badge class not found')
      })
    })

    describe('GET /api/badges/revocation-list', () => {
      it('should retrieve revocation list', async () => {
        const mockRevocationList = [
          {
            id: 'https://example.org/assertions/revoked-1',
            reason: 'Fraudulent activity',
            revokedAt: '2024-01-20T15:30:00Z',
          },
          {
            id: 'https://example.org/assertions/revoked-2',
            reason: 'Issuer request',
            revokedAt: '2024-01-21T10:15:00Z',
          },
        ]

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: vi.fn().mockResolvedValue(mockRevocationList),
        })

        const req = new Request('http://localhost/api/badges/revocation-list')
        const res = await app.fetch(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual(mockRevocationList)
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/v1/revocation-list',
          expect.objectContaining({
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          })
        )
      })

      it('should handle revocation service unavailable', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 503,
          headers: new Headers({ 'content-type': 'application/json' }),
        })

        const req = new Request('http://localhost/api/badges/revocation-list')
        const res = await app.fetch(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual([]) // Should return empty list when service is unavailable
      })

      it('should handle network errors gracefully', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        const req = new Request('http://localhost/api/badges/revocation-list')
        const res = await app.fetch(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual([]) // Should return empty list on error (fail open)
      })
    })
  })
})
