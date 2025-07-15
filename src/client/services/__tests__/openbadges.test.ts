import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenBadgesService } from '../openbadges'
import type { User } from '@/composables/useAuth'

describe('OpenBadgesService', () => {
  let service: OpenBadgesService
  let mockUser: User
  let mockFetch: any

  beforeEach(() => {
    vi.clearAllMocks()
    service = new OpenBadgesService()
    mockUser = {
      id: 'test-user',
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      avatar: undefined,
      isAdmin: false,
      createdAt: new Date().toISOString(),
      credentials: []
    }

    mockFetch = vi.fn()
    global.fetch = mockFetch
  })

  describe('getPlatformToken', () => {
    it('should get platform token successfully', async () => {
      const mockToken = 'test-jwt-token'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: mockToken })
      })

      const token = await service.getPlatformToken(mockUser)

      expect(token).toBe(mockToken)
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/platform-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: mockUser })
      })
    })

    it('should throw error when platform token request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await expect(service.getPlatformToken(mockUser)).rejects.toThrow('Failed to get platform token')
    })
  })

  describe('createApiClient', () => {
    it('should create API client with correct headers', async () => {
      const mockToken = 'test-jwt-token'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: mockToken })
      })

      const client = await service.createApiClient(mockUser)

      expect(client.token).toBe(mockToken)
      expect(client.headers).toEqual({
        'Authorization': `Bearer ${mockToken}`,
        'Content-Type': 'application/json'
      })
    })
  })

  describe('getUserBackpack', () => {
    it('should get user backpack successfully', async () => {
      const mockToken = 'test-jwt-token'
      const mockBackpack = {
        assertions: [
          { id: 'assertion-1', badgeClass: 'badge-1', recipient: 'test@example.com' }
        ],
        total: 1
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: mockToken })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockBackpack)
        })

      const backpack = await service.getUserBackpack(mockUser)

      expect(backpack).toEqual(mockBackpack)
      expect(mockFetch).toHaveBeenCalledWith('/api/badges/api/v1/assertions', {
        headers: {
          'Authorization': `Bearer ${mockToken}`,
          'Content-Type': 'application/json'
        }
      })
    })

    it('should throw error when backpack request fails', async () => {
      const mockToken = 'test-jwt-token'
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: mockToken })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        })

      await expect(service.getUserBackpack(mockUser)).rejects.toThrow('Failed to fetch user backpack')
    })
  })

  describe('addBadgeToBackpack', () => {
    it('should add badge to backpack successfully', async () => {
      const mockToken = 'test-jwt-token'
      const mockAssertion = {
        id: 'new-assertion',
        badgeClass: 'badge-class-1',
        recipient: 'test@example.com'
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: mockToken })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockAssertion)
        })

      const result = await service.addBadgeToBackpack(mockUser, 'badge-class-1', 'evidence', 'narrative')

      expect(result).toEqual(mockAssertion)
      expect(mockFetch).toHaveBeenCalledWith('/api/badges/api/v1/assertions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mockToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          badgeClass: 'badge-class-1',
          recipient: 'test@example.com',
          evidence: 'evidence',
          narrative: 'narrative'
        })
      })
    })

    it('should throw error when add badge request fails', async () => {
      const mockToken = 'test-jwt-token'
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: mockToken })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400
        })

      await expect(service.addBadgeToBackpack(mockUser, 'badge-class-1')).rejects.toThrow('Failed to add badge to backpack')
    })
  })

  describe('removeBadgeFromBackpack', () => {
    it('should remove badge from backpack successfully', async () => {
      const mockToken = 'test-jwt-token'
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: mockToken })
        })
        .mockResolvedValueOnce({
          ok: true
        })

      await service.removeBadgeFromBackpack(mockUser, 'assertion-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/badges/api/v1/assertions/assertion-1', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${mockToken}`,
          'Content-Type': 'application/json'
        }
      })
    })

    it('should throw error when remove badge request fails', async () => {
      const mockToken = 'test-jwt-token'
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: mockToken })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        })

      await expect(service.removeBadgeFromBackpack(mockUser, 'assertion-1')).rejects.toThrow('Failed to remove badge from backpack')
    })
  })

  describe('getBadgeClasses', () => {
    it('should get badge classes successfully', async () => {
      const mockBadgeClasses = [
        { id: 'badge-1', name: 'Badge 1' },
        { id: 'badge-2', name: 'Badge 2' }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBadgeClasses)
      })

      const badgeClasses = await service.getBadgeClasses()

      expect(badgeClasses).toEqual(mockBadgeClasses)
      expect(mockFetch).toHaveBeenCalledWith('/api/badges/v2/badge-classes')
    })

    it('should throw error when badge classes request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await expect(service.getBadgeClasses()).rejects.toThrow('Failed to fetch badge classes')
    })
  })

  describe('createBadgeClass', () => {
    it('should create badge class successfully', async () => {
      const mockToken = 'test-jwt-token'
      const mockBadgeClass = { name: 'New Badge', description: 'A new badge' }
      const mockCreatedBadge = { id: 'new-badge-id', ...mockBadgeClass }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: mockToken })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCreatedBadge)
        })

      const result = await service.createBadgeClass(mockUser, mockBadgeClass)

      expect(result).toEqual(mockCreatedBadge)
      expect(mockFetch).toHaveBeenCalledWith('/api/badges/v2/badge-classes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mockToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mockBadgeClass)
      })
    })

    it('should throw error when create badge class request fails', async () => {
      const mockToken = 'test-jwt-token'
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: mockToken })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400
        })

      await expect(service.createBadgeClass(mockUser, { name: 'Test Badge' })).rejects.toThrow('Failed to create badge class')
    })
  })

  describe('issueBadge', () => {
    it('should issue badge successfully', async () => {
      const mockToken = 'test-jwt-token'
      const mockIssuedBadge = {
        id: 'issued-badge-id',
        badgeClass: 'badge-class-1',
        recipient: 'recipient@example.com'
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: mockToken })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockIssuedBadge)
        })

      const result = await service.issueBadge(mockUser, 'badge-class-1', 'recipient@example.com', 'evidence', 'narrative')

      expect(result).toEqual(mockIssuedBadge)
      expect(mockFetch).toHaveBeenCalledWith('/api/badges/v2/assertions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mockToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          badgeClass: 'badge-class-1',
          recipient: 'recipient@example.com',
          evidence: 'evidence',
          narrative: 'narrative'
        })
      })
    })

    it('should throw error when issue badge request fails', async () => {
      const mockToken = 'test-jwt-token'
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: mockToken })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403
        })

      await expect(service.issueBadge(mockUser, 'badge-class-1', 'recipient@example.com')).rejects.toThrow('Failed to issue badge')
    })
  })
})