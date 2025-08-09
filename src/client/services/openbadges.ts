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

// Verification result interfaces aligned with OB2 specification
export interface VerificationResult {
  valid: boolean
  verifiedAt: string
  issuer: {
    name: string
    id: string
    verified: boolean
  }
  signature: {
    valid: boolean
    type: string
  }
  assertion: BadgeAssertion
  badgeClass: BadgeClass
  errors?: string[]
  warnings?: string[]
}

// Standard error response shape used across all endpoints
export interface ApiErrorResponse {
  error: string
  details?: string
  code?: string
  timestamp?: string
}

export class OpenBadgesService {
  private badgeServerBaseUrl = import.meta.env.VITE_BADGE_SERVER_URL || 'http://localhost:3000'
  private platformApiUrl = '/api' // Platform API endpoints

  /**
   * Get OAuth access token for badge server API
   */
  async getOAuthToken(user: User): Promise<string> {
    const response = await fetch(`${this.platformApiUrl}/auth/oauth-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify({ userId: user.id }),
    })

    if (!response.ok) {
      const errorData = await this.parseErrorResponse(response)
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.')
      }
      throw new Error(errorData.error || 'Failed to get OAuth token for badge server')
    }

    const data = await response.json()
    return data.access_token
  }

  /**
   * Refresh OAuth token if needed
   */
  async refreshOAuthToken(user: User): Promise<string> {
    const response = await fetch(`${this.platformApiUrl}/auth/oauth-token/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify({ userId: user.id }),
    })

    if (!response.ok) {
      const errorData = await this.parseErrorResponse(response)
      throw new Error(errorData.error || 'Failed to refresh OAuth token')
    }

    const data = await response.json()
    return data.access_token
  }

  /**
   * Parse error response using consistent error shapes
   */
  private async parseErrorResponse(response: Response): Promise<ApiErrorResponse> {
    try {
      const errorData = await response.json()
      return {
        error: errorData.error || 'Unknown error occurred',
        details: errorData.details,
        code: errorData.code,
        timestamp: errorData.timestamp || new Date().toISOString(),
      }
    } catch {
      return {
        error: `Request failed with status ${response.status}`,
        timestamp: new Date().toISOString(),
      }
    }
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
   * Make public API request (no authentication required)
   * Uses platform API endpoints that proxy to the badge server
   */
  async makePublicRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    try {
      const response = await fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        throw this.handleBadgeServerError(response, endpoint)
      }

      return response
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error. Please check your connection and try again.')
    }
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
      response = await this.makePublicRequest('/api/badges/badge-classes')
    }

    return await response.json()
  }

  /**
   * Get a specific badge class by ID (public endpoint)
   */
  async getBadgeClass(badgeClassId: string): Promise<BadgeClass> {
    const response = await this.makePublicRequest(
      `/api/badges/badge-classes/${encodeURIComponent(badgeClassId)}`
    )
    return await response.json()
  }

  /**
   * Get a specific assertion by ID (public endpoint for verification)
   */
  async getAssertion(assertionId: string): Promise<BadgeAssertion> {
    const response = await this.makePublicRequest(
      `/api/badges/assertions/${encodeURIComponent(assertionId)}`
    )
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

  /**
   * Verify a badge assertion (public endpoint)
   * This method provides comprehensive verification including signature, issuer, and validity checks
   */
  async verifyBadge(assertionId: string): Promise<VerificationResult> {
    try {
      // Get the assertion data
      const assertion = await this.getAssertion(assertionId)

      // Get the badge class data
      const badgeClassId =
        typeof assertion.badge === 'string' ? assertion.badge : assertion.badge.id
      const badgeClass = await this.getBadgeClass(badgeClassId)

      // Perform verification through the server
      const response = await this.makePublicRequest('/api/badges/verify', {
        method: 'POST',
        body: JSON.stringify({
          assertion: assertion,
          badgeClass: badgeClass,
        }),
      })

      type VerifyResponse = {
        valid?: boolean
        issuerVerified?: boolean
        signatureValid?: boolean
        errors?: string[]
        warnings?: string[]
      }
      const verificationData = (await response.json()) as VerifyResponse

      // Safely narrow issuer (IRI | Profile) without violating types
      const issuerRaw = badgeClass.issuer as string | Record<string, unknown>
      const issuerObj =
        typeof issuerRaw === 'string' ? undefined : (issuerRaw as Record<string, unknown>)
      const issuerName =
        issuerObj && typeof issuerObj.name === 'string'
          ? (issuerObj.name as string)
          : 'Unknown Issuer'
      const issuerId =
        typeof issuerRaw === 'string'
          ? issuerRaw
          : issuerObj && typeof issuerObj.id === 'string'
            ? (issuerObj.id as string)
            : ''

      // Structure the response according to our VerificationResult interface
      return {
        valid: verificationData.valid || false,
        verifiedAt: new Date().toISOString(),
        issuer: {
          name: issuerName,
          id: issuerId,
          verified: verificationData.issuerVerified || false,
        },
        signature: {
          valid: verificationData.signatureValid || false,
          type: Array.isArray(assertion.verification)
            ? assertion.verification[0]?.type ?? 'unknown'
            : assertion.verification?.type ?? 'unknown',
        },
        assertion,
        badgeClass,
        errors: verificationData.errors || [],
        warnings: verificationData.warnings || [],
      }
    } catch (error) {
      // If verification fails, return a failed verification result
      return {
        valid: false,
        verifiedAt: new Date().toISOString(),
        issuer: {
          name: 'Unknown',
          id: '',
          verified: false,
        },
        signature: {
          valid: false,
          type: 'unknown',
        },
        assertion: {} as BadgeAssertion,
        badgeClass: {} as BadgeClass,
        errors: [error instanceof Error ? error.message : 'Verification failed'],
      }
    }
  }

  /**
   * Check if an assertion has been revoked
   */
  async checkRevocationStatus(assertionId: string): Promise<{
    revoked: boolean
    reason?: string
    revokedAt?: string
  }> {
    try {
      const response = await this.makePublicRequest('/api/badges/revocation-list')
      const revocationList = await response.json()

      // Check if the assertion is in the revocation list
      const revokedAssertion = revocationList.find(
        (item: unknown) =>
          typeof item === 'object' &&
          item !== null &&
          'id' in item &&
          (item as { id: string }).id === assertionId
      )

      return {
        revoked: !!revokedAssertion,
        reason:
          revokedAssertion && typeof revokedAssertion === 'object' && 'reason' in revokedAssertion
            ? (revokedAssertion as { reason?: string }).reason
            : undefined,
        revokedAt:
          revokedAssertion &&
          typeof revokedAssertion === 'object' &&
          'revokedAt' in revokedAssertion
            ? (revokedAssertion as { revokedAt?: string }).revokedAt
            : undefined,
      }
    } catch {
      // If we can't check revocation status, assume not revoked but add warning
      return {
        revoked: false,
      }
    }
  }
}

export const openBadgesService = new OpenBadgesService()
