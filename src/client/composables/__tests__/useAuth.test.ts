import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuth } from '../useAuth'

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

// Mock OpenBadges service
vi.mock('@/services/openbadges', () => ({
  openBadgesService: {
    getUserBackpack: vi.fn(() => Promise.resolve({ assertions: [], total: 0 })),
    addBadgeToBackpack: vi.fn(() => Promise.resolve({ id: 'test-assertion' })),
    removeBadgeFromBackpack: vi.fn(() => Promise.resolve()),
    getBadgeClasses: vi.fn(() => Promise.resolve([])),
    createBadgeClass: vi.fn(() => Promise.resolve({ id: 'test-badge-class' })),
    issueBadge: vi.fn(() => Promise.resolve({ id: 'test-issued-badge' })),
  },
}))

// Mock router
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}))

describe('useAuth', () => {
  let auth: ReturnType<typeof useAuth>
  let mockFetch: any

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // Mock global fetch for backend API calls
    mockFetch = vi.fn()
    global.fetch = mockFetch

    // Mock localStorage methods
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })

    auth = useAuth()
  })

  describe('Initial state', () => {
    it('should have correct initial state', () => {
      expect(auth.user.value).toBeNull()
      expect(auth.isAuthenticated.value).toBe(false)
      expect(auth.isAdmin.value).toBe(false)
      expect(auth.isLoading.value).toBe(false)
      expect(auth.error.value).toBeNull()
      expect(auth.isWebAuthnSupported.value).toBe(true)
    })
  })

  describe('User storage', () => {
    it('should initialize with empty state when no storage exists', () => {
      localStorage.getItem = vi.fn(() => null)

      const newAuth = useAuth()
      expect(newAuth.user.value).toBeNull()
      expect(newAuth.isAuthenticated.value).toBe(false)
    })

    it('should restore authentication state from localStorage', () => {
      const mockUser = {
        id: 'test-user-1',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        avatar: undefined,
        isAdmin: false,
        createdAt: new Date().toISOString(),
        credentials: [],
      }

      localStorage.getItem = vi.fn(key => {
        if (key === 'auth_token') return 'test-token'
        if (key === 'user_data') return JSON.stringify(mockUser)
        return null
      })

      useAuth()
      expect(localStorage.getItem).toHaveBeenCalledWith('auth_token')
      expect(localStorage.getItem).toHaveBeenCalledWith('user_data')
    })
  })

  describe('Authentication state persistence', () => {
    it('should restore authentication state from localStorage', () => {
      const mockUser = {
        id: 'test-user',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        avatar: undefined,
        isAdmin: false,
        createdAt: new Date().toISOString(),
        credentials: [],
      }

      localStorage.getItem = vi.fn(key => {
        if (key === 'auth_token') return 'test-token'
        if (key === 'user_data') return JSON.stringify(mockUser)
        return null
      })

      const newAuth = useAuth()

      // Wait for initialization to complete
      setTimeout(() => {
        expect(newAuth.user.value).toEqual(mockUser)
        expect(newAuth.token.value).toBe('test-token')
        expect(newAuth.isAuthenticated.value).toBe(true)
      }, 0)
    })

    it('should clear invalid stored data', () => {
      localStorage.getItem = vi.fn(key => {
        if (key === 'auth_token') return 'test-token'
        if (key === 'user_data') return 'invalid-json'
        return null
      })

      const newAuth = useAuth()

      setTimeout(() => {
        expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token')
        expect(localStorage.removeItem).toHaveBeenCalledWith('user_data')
        expect(newAuth.user.value).toBeNull() // Use the variable
      }, 0)
    })
  })

  describe('WebAuthn Registration', () => {
    it('should register a new user successfully', async () => {
      const registrationData = {
        username: 'newuser',
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
      }

      // Mock successful backend responses
      mockFetch
        .mockResolvedValueOnce({
          // Check existing user by username (1st call)
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({
          // Check existing user by username (2nd call - for email check)
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
          json: vi.fn().mockResolvedValue({
            id: 'new-user-id',
            username: 'newuser',
            email: 'newuser@example.com',
            firstName: 'New',
            lastName: 'User',
            isActive: true,
            roles: ['USER'],
            createdAt: new Date().toISOString(),
          }),
        })
        .mockResolvedValueOnce({
          // Store credential
          ok: true,
          json: vi.fn().mockResolvedValue({}),
        })

      const result = await auth.registerWithWebAuthn(registrationData)

      if (!result) {
        console.log('Registration failed. Error:', auth.error.value)
        console.log('Fetch call count:', mockFetch.mock.calls.length)
        console.log('Fetch calls:', mockFetch.mock.calls)
      }

      expect(result).toBe(true)
      expect(auth.user.value).not.toBeNull()
      expect(auth.user.value?.username).toBe('newuser')
      expect(auth.user.value?.email).toBe('newuser@example.com')
      expect(auth.isAuthenticated.value).toBe(true)
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', expect.any(String))
      expect(localStorage.setItem).toHaveBeenCalledWith('user_data', expect.any(String))
    })

    it('should handle registration failure for existing user', async () => {
      const duplicateUser = {
        username: 'existing',
        email: 'different@example.com',
        firstName: 'New',
        lastName: 'User',
      }

      // Mock backend response with existing user
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            id: 'existing-user-id',
            username: 'existing',
            email: 'existing@example.com',
          },
        ]),
      })

      const result = await auth.registerWithWebAuthn(duplicateUser)

      expect(result).toBe(false)
      expect(auth.error.value).toBe('Username already exists')
    })
  })

  describe('WebAuthn Authentication', () => {
    it('should authenticate user successfully', async () => {
      const mockUser = {
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
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

      // Mock backend responses
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

      const result = await auth.authenticateWithWebAuthn('testuser')

      expect(result).toBe(true)
      expect(auth.user.value).not.toBeNull()
      expect(auth.user.value?.username).toBe('testuser')
      expect(auth.isAuthenticated.value).toBe(true)
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', expect.any(String))
      expect(localStorage.setItem).toHaveBeenCalledWith('user_data', expect.any(String))
    })

    it('should handle authentication failure for non-existent user', async () => {
      // Mock backend response with no users found
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([]),
        })

      const result = await auth.authenticateWithWebAuthn('nonexistent')

      expect(result).toBe(false)
      expect(auth.error.value).toBe('User not found')
      expect(auth.isAuthenticated.value).toBe(false)
    })
  })

  describe('Logout', () => {
    it('should clear authentication state and redirect', () => {
      // Set up authenticated state
      auth.user.value = {
        id: 'test-user',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        avatar: undefined,
        isAdmin: false,
        createdAt: new Date().toISOString(),
        credentials: [],
      }
      auth.token.value = 'test-token'

      auth.logout()

      expect(auth.user.value).toBeNull()
      expect(auth.token.value).toBeNull()
      expect(auth.isAuthenticated.value).toBe(false)
      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token')
      expect(localStorage.removeItem).toHaveBeenCalledWith('user_data')
    })
  })

  describe('OpenBadges Integration', () => {
    beforeEach(() => {
      auth.user.value = {
        id: 'test-user',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        avatar: undefined,
        isAdmin: false,
        createdAt: new Date().toISOString(),
        credentials: [],
      }
    })

    it('should get user backpack', async () => {
      const backpack = await auth.getUserBackpack()

      expect(backpack).toEqual({ assertions: [], total: 0 })
    })

    it('should add badge to backpack', async () => {
      const result = await auth.addBadgeToBackpack('test-badge-class')

      expect(result).toBe(true)
    })

    it('should remove badge from backpack', async () => {
      const result = await auth.removeBadgeFromBackpack('test-assertion')

      expect(result).toBe(true)
    })

    it('should get badge classes', async () => {
      const badgeClasses = await auth.getBadgeClasses()

      expect(badgeClasses).toEqual([])
    })

    it('should create badge class', async () => {
      const badgeClass = await auth.createBadgeClass({ name: 'Test Badge' })

      expect(badgeClass).toEqual({ id: 'test-badge-class' })
    })

    it('should issue badge', async () => {
      const issuedBadge = await auth.issueBadge('test-badge-class', 'recipient@example.com')

      expect(issuedBadge).toEqual({ id: 'test-issued-badge' })
    })

    it('should handle OpenBadges operations when user is not authenticated', async () => {
      auth.user.value = null

      const backpack = await auth.getUserBackpack()
      const addResult = await auth.addBadgeToBackpack('test-badge-class')
      const removeResult = await auth.removeBadgeFromBackpack('test-assertion')
      const badgeClass = await auth.createBadgeClass({ name: 'Test Badge' })
      const issuedBadge = await auth.issueBadge('test-badge-class', 'recipient@example.com')

      expect(backpack).toBeNull()
      expect(addResult).toBe(false)
      expect(removeResult).toBe(false)
      expect(badgeClass).toBeNull()
      expect(issuedBadge).toBeNull()
    })
  })

  describe('Credential Management', () => {
    beforeEach(() => {
      auth.user.value = {
        id: 'test-user',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        avatar: undefined,
        isAdmin: false,
        createdAt: new Date().toISOString(),
        credentials: [],
      }
    })

    it('should add new credential', async () => {
      // Mock backend response for storing credential
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      })

      const result = await auth.addCredential('New Authenticator')

      expect(result).toBe(true)
      expect(auth.user.value?.credentials).toHaveLength(1)
      expect(auth.user.value?.credentials[0]?.name).toBe('New Authenticator')
    })

    it('should remove credential', async () => {
      // Add a credential first
      auth.user.value!.credentials = [
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
      ]

      // Mock backend response for removing credential
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      })

      await auth.removeCredential('test-credential-id')

      expect(auth.user.value?.credentials).toHaveLength(0)
    })
  })

  describe('Error Handling', () => {
    it('should clear error', () => {
      auth.error.value = 'Test error'

      auth.clearError()

      expect(auth.error.value).toBeNull()
    })
  })

  describe('Profile Management', () => {
    beforeEach(() => {
      auth.user.value = {
        id: 'test-user',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        avatar: undefined,
        isAdmin: false,
        createdAt: new Date().toISOString(),
        credentials: [],
      }
    })

    it('should update user profile', async () => {
      const updates = {
        firstName: 'Updated',
        lastName: 'Name',
      }

      // Mock backend response for updating profile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      })

      await auth.updateProfile(updates)

      expect(auth.user.value?.firstName).toBe('Updated')
      expect(auth.user.value?.lastName).toBe('Name')
      expect(localStorage.setItem).toHaveBeenCalledWith('user_data', expect.any(String))
    })
  })
})
