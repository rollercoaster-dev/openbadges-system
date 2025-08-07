import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { readFileSync } from 'fs'
import { JWTService } from '../jwt'

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs')
  return {
    ...actual,
    readFileSync: vi.fn(),
  }
})

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}))

const mockJwt = vi.mocked(jwt)

describe('JWTService', () => {
  let jwtService: JWTService
  const mockPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHDJ7FR/04tfIc
Ec0ZwdWC23kAq4zML0M33M/2YrtSJhZ6ZxFSkBtx2jVsUmeqR9sJDeXkQtXy0f4p
MBdDXPcj5YSrrsdda1+Il0vMuDKxgNsB86M3UQdKzdGLfFEirgxjR7kEJv10YOtE
DpbpedxPrvG7Ik9MlJTAd4r0Pw49cjcdMTE6E/8gMAbKAnJfdCp5k0CGlQo2o1o6
q+5r6dJDIo8jTSlB+NNcuiA6jXphOoaSGyTGPGAJq0Ly+69AazxfOlxRrtE32f+Z
C1GKiWSiZdsXdUIrF9WUELMlnarXCJJ6S4UG0ohBTgFcFDYuPITiGVQeS+Hf5Z8i
pqQfFAB5AgMBAAECggEABvGpEcxHxUl2HBnzOGGqmcfXhxvhgzPFKWJaOBvQXQCb
K+oOgCQFy3GaJvLzYSCvNzObRKXrpKgEUPClFcmHgqhE6jEOQwQhfvfJJuZAJJ7L
TEST_PRIVATE_KEY_CONTENT
-----END PRIVATE KEY-----`

  const mockPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxwye1Uf9OLXyHBHNGcHV
gtt5AKuMzC9DN9zP9mK7UiYWemcRUpAbcdo1bFJnqkfbCQ3l5ELV8tH+KTAXQlz3
I+WEq67HXWtfiJdLzLgysYDbAfOjN1EHSs3Ri3xRIq4MY0e5BCb9dGDrRA6W6Xnc
T67xuyJPTJSUwHeK9D8OPXI3HTExOhP/IDAGygJyX3QqeZNAhpUKNqNaOqvua+nS
QyKPI00pQfjTXLogOo16YTqGkhskxjxgCatC8vuvQGs8XzpcUa7RN9n/mQtRiolko
mXbF3VCKxfVlBCzJZ2q1wiSekuFBtKIQU4BXBQlLjyE4hlUHkvh3+WfIqakHxQAe
QIDAQAB
-----END PUBLIC KEY-----`

  beforeEach(() => {
    vi.clearAllMocks()

    // Set up the readFileSync mock to return different keys based on filename
    vi.mocked(readFileSync).mockImplementation(path => {
      const pathStr = path.toString()
      if (pathStr.includes('private')) {
        return mockPrivateKey
      } else if (pathStr.includes('public')) {
        return mockPublicKey
      }
      return mockPrivateKey // fallback
    })

    // Create service instance after mocks are set up
    jwtService = new JWTService()
  })

  describe('constructor', () => {
    it('should initialize with private key and platform configuration', () => {
      // Test that the service constructor works
      expect(jwtService).toBeDefined()
      expect(typeof jwtService.generatePlatformToken).toBe('function')
      expect(typeof jwtService.verifyToken).toBe('function')
    })

    it('should have correct platform and client configuration', () => {
      // Mock the JWT sign function to return a token
      const mockToken = 'mock-api-client-token'
      mockJwt.sign.mockReturnValueOnce(mockToken as never)

      // Test that the service has the correct configuration
      const apiClient = jwtService.createOpenBadgesApiClient({
        id: 'test-id',
        username: 'test',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isAdmin: false,
      })

      expect(apiClient.headers['Content-Type']).toBe('application/json')
      expect(apiClient.headers.Authorization).toBe(`Bearer ${mockToken}`)
      expect(apiClient.token).toBe(mockToken)
    })
  })

  describe('generatePlatformToken', () => {
    it('should generate JWT token with correct payload', () => {
      const mockUser = {
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isAdmin: false,
      }

      const mockToken = 'mock-jwt-token'
      mockJwt.sign.mockImplementation(() => mockToken)

      const result = jwtService.generatePlatformToken(mockUser)

      expect(result).toBe(mockToken)
      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          sub: 'test-user-id',
          platformId: 'urn:uuid:a504d862-bd64-4e0d-acff-db7955955bc1',
          displayName: 'Test User',
          email: 'test@example.com',
          metadata: {
            firstName: 'Test',
            lastName: 'User',
            isAdmin: false,
          },
        },
        expect.any(String),
        {
          algorithm: 'RS256',
          issuer: 'openbadges-demo-main-app',
          expiresIn: '1h',
        }
      )
    })

    it('should generate token for admin user', () => {
      const mockUser = {
        id: 'admin-user-id',
        username: 'admin',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        isAdmin: true,
      }

      const mockToken = 'mock-admin-jwt-token'
      mockJwt.sign.mockImplementation(() => mockToken)

      const result = jwtService.generatePlatformToken(mockUser)

      expect(result).toBe(mockToken)
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            isAdmin: true,
          }),
        }),
        expect.any(String),
        expect.any(Object)
      )
    })
  })

  describe('verifyToken', () => {
    it('should verify valid JWT token using public key', () => {
      const mockToken = 'valid-jwt-token'
      const mockPayload = {
        sub: 'test-user-id',
        platformId: 'urn:uuid:a504d862-bd64-4e0d-acff-db7955955bc1',
        displayName: 'Test User',
        email: 'test@example.com',
        metadata: {
          firstName: 'Test',
          lastName: 'User',
          isAdmin: false,
        },
      }

      mockJwt.verify.mockImplementation(() => mockPayload)

      const result = jwtService.verifyToken(mockToken)

      expect(result).toEqual(mockPayload)
      expect(mockJwt.verify).toHaveBeenCalledWith(
        mockToken,
        expect.stringContaining('-----BEGIN PUBLIC KEY-----'),
        {
          algorithms: ['RS256'],
          issuer: 'openbadges-demo-main-app',
        }
      )
    })

    it('should return null for invalid JWT token', () => {
      const mockToken = 'invalid-jwt-token'
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const result = jwtService.verifyToken(mockToken)

      expect(result).toBeNull()
    })
  })

  describe('createOpenBadgesApiClient', () => {
    it('should create API client with correct headers', () => {
      const mockUser = {
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isAdmin: false,
      }

      const mockToken = 'mock-jwt-token'
      mockJwt.sign.mockImplementation(() => mockToken)

      const result = jwtService.createOpenBadgesApiClient(mockUser)

      expect(result.token).toBe(mockToken)
      expect(result.headers).toEqual({
        Authorization: `Bearer ${mockToken}`,
        'Content-Type': 'application/json',
      })
    })
  })

  describe('error handling', () => {
    it('should handle JWT signing errors gracefully', () => {
      const mockUser = {
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isAdmin: false,
      }

      mockJwt.sign.mockImplementation(() => {
        throw new Error('JWT signing failed')
      })

      expect(() => jwtService.generatePlatformToken(mockUser)).toThrow('JWT signing failed')
    })

    it('should handle verification errors gracefully', () => {
      const mockToken = 'malformed-token'
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Token verification failed')
      })

      const result = jwtService.verifyToken(mockToken)

      expect(result).toBeNull()
    })
  })
})
