import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuth } from '@/composables/useAuth'
import { openBadgesService } from '@/services/openbadges'

// Mock WebAuthn utils
vi.mock('@/utils/webauthn', () => ({
  WebAuthnUtils: {
    isSupported: vi.fn(() => true),
    isPlatformAuthenticatorAvailable: vi.fn(() => Promise.resolve(true)),
    createRegistrationOptions: vi.fn((userId, username, displayName, excludeCredentials) => ({
      challenge: new Uint8Array(32),
      rp: { name: 'Test RP', id: 'localhost' },
      user: { id: userId, name: username, displayName },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      excludeCredentials: excludeCredentials || [],
    })),
    createAuthenticationOptions: vi.fn(credentials => ({
      challenge: new Uint8Array(32),
      allowCredentials: credentials || [],
    })),
    register: vi.fn(() =>
      Promise.resolve({
        id: 'test-credential-id',
        publicKey: 'test-public-key',
        transports: ['internal'],
        authenticatorAttachment: 'platform',
      })
    ),
    authenticate: vi.fn(() =>
      Promise.resolve({
        id: 'test-credential-id',
        publicKey: 'test-public-key',
        transports: ['internal'],
      })
    ),
    getAuthenticatorName: vi.fn(() => 'Test Authenticator'),
  },
  WebAuthnError: class extends Error {
    constructor(
      message: string,
      public userMessage: string
    ) {
      super(message)
    }
  },
}))

// Mock router
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}))

// Mock OpenBadges service
vi.mock('@/services/openbadges', () => ({
  openBadgesService: {
    getUserBackpack: vi.fn(),
    addBadgeToBackpack: vi.fn(),
    removeBadgeFromBackpack: vi.fn(),
    getBadgeClasses: vi.fn(),
    createBadgeClass: vi.fn(),
    issueBadge: vi.fn(),
  },
}))

