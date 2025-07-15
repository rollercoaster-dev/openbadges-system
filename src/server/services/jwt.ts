import jwt from 'jsonwebtoken'
import { readFileSync } from 'fs'
import { join } from 'path'

interface PlatformUser {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  isAdmin: boolean
}

interface JWTPayload {
  sub: string // external user ID
  platformId: string
  displayName: string
  email: string
  metadata?: {
    firstName?: string
    lastName?: string
    isAdmin?: boolean
  }
}

export class JWTService {
  private privateKey: string
  private platformId: string
  private clientId: string

  constructor() {
    // Load private key from file
    try {
      this.privateKey = readFileSync(join(process.cwd(), 'keys', 'platform-private.pem'), 'utf8')
    } catch (error) {
      console.error('Failed to load private key:', error)
      throw new Error('Private key not found. Please run the setup script to generate keys.')
    }

    this.platformId = 'urn:uuid:a504d862-bd64-4e0d-acff-db7955955bc1'
    this.clientId = 'openbadges-demo-main-app'
  }

  /**
   * Generate JWT token for platform user authentication
   */
  generatePlatformToken(user: PlatformUser): string {
    const payload: JWTPayload = {
      sub: user.id,
      platformId: this.platformId,
      displayName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      metadata: {
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
      },
    }

    return jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
      issuer: this.clientId,
      expiresIn: '1h',
    })
  }

  /**
   * Verify JWT token (for debugging purposes)
   */
  verifyToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, this.privateKey) as JWTPayload
    } catch (error) {
      console.error('JWT verification failed:', error)
      return null
    }
  }

  /**
   * Create OpenBadges API client with platform authentication
   */
  createOpenBadgesApiClient(user: PlatformUser) {
    const token = this.generatePlatformToken(user)

    return {
      token,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  }
}

export const jwtService = new JWTService()
