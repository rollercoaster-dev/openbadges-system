import type { User } from '@/composables/useAuth'
import type { OB2 } from 'openbadges-types'

export interface OpenBadgesApiClient {
  token: string
  headers: Record<string, string>
}

// Use official Open Badges types
export type BadgeAssertion = OB2.Assertion
export type BadgeClass = OB2.BadgeClass

export interface UserBackpack {
  assertions: BadgeAssertion[]
  total: number
}

export interface OAuthTokenInfo {
  access_token: string
  refresh_token?: string
  expires_at?: string
  provider: string
}

export class OpenBadgesService {
  private badgeServerBaseUrl = import.meta.env.VITE_BADGE_SERVER_URL || 'http://localhost:3000'

  /**
   * Get OAuth access token for badge server API
   */
  async getOAuthToken(user: User): Promise<string> {
    const response = await fetch('/api/auth/oauth-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify({ userId: user.id }),
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.')
      }
      throw new Error('Failed to get OAuth token for badge server')
    }

    const data = await response.json()
    return data.access_token
  }

  /**
   * Refresh OAuth token if needed
   */
  async refreshOAuthToken(user: User): Promise<string> {
    const response = await fetch('/api/auth/oauth-token/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify({ userId: user.id }),
    })

    if (!response.ok) {
      throw new Error('Failed to refresh OAuth token')
    }

    const data = await response.json()
    return data.access_token
  }

  /**
   * Handle badge server API errors with user-friendly messages
   */
  private handleBadgeServerError(response: Response, _endpoint: string): Error {
    switch (response.status) {
      case 400:
        return new Error('Invalid request. Please check your input and try again.')
      case 401:
        return new Error('Authentication failed. Please log in again.')
      case 403:
        return new Error('Permission denied. You do not have access to this resource.')
      case 404:
        return new Error('Resource not found. The requested item may not exist.')
      case 409:
        return new Error('Conflict. The resource already exists or there is a conflict.')
      case 429:
        return new Error('Too many requests. Please wait a moment and try again.')
      case 500:
        return new Error('Badge server error. Please try again later.')
      case 502:
      case 503:
      case 504:
        return new Error('Badge server is temporarily unavailable. Please try again later.')
      default:
        return new Error(`Badge server request failed (${response.status}). Please try again.`)
    }
  }

  /**
   * Make authenticated API request with token refresh support
   */
  async makeAuthenticatedRequest(
    user: User,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    let token: string

    try {
      token = await this.getOAuthToken(user)
    } catch {
      throw new Error('Failed to authenticate with badge server. Please log in again.')
    }

    const makeRequest = async (authToken: string) => {
      try {
        return await fetch(`${this.badgeServerBaseUrl}${endpoint}`, {
          ...options,
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            ...options.headers,
          },
        })
      } catch {
        throw new Error('Network error. Please check your connection and try again.')
      }
    }

    let response: Response

    response = await makeRequest(token)

    // If token expired, try to refresh and retry once
    if (response.status === 401) {
      try {
        token = await this.refreshOAuthToken(user)
        response = await makeRequest(token)
      } catch {
        throw new Error('Authentication failed. Please log in again.')
      }
    }

    // Handle other error statuses
    if (!response.ok) {
      throw this.handleBadgeServerError(response, endpoint)
    }

    return response
  }

  /**
   * Create API client for authenticated user
   */
  async createApiClient(user: User): Promise<OpenBadgesApiClient> {
    const token = await this.getOAuthToken(user)

    return {
      token,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  }

  /**
   * Get user's badge backpack
   */
  async getUserBackpack(user: User): Promise<UserBackpack> {
    const response = await this.makeAuthenticatedRequest(user, '/api/v1/assertions')
    return await response.json()
  }

  /**
   * Add badge assertion to user's backpack
   */
  async addBadgeToBackpack(
    user: User,
    badgeClassId: string,
    evidence?: string,
    narrative?: string
  ): Promise<BadgeAssertion> {
    const response = await this.makeAuthenticatedRequest(user, '/api/v1/assertions', {
      method: 'POST',
      body: JSON.stringify({
        badgeClass: badgeClassId,
        recipient: user.email,
        evidence,
        narrative,
      }),
    })

    return await response.json()
  }

  /**
   * Remove badge assertion from user's backpack
   */
  async removeBadgeFromBackpack(user: User, assertionId: string): Promise<void> {
    await this.makeAuthenticatedRequest(user, `/api/v1/assertions/${assertionId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Get badge classes available for issuance
   */
  async getBadgeClasses(user?: User): Promise<unknown[]> {
    let response: Response

    if (user) {
      response = await this.makeAuthenticatedRequest(user, '/api/v2/badge-classes')
    } else {
      // Public endpoint - no authentication required
      try {
        response = await fetch(`${this.badgeServerBaseUrl}/api/v2/badge-classes`)
        if (!response.ok) {
          throw this.handleBadgeServerError(response, '/api/v2/badge-classes')
        }
      } catch {
        throw new Error('Network error. Please check your connection and try again.')
      }
    }

    return await response.json()
  }

  /**
   * Create new badge class
   */
  async createBadgeClass(user: User, badgeClass: unknown): Promise<unknown> {
    const response = await this.makeAuthenticatedRequest(user, '/api/v2/badge-classes', {
      method: 'POST',
      body: JSON.stringify(badgeClass),
    })

    return await response.json()
  }

  /**
   * Issue badge to user
   */
  async issueBadge(
    issuerUser: User,
    badgeClassId: string,
    recipientEmail: string,
    evidence?: string,
    narrative?: string
  ): Promise<BadgeAssertion> {
    const response = await this.makeAuthenticatedRequest(issuerUser, '/api/v2/assertions', {
      method: 'POST',
      body: JSON.stringify({
        badgeClass: badgeClassId,
        recipient: recipientEmail,
        evidence,
        narrative,
      }),
    })

    return await response.json()
  }
}

export const openBadgesService = new OpenBadgesService()
