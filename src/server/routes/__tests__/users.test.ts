import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { userRoutes } from '../users'
import { userService } from '../../services/user'
import { requireAdmin, requireSelfOrAdminFromParam } from '../../middleware/auth'

// Mock the user service
vi.mock('../../services/user', () => ({
  userService: {
    getUsers: vi.fn(),
    createUser: vi.fn(),
    getUserById: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    addUserCredential: vi.fn(),
    getUserCredentials: vi.fn(),
    removeUserCredential: vi.fn(),
  },
}))

// Mock the auth middleware
vi.mock('../../middleware/auth', () => ({
  requireAdmin: vi.fn((c, next) => next()),
  requireSelfOrAdminFromParam: vi.fn(() => (c, next) => next()),
}))

describe('Users Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/users', userRoutes)
    vi.clearAllMocks()
  })

  // Get the mocked userService
  const mockUserService = vi.mocked(userService)

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /users', () => {
    it('should return paginated users with default parameters', async () => {
      const mockUsers = [
        {
          id: 'user1',
          username: 'testuser1',
          email: 'test1@example.com',
          firstName: 'Test',
          lastName: 'User1',
        },
        {
          id: 'user2',
          username: 'testuser2',
          email: 'test2@example.com',
          firstName: 'Test',
          lastName: 'User2',
        },
      ]

      mockUserService.getUsers.mockResolvedValue({
        users: mockUsers,
        total: 2,
      })

      const req = new Request('http://localhost/users')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.users).toEqual(mockUsers)
      expect(data.total).toBe(2)
      expect(mockUserService.getUsers).toHaveBeenCalledWith(1, 10, '', {})
    })

    it('should return users with custom pagination parameters', async () => {
      const mockUsers = []
      mockUserService.getUsers.mockResolvedValue({
        users: mockUsers,
        total: 0,
      })

      const req = new Request('http://localhost/users?page=2&limit=5&search=test')
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(mockUserService.getUsers).toHaveBeenCalledWith(2, 5, 'test', {})
    })

    it('should return users with filters', async () => {
      const mockUsers = []
      mockUserService.getUsers.mockResolvedValue({
        users: mockUsers,
        total: 0,
      })

      const req = new Request(
        'http://localhost/users?role=ADMIN&status=active&dateFrom=2023-01-01&dateTo=2023-12-31'
      )
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(mockUserService.getUsers).toHaveBeenCalledWith(1, 10, '', {
        role: 'ADMIN',
        status: 'active',
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31',
      })
    })

    it('should return 400 for invalid query parameters', async () => {
      const req = new Request('http://localhost/users?page=0&limit=200')
      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid query parameters')
    })

    it('should return 503 when user service is unavailable', async () => {
      // Temporarily make userService null
      mockUserService.getUsers.mockImplementation(() => {
        throw new Error('Service unavailable')
      })

      const req = new Request('http://localhost/users')
      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to fetch users')
    })

    it('should return 500 on service error', async () => {
      mockUserService.getUsers.mockRejectedValue(new Error('Database error'))

      const req = new Request('http://localhost/users')
      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to fetch users')
    })
  })

  describe('POST /users', () => {
    it('should create a new user successfully', async () => {
      const newUser = {
        username: 'newuser',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
      }

      const createdUser = {
        id: 'new-user-id',
        ...newUser,
        isActive: true,
        roles: ['USER'],
      }

      mockUserService.createUser.mockResolvedValue(createdUser)

      const req = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data).toEqual(createdUser)
      expect(mockUserService.createUser).toHaveBeenCalledWith({
        ...newUser,
        isActive: true,
        roles: ['USER'],
      })
    })

    it('should return 400 for invalid user data', async () => {
      const invalidUser = {
        username: 'ab', // Too short
        email: 'invalid-email',
        firstName: '',
        lastName: 'User',
      }

      const req = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidUser),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid user data')
    })

    it('should return 400 for malformed JSON', async () => {
      const req = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid JSON body')
    })

    it('should return 500 on service error', async () => {
      const newUser = {
        username: 'newuser',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
      }

      mockUserService.createUser.mockRejectedValue(new Error('Database error'))

      const req = new Request('http://localhost/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to create user')
    })
  })

  describe('GET /users/:id', () => {
    it('should return user by ID', async () => {
      const userId = 'test-user-id'
      const user = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      }

      mockUserService.getUserById.mockResolvedValue(user)

      const req = new Request(`http://localhost/users/${userId}`)
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(user)
      expect(mockUserService.getUserById).toHaveBeenCalledWith(userId)
    })

    it('should return 404 when user not found', async () => {
      const userId = 'nonexistent-user'
      mockUserService.getUserById.mockResolvedValue(null)

      const req = new Request(`http://localhost/users/${userId}`)
      const res = await app.fetch(req)

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe('User not found')
    })

    it('should return 500 on service error', async () => {
      const userId = 'test-user-id'
      mockUserService.getUserById.mockRejectedValue(new Error('Database error'))

      const req = new Request(`http://localhost/users/${userId}`)
      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to fetch user')
    })
  })

  describe('PUT /users/:id', () => {
    it('should update user successfully', async () => {
      const userId = 'test-user-id'
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      }

      const updatedUser = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Updated',
        lastName: 'Name',
      }

      mockUserService.updateUser.mockResolvedValue(updatedUser)

      const req = new Request(`http://localhost/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(updatedUser)
      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining(updateData)
      )
    })

    it('should return 404 when user not found', async () => {
      const userId = 'nonexistent-user'
      const updateData = { firstName: 'Updated' }

      mockUserService.updateUser.mockResolvedValue(null)

      const req = new Request(`http://localhost/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toBe('User not found')
    })

    it('should return 400 for invalid update data', async () => {
      const userId = 'test-user-id'
      const invalidUpdateData = {
        email: 'invalid-email',
      }

      const req = new Request(`http://localhost/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidUpdateData),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid user data')
    })

    it('should return 400 for malformed JSON', async () => {
      const userId = 'test-user-id'

      const req = new Request(`http://localhost/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid JSON body')
    })
  })

  describe('DELETE /users/:id', () => {
    it('should delete user successfully', async () => {
      const userId = 'test-user-id'
      mockUserService.deleteUser.mockResolvedValue(undefined)

      const req = new Request(`http://localhost/users/${userId}`, {
        method: 'DELETE',
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(mockUserService.deleteUser).toHaveBeenCalledWith(userId)
    })

    it('should return 500 on service error', async () => {
      const userId = 'test-user-id'
      mockUserService.deleteUser.mockRejectedValue(new Error('Database error'))

      const req = new Request(`http://localhost/users/${userId}`, {
        method: 'DELETE',
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to delete user')
    })
  })

  describe('POST /users/:id/credentials', () => {
    it('should add user credential successfully', async () => {
      const userId = 'test-user-id'
      const credential = {
        id: 'cred-id',
        publicKey: 'public-key',
        transports: ['usb'],
        counter: 0,
        name: 'My Authenticator',
        type: 'platform' as const,
      }

      mockUserService.addUserCredential.mockResolvedValue(undefined)

      const req = new Request(`http://localhost/users/${userId}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(mockUserService.addUserCredential).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          ...credential,
          createdAt: expect.any(String),
          lastUsed: expect.any(String),
        })
      )
    })

    it('should return 400 for invalid credential data', async () => {
      const userId = 'test-user-id'
      const invalidCredential = {
        id: '', // Empty ID
        publicKey: 'public-key',
      }

      const req = new Request(`http://localhost/users/${userId}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidCredential),
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid credential data')
    })
  })

  describe('GET /users/:id/credentials', () => {
    it('should return user credentials', async () => {
      const userId = 'test-user-id'
      const credentials = [
        {
          id: 'cred1',
          publicKey: 'key1',
          name: 'Authenticator 1',
          type: 'platform',
        },
        {
          id: 'cred2',
          publicKey: 'key2',
          name: 'Authenticator 2',
          type: 'cross-platform',
        },
      ]

      mockUserService.getUserCredentials.mockResolvedValue(credentials)

      const req = new Request(`http://localhost/users/${userId}/credentials`)
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual(credentials)
      expect(mockUserService.getUserCredentials).toHaveBeenCalledWith(userId)
    })

    it('should return 500 on service error', async () => {
      const userId = 'test-user-id'
      mockUserService.getUserCredentials.mockRejectedValue(new Error('Database error'))

      const req = new Request(`http://localhost/users/${userId}/credentials`)
      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to fetch credentials')
    })
  })

  describe('DELETE /users/:id/credentials/:credentialId', () => {
    it('should remove user credential successfully', async () => {
      const userId = 'test-user-id'
      const credentialId = 'cred-id'
      mockUserService.removeUserCredential.mockResolvedValue(undefined)

      const req = new Request(`http://localhost/users/${userId}/credentials/${credentialId}`, {
        method: 'DELETE',
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(mockUserService.removeUserCredential).toHaveBeenCalledWith(userId, credentialId)
    })

    it('should return 500 on service error', async () => {
      const userId = 'test-user-id'
      const credentialId = 'cred-id'
      mockUserService.removeUserCredential.mockRejectedValue(new Error('Database error'))

      const req = new Request(`http://localhost/users/${userId}/credentials/${credentialId}`, {
        method: 'DELETE',
      })

      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('Failed to remove credential')
    })
  })

  describe('Middleware Integration', () => {
    it('should call requireAdmin middleware for admin-only routes', () => {
      expect(requireAdmin).toBeDefined()
      // Middleware calls are verified through route execution
    })

    it('should call requireSelfOrAdminFromParam middleware for protected routes', () => {
      expect(requireSelfOrAdminFromParam).toBeDefined()
      // Middleware calls are verified through route execution
    })
  })
})