describe('Authentication Flow Integration Tests', () => {
  let mockFetch: ReturnType<typeof vi.fn>
  let registeredUsers: unknown[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    registeredUsers = []

    mockFetch = vi.fn()
    global.fetch = mockFetch

    // Set up intelligent mock responses that can handle different scenarios
    mockFetch.mockImplementation(
      async (
        url: string,
        options?: { method?: string; body?: string; headers?: Record<string, string> }
      ) => {
        const method = options?.method || 'GET'
        const body = options?.body ? JSON.parse(options.body) : null

        // Handle user lookup by username or email (GET /api/bs/users?username=... or ?email=...)
        if (url.includes('/api/bs/users') && method === 'GET') {
          const urlObj = new URL(url, 'http://localhost')
          const username = urlObj.searchParams.get('username')
          const email = urlObj.searchParams.get('email')

          // Check against registered users first
          const foundUser = registeredUsers.find(
            user => user.username === username || user.email === email
          )

          if (foundUser) {
            return {
              ok: true,
              json: async () => [foundUser],
            }
          }

          // Return existing user data for specific cases
          if (username === 'existing' || email === 'existing@example.com') {
            return {
              ok: true,
              json: async () => [
                {
                  id: 'existing-user-id',
                  username: 'existing',
                  email: 'existing@example.com',
                  firstName: '',
                  lastName: '',
                  roles: ['USER'],
                  credentials: [],
                },
              ],
            }
          }

          // Return empty array for non-existent users
          return {
            ok: true,
            json: async () => [],
          }
        }

        // Handle credential addition (POST /api/bs/users/:userId/credentials)
        if (url.includes('/credentials') && method === 'POST') {
          // Extract userId from URL
          const urlParts = url.split('/')
          const userIdIndex = urlParts.indexOf('users') + 1
          const userId = urlParts[userIdIndex]

          const credential = {
            id: 'test-credential-id',
            publicKey: 'test-public-key',
            transports: ['internal'],
            counter: 0,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            name: 'Test Authenticator',
            type: 'platform',
          }

          // Add credential to the user
          const user = registeredUsers.find(u => u.id === userId)
          if (user) {
            user.credentials = user.credentials || []
            user.credentials.push(credential)
          }

          return {
            ok: true,
            json: async () => credential,
          }
        }

        // Handle user creation (POST /api/bs/users)
        if (url.includes('/api/bs/users') && method === 'POST' && !url.includes('/credentials')) {
          const { username, email, firstName, lastName } = body
          const newUser = {
            id: `${username}-user-id`,
            username,
            email,
            firstName: firstName || '',
            lastName: lastName || '',
            roles: ['USER'],
            createdAt: new Date().toISOString(),
            credentials: [],
          }

          // Add to registered users for future lookups
          registeredUsers.push(newUser)

          return {
            ok: true,
            json: async () => newUser,
          }
        }

        // Handle credential updates (PATCH /api/bs/users/:userId/credentials/:credentialId)
        if (url.includes('/credentials') && method === 'PATCH') {
          return {
            ok: true,
            json: async () => ({
              success: true,
            }),
          }
        }

        // Handle profile update (PUT /api/bs/users/:userId)
        if (url.includes('/api/bs/users/') && method === 'PUT') {
          // Extract userId from URL
          const urlParts = url.split('/')
          const userIdIndex = urlParts.indexOf('users') + 1
          const userId = urlParts[userIdIndex]

          // Find the user and update their profile
          const user = registeredUsers.find(u => u.id === userId)
          if (user) {
            // Update user with new data
            Object.assign(user, body)

            // Handle roles conversion
            if (body.roles) {
              user.roles = body.roles
            }

            return {
              ok: true,
              json: async () => user,
            }
          }

          return {
            ok: true,
            json: async () => ({
              id: 'updated-user-id',
              username: 'updateduser',
              email: 'updated@example.com',
              firstName: 'Updated',
              lastName: 'User',
              roles: ['USER'],
              credentials: [],
            }),
          }
        }

        // Handle platform token generation
        if (url.includes('/api/auth/platform-token') && method === 'POST') {
          return {
            ok: true,
            json: async () => ({ token: 'mock-platform-token' }),
          }
        }

        // Handle OpenBadges API calls
        if (url.includes('openbadges.org')) {
          if (url.includes('/api/v1/badge-assertions')) {
            return {
              ok: true,
              json: async () => ({
                assertions: [
                  {
                    id: 'assertion-1',
                    badgeClass: 'badge-1',
                    recipient: 'test@example.com',
                  },
                ],
                total: 1,
              }),
            }
          }

          if (method === 'POST') {
            return {
              ok: true,
              json: async () => ({
                id: 'new-assertion',
                badgeClass: 'badge-class-1',
                recipient: 'test@example.com',
              }),
            }
          }

          if (method === 'DELETE') {
            return { ok: true }
          }
        }

        // Default response for unhandled calls
        return {
          ok: true,
          json: async () => ({}),
        }
      }
    )
  })

  describe('Complete User Registration and Authentication Flow', () => {
    it('should register user, logout, and login again successfully', async () => {
      // Step 1: Register a new user
      const auth = useAuth()

      const registrationData = {
        username: 'newuser',
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
      }

      const mockUser = {
        id: 'new-user-id',
        username: 'newuser',
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        isActive: true,
        roles: ['USER'],
        createdAt: new Date().toISOString(),
        credentials: [
          {
            id: 'test-credential-id',
            publicKey: 'test-public-key',
            transports: ['internal'],
            counter: 0,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            name: 'Test Authenticator',
            type: 'platform',
          },
        ],
      }

      // Mock registration flow - need more responses for the findUser calls
      mockFetch
        .mockResolvedValueOnce({
          // Check existing user by username (1st call)
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({
          // Check existing user by username (2nd call)
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({
          // Check existing user by email (1st call)
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({
          // Check existing user by email (2nd call)
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({
          // Create user
          ok: true,
          json: vi.fn().mockResolvedValue(mockUser),
        })
        .mockResolvedValueOnce({
          // Store credential
          ok: true,
          json: vi.fn().mockResolvedValue({}),
        })

      const registrationResult = await auth.registerWithWebAuthn(registrationData)

      expect(registrationResult).toBe(true)
      expect(auth.user.value).not.toBeNull()
      expect(auth.isAuthenticated.value).toBe(true)
      expect(auth.user.value?.username).toBe('newuser')

      // Step 2: Logout
      auth.logout()

      expect(auth.user.value).toBeNull()
      expect(auth.isAuthenticated.value).toBe(false)

      // Step 3: Login again with the same user
      mockFetch
        .mockResolvedValueOnce({
          // Find user by username
          ok: true,
          json: vi.fn().mockResolvedValue([mockUser]),
        })
        .mockResolvedValueOnce({
          // Update credential last used
          ok: true,
          json: vi.fn().mockResolvedValue({}),
        })

      const loginResult = await auth.authenticateWithWebAuthn('newuser')

      expect(loginResult).toBe(true)
      expect(auth.user.value).not.toBeNull()
      expect(auth.isAuthenticated.value).toBe(true)
      expect(auth.user.value?.username).toBe('newuser')
    })

    it('should persist user data across page reloads', async () => {
      // Step 1: Register and authenticate user
      const auth1 = useAuth()

      const registrationData = {
        username: 'persistentuser',
        email: 'persistent@example.com',
        firstName: 'Persistent',
        lastName: 'User',
      }

      const mockUser = {
        id: 'persistent-user-id',
        username: 'persistentuser',
        email: 'persistent@example.com',
        firstName: 'Persistent',
        lastName: 'User',
        isActive: true,
        roles: ['USER'],
        createdAt: new Date().toISOString(),
        credentials: [
          {
            id: 'test-credential-id',
            publicKey: 'test-public-key',
            transports: ['internal'],
            counter: 0,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            name: 'Test Authenticator',
            type: 'platform',
          },
        ],
      }

      // Mock registration flow
      mockFetch
        .mockResolvedValueOnce({
          // Check existing user by username (1st call)
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({
          // Check existing user by username (2nd call)
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({
          // Check existing user by email (1st call)
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({
          // Check existing user by email (2nd call)
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({
          // Create user
          ok: true,
          json: vi.fn().mockResolvedValue(mockUser),
        })
        .mockResolvedValueOnce({
          // Store credential
          ok: true,
          json: vi.fn().mockResolvedValue({}),
        })

      await auth1.registerWithWebAuthn(registrationData)

      expect(auth1.isAuthenticated.value).toBe(true)

      // Step 2: Simulate page reload by creating new auth instance
      // Mock localStorage to return the stored data
      const mockToken = auth1.token.value
      const storedUser = auth1.user.value

      localStorage.getItem = vi.fn(key => {
        if (key === 'auth_token') return mockToken
        if (key === 'user_data') return JSON.stringify(storedUser)
        return null
      })

      const auth2 = useAuth()

      // The user should still be authenticated after "reload"
      expect(auth2.isAuthenticated.value).toBe(true)
      expect(auth2.user.value?.username).toBe('persistentuser')
    })
  })

  describe('OpenBadges Integration Flow', () => {
    it('should integrate with OpenBadges service after authentication', async () => {
      // Mock OpenBadges API responses
      const mockBackpack = {
        assertions: [{ id: 'assertion-1', badgeClass: 'badge-1', recipient: 'test@example.com' }],
        total: 1,
      }

      // Mock the OpenBadges service
      vi.mocked(openBadgesService.getUserBackpack).mockResolvedValue(mockBackpack)

      // Step 1: Register and authenticate user
      const auth = useAuth()

      const registrationData = {
        username: 'badgeuser',
        email: 'badge@example.com',
        firstName: 'Badge',
        lastName: 'User',
      }

      await auth.registerWithWebAuthn(registrationData)

      // Step 2: Get user backpack
      const backpack = await auth.getUserBackpack()

      expect(backpack).toEqual(mockBackpack)
      expect(openBadgesService.getUserBackpack).toHaveBeenCalledWith(auth.user.value)
    })

    it('should handle badge management operations', async () => {
      const mockPlatformToken = 'mock-platform-jwt-token'
      const mockNewAssertion = {
        id: 'new-assertion',
        badgeClass: 'badge-class-1',
        recipient: 'badge@example.com',
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: mockPlatformToken }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockNewAssertion),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: mockPlatformToken }),
        })
        .mockResolvedValueOnce({
          ok: true,
        })

      // Step 1: Register and authenticate user
      const auth = useAuth()

      const registrationData = {
        username: 'badgemanager',
        email: 'manager@example.com',
        firstName: 'Badge',
        lastName: 'Manager',
      }

      await auth.registerWithWebAuthn(registrationData)

      // Step 2: Add badge to backpack
      const addResult = await auth.addBadgeToBackpack('badge-class-1', 'evidence', 'narrative')
      expect(addResult).toBe(true)

      // Step 3: Remove badge from backpack
      const removeResult = await auth.removeBadgeFromBackpack('new-assertion')
      expect(removeResult).toBe(true)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle WebAuthn registration errors gracefully', async () => {
      // Mock WebAuthn to throw an error
      const { WebAuthnUtils } = await import('@/utils/webauthn')
      vi.mocked(WebAuthnUtils.register).mockRejectedValueOnce(
        new Error('WebAuthn registration failed')
      )

      const auth = useAuth()

      const registrationData = {
        username: 'erroruser',
        email: 'error@example.com',
        firstName: 'Error',
        lastName: 'User',
      }

      const result = await auth.registerWithWebAuthn(registrationData)

      expect(result).toBe(false)
      expect(auth.error.value).toBe('Registration failed. Please try again.')
      expect(auth.isAuthenticated.value).toBe(false)
    })

    it('should handle OpenBadges API errors gracefully', async () => {
      // Mock the OpenBadges service to return null
      vi.mocked(openBadgesService.getUserBackpack).mockResolvedValue(null)

      const auth = useAuth()

      const registrationData = {
        username: 'apierroruser',
        email: 'apierror@example.com',
        firstName: 'API',
        lastName: 'Error',
      }

      await auth.registerWithWebAuthn(registrationData)

      const backpack = await auth.getUserBackpack()

      expect(backpack).toBeNull()
    })
  })

  describe('Multiple User Scenarios', () => {
    it('should handle multiple users registration and authentication', async () => {
      const auth = useAuth()

      // Register first user
      const user1Data = {
        username: 'user1',
        email: 'user1@example.com',
        firstName: 'User',
        lastName: 'One',
      }

      await auth.registerWithWebAuthn(user1Data)
      expect(auth.user.value?.username).toBe('user1')

      // Logout first user
      auth.logout()

      // Register second user
      const user2Data = {
        username: 'user2',
        email: 'user2@example.com',
        firstName: 'User',
        lastName: 'Two',
      }

      await auth.registerWithWebAuthn(user2Data)
      expect(auth.user.value?.username).toBe('user2')

      // Logout second user
      auth.logout()

      // Login as first user
      const loginResult = await auth.authenticateWithWebAuthn('user1')
      expect(loginResult).toBe(true)
      expect(auth.user.value?.username).toBe('user1')
    })
  })

  describe('Admin User Scenarios', () => {
    it('should handle admin user badge issuance', async () => {
      const mockIssuedBadge = {
        id: 'issued-badge-id',
        badgeClass: 'badge-class-1',
        recipient: 'recipient@example.com',
      }

      // Mock the OpenBadges service
      vi.mocked(openBadgesService.issueBadge).mockResolvedValue(mockIssuedBadge)

      const auth = useAuth()

      // Register admin user
      const adminData = {
        username: 'admin',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
      }

      await auth.registerWithWebAuthn(adminData)

      // Update user to be admin
      console.log('Before updateProfile:', auth.user.value)
      await auth.updateProfile({ isAdmin: true })
      console.log('After updateProfile:', auth.user.value)

      expect(auth.user.value?.isAdmin).toBe(true)
      expect(auth.isAdmin.value).toBe(true)

      // Issue badge
      const issuedBadge = await auth.issueBadge(
        'badge-class-1',
        'recipient@example.com',
        'evidence',
        'narrative'
      )
      expect(issuedBadge).toEqual(mockIssuedBadge)
    })
  })
})
