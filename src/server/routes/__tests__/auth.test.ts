import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { authRoutes } from '../auth'
import { jwtService } from '../../services/jwt'
import { userService } from '../../services/user'
import { userSyncService } from '../../services/userSync'

// Mock the services
vi.mock('../../services/jwt', () => ({
  jwtService: {
    verifyToken: vi.fn(),
    createOpenBadgesApiClient: vi.fn(),
    generatePlatformToken: vi.fn(),
  },
}))

vi.mock('../../services/user', () => ({
  userService: {
    getUserById: vi.fn(),
    getOAuthProvidersByUser: vi.fn(),
  },
}))

vi.mock('../../services/userSync', () => ({
  userSyncService: {
    syncUser: vi.fn(),
    getBadgeServerUserProfile: vi.fn(),
  },
}))

// Mock the auth middleware
vi.mock('../../middleware/auth', () => ({
  requireAuth: vi.fn((c, next) => next()),
  requireAdmin: vi.fn((c, next) => next()),
  requireSelfOrAdminFromParam: vi.fn(() => (c, next) => next()),
}))

describe('Auth Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/auth', authRoutes)
    vi.clearAllMocks()
  })

  // Get the mocked services
  const mockJwtService = vi.mocked(jwtService)
  const mockUserService = vi.mocked(userService)
  const mockUserSyncService = vi.mocked(userSyncService)

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /auth/validate', () => {
    it('should validate a valid JWT token', async () => {
      const mockPayload = {
        sub: 'user-id',
        email: 'user@example.com',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600,
      }

      mockJwtService.verifyToken.mockReturnValue(mockPayload)

      const req = new Request('http://localhost/auth/validate', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.payload).toEqual(mockPayload)
      expect(mockJwtService.verifyToken).toHaveBeenCalledWith('valid-token')
    })

    it('should return 401 for missing authorization header', async () => {
      const req = new Request('http://localhost/auth/validate')
      const res = await app.fetch(req)

      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing token')
    })

    it('should return 401 for invalid authorization header format', async () => {
      const req = new Request('http://localhost/auth/validate', {
        headers: {
          Authorization: 'Invalid format',
        },
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing token')
    })

    it('should return 401 for invalid token', async () => {
      mockJwtService.verifyToken.mockReturnValue(null)

      const req = new Request('http://localhost/auth/validate', {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid token')
    })

    it('should return 500 on service error', async () => {
      mockJwtService.verifyToken.mockImplementation(() => {
        throw new Error('Service error')
      })

      const req = new Request('http://localhost/auth/validate', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Validation error')
    })
  })

  describe('POST /auth/platform-token', () => {
    it('should generate platform token for valid user data', async () => {
      const userData = {
        user: {
          id: 'user-123',
          email: 'user@example.com',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          isAdmin: false,
        },
      }

      const mockApiClient = {
        token: 'mock-platform-token',
        headers: {
          Authorization: 'Bearer mock-platform-token',
          'Content-Type': 'application/json',
        },
      }

      mockJwtService.createOpenBadgesApiClient.mockReturnValue(mockApiClient)

      const req = new Request('http://localhost/auth/platform-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.token).toBe('mock-platform-token')
      expect(data.platformId).toBe('urn:uuid:a504d862-bd64-4e0d-acff-db7955955bc1')
      expect(mockJwtService.createOpenBadgesApiClient).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'user@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        isAdmin: false,
      })
    })

    it('should handle optional user fields with defaults', async () => {
      const userData = {
        user: {
          id: 'user-123',
          email: 'user@example.com',
        },
      }

      const mockApiClient = {
        token: 'mock-platform-token',
        headers: {
          Authorization: 'Bearer mock-platform-token',
          'Content-Type': 'application/json',
        },
      }

      mockJwtService.createOpenBadgesApiClient.mockReturnValue(mockApiClient)

      const req = new Request('http://localhost/auth/platform-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(mockJwtService.createOpenBadgesApiClient).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'user@example.com',
        username: '',
        firstName: '',
        lastName: '',
        isAdmin: false,
      })
    })

    it('should return 400 for invalid user data', async () => {
      const invalidData = {
        user: {
          id: '', // Empty ID
          email: 'invalid-email', // Invalid email
        },
      }

      const req = new Request('http://localhost/auth/platform-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid user data')
    })

    it('should return 400 for malformed JSON', async () => {
      const req = new Request('http://localhost/auth/platform-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid JSON body')
    })

    it('should return 500 on service error', async () => {
      const userData = {
        user: {
          id: 'user-123',
          email: 'user@example.com',
        },
      }

      mockJwtService.createOpenBadgesApiClient.mockImplementation(() => {
        throw new Error('Service error')
      })

      const req = new Request('http://localhost/auth/platform-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to generate platform token')
    })
  })

  describe('POST /auth/oauth-token', () => {
    it('should return OAuth access token for valid user', async () => {
      const requestData = { userId: 'user-123' }
      const mockProviders = [
        {
          id: 'provider-1',
          provider: 'github',
          access_token: 'github-access-token',
          refresh_token: 'github-refresh-token',
          token_expires_at: new Date(Date.now() + 3600000).toISOString(),
          profile_data: JSON.stringify({ id: 123, login: 'testuser' }),
        },
      ]

      mockUserService.getOAuthProvidersByUser.mockResolvedValue(mockProviders)

      const req = new Request('http://localhost/auth/oauth-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.access_token).toBe('github-access-token')
      expect(data.provider).toBe('github')
      expect(data.expires_at).toBe(mockProviders[0].token_expires_at)
    })

    it('should return 404 when no OAuth providers found', async () => {
      const requestData = { userId: 'user-123' }
      mockUserService.getOAuthProvidersByUser.mockResolvedValue([])

      const req = new Request('http://localhost/auth/oauth-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe('No OAuth providers found for user')
    })

    it('should return 401 when OAuth token is expired', async () => {
      const requestData = { userId: 'user-123' }
      const mockProviders = [
        {
          id: 'provider-1',
          provider: 'github',
          access_token: 'github-access-token',
          refresh_token: 'github-refresh-token',
          token_expires_at: new Date(Date.now() - 3600000).toISOString(), // Expired
          profile_data: JSON.stringify({ id: 123, login: 'testuser' }),
        },
      ]

      mockUserService.getOAuthProvidersByUser.mockResolvedValue(mockProviders)

      const req = new Request('http://localhost/auth/oauth-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toBe('OAuth token expired')
    })

    it('should return 400 for invalid request data', async () => {
      const invalidData = { userId: '' } // Empty user ID

      const req = new Request('http://localhost/auth/oauth-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('User ID is required')
    })

    it('should return 400 for malformed JSON', async () => {
      const req = new Request('http://localhost/auth/oauth-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid JSON body')
    })
  })

  describe('POST /auth/oauth-token/refresh', () => {
    it('should return error for GitHub token refresh', async () => {
      const requestData = { userId: 'user-123' }
      const mockProviders = [
        {
          id: 'provider-1',
          provider: 'github',
          access_token: 'github-access-token',
          refresh_token: 'github-refresh-token',
          token_expires_at: new Date(Date.now() + 3600000).toISOString(),
          profile_data: JSON.stringify({ id: 123, login: 'testuser' }),
        },
      ]

      mockUserService.getOAuthProvidersByUser.mockResolvedValue(mockProviders)

      const req = new Request('http://localhost/auth/oauth-token/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('GitHub tokens cannot be refreshed. Please re-authenticate.')
    })

    it('should return 400 when no refresh token available', async () => {
      const requestData = { userId: 'user-123' }
      const mockProviders = [
        {
          id: 'provider-1',
          provider: 'google',
          access_token: 'google-access-token',
          refresh_token: null, // No refresh token
          token_expires_at: new Date(Date.now() + 3600000).toISOString(),
          profile_data: JSON.stringify({ id: 123, email: 'test@example.com' }),
        },
      ]

      mockUserService.getOAuthProvidersByUser.mockResolvedValue(mockProviders)

      const req = new Request('http://localhost/auth/oauth-token/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('No refresh token available')
    })

    it('should return 501 for unsupported provider refresh', async () => {
      const requestData = { userId: 'user-123' }
      const mockProviders = [
        {
          id: 'provider-1',
          provider: 'google',
          access_token: 'google-access-token',
          refresh_token: 'google-refresh-token',
          token_expires_at: new Date(Date.now() + 3600000).toISOString(),
          profile_data: JSON.stringify({ id: 123, email: 'test@example.com' }),
        },
      ]

      mockUserService.getOAuthProvidersByUser.mockResolvedValue(mockProviders)

      const req = new Request('http://localhost/auth/oauth-token/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(501)
      const data = await res.json()
      expect(data.error).toBe('Token refresh not implemented for this provider')
    })
  })

  describe('POST /auth/sync-user', () => {
    it('should sync user successfully', async () => {
      const requestData = { userId: 'user-123' }
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      }

      const mockSyncResult = {
        success: true,
        user: mockUser,
        created: false,
        updated: true,
      }

      mockUserService.getUserById.mockResolvedValue(mockUser)
      mockUserSyncService.syncUser.mockResolvedValue(mockSyncResult)

      const req = new Request('http://localhost/auth/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.user).toEqual(mockUser)
      expect(data.created).toBe(false)
      expect(data.updated).toBe(true)
    })

    it('should return 404 when user not found', async () => {
      const requestData = { userId: 'nonexistent-user' }
      mockUserService.getUserById.mockResolvedValue(null)

      const req = new Request('http://localhost/auth/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe('User not found')
    })

    it('should return 500 when sync fails', async () => {
      const requestData = { userId: 'user-123' }
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      }

      const mockSyncResult = {
        success: false,
        error: 'Sync failed',
      }

      mockUserService.getUserById.mockResolvedValue(mockUser)
      mockUserSyncService.syncUser.mockResolvedValue(mockSyncResult)

      const req = new Request('http://localhost/auth/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Sync failed')
    })

    it('should return 400 for invalid request data', async () => {
      const invalidData = { userId: '' } // Empty user ID

      const req = new Request('http://localhost/auth/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('User ID is required')
    })
  })

  describe('GET /auth/badge-server-profile/:userId', () => {
    it('should return user profile successfully', async () => {
      const userId = 'user-123'
      const mockProfile = {
        id: 'badge-server-user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        issuedBadges: 5,
      }

      mockUserSyncService.getBadgeServerUserProfile.mockResolvedValue(mockProfile)

      const req = new Request(`http://localhost/auth/badge-server-profile/${userId}`)
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.profile).toEqual(mockProfile)
    })

    it('should return 404 when profile not found', async () => {
      const userId = 'user-123'
      mockUserSyncService.getBadgeServerUserProfile.mockResolvedValue(null)

      const req = new Request(`http://localhost/auth/badge-server-profile/${userId}`)
      const res = await app.fetch(req)

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Profile not found')
    })

    it('should return 400 for missing user ID', async () => {
      // This would actually be caught by the route pattern, but testing the validation
      const req = new Request('http://localhost/auth/badge-server-profile/')
      const res = await app.fetch(req)

      expect(res.status).toBe(404) // Route not found due to missing parameter
    })

    it('should return 500 on service error', async () => {
      const userId = 'user-123'
      mockUserSyncService.getBadgeServerUserProfile.mockRejectedValue(new Error('Service error'))

      const req = new Request(`http://localhost/auth/badge-server-profile/${userId}`)
      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to get profile')
    })
  })
})
