import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// Mock the JWT service
vi.mock('../services/jwt', () => ({
  jwtService: {
    createOpenBadgesApiClient: vi.fn(() => ({
      token: 'mock-jwt-token',
      headers: {
        'Authorization': 'Bearer mock-jwt-token',
        'Content-Type': 'application/json'
      }
    }))
  }
}))

// Mock fetch for OpenBadges server requests
global.fetch = vi.fn()

describe('Server Endpoints', () => {
  let app: any
  let mockFetch: any

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
        isAdmin: false
      }

      const req = new Request('http://localhost/api/auth/platform-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: mockUser })
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: { id: null } })
      })

      const res = await app.fetch(req)
      
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid user data')
    })

    it('should return 400 for missing user data', async () => {
      const req = new Request('http://localhost/api/auth/platform-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
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
        assertions: [
          { id: 'assertion-1', badgeClass: 'badge-1', recipient: 'test@example.com' }
        ],
        total: 1
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockOpenBadgesResponse)
      })

      const req = new Request('http://localhost/api/badges/api/v1/assertions', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer test-platform-token' }
      })

      const res = await app.fetch(req)
      
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockOpenBadgesResponse)
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/assertions',
        {
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-platform-token'
          }),
          body: undefined
        }
      )
    })

    it('should return 401 for requests without authentication', async () => {
      const req = new Request('http://localhost/api/badges/api/v1/assertions', {
        method: 'GET'
      })

      const res = await app.fetch(req)
      
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toBe('Platform token required')
    })

    it('should return 401 for requests with invalid authentication format', async () => {
      const req = new Request('http://localhost/api/badges/api/v1/assertions', {
        method: 'GET',
        headers: { 'Authorization': 'Invalid token-format' }
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
        json: () => Promise.resolve({ error: 'Internal server error' })
      })

      const req = new Request('http://localhost/api/badges/api/v1/assertions', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer test-platform-token' }
      })

      const res = await app.fetch(req)
      
      expect(res.status).toBe(500)
    })

    it('should handle non-JSON responses from OpenBadges server', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('Plain text response')
      })

      const req = new Request('http://localhost/api/badges/api/v1/assertions', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer test-platform-token' }
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
        headers: { 'Authorization': 'Bearer test-platform-token' }
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
        narrative: 'Test narrative'
      }

      const mockOpenBadgesResponse = {
        id: 'new-assertion-id',
        ...requestBody
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockOpenBadgesResponse)
      })

      const req = new Request('http://localhost/api/badges/api/v1/assertions', {
        method: 'POST',
        headers: { 
          'Authorization': 'Bearer test-platform-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const res = await app.fetch(req)
      
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockOpenBadgesResponse)
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/assertions',
        {
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-platform-token'
          }),
          body: expect.any(ReadableStream)
        }
      )
    })
  })

  describe('OpenBadges server proxy (legacy endpoint)', () => {
    it('should proxy requests to OpenBadges server with basic auth', async () => {
      const mockOpenBadgesResponse = {
        status: 'ok',
        timestamp: new Date().toISOString()
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockOpenBadgesResponse)
      })

      const req = new Request('http://localhost/api/bs/health', {
        method: 'GET'
      })

      const res = await app.fetch(req)
      
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(mockOpenBadgesResponse)
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/health',
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Headers)
        })
      )
    })

    it('should handle OpenBadges server errors in legacy endpoint', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'))

      const req = new Request('http://localhost/api/bs/health', {
        method: 'GET'
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
        method: 'OPTIONS'
      })

      const res = await app.fetch(req)
      
      expect(res.status).toBe(204)
    })
  })

  describe('Error scenarios', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const req = new Request('http://localhost/api/nonexistent', {
        method: 'GET'
      })

      const res = await app.fetch(req)
      
      expect(res.status).toBe(404)
    })

    it('should handle malformed JSON in platform token request', async () => {
      const req = new Request('http://localhost/api/auth/platform-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      })

      const res = await app.fetch(req)
      
      expect(res.status).toBe(500)
    })
  })
})