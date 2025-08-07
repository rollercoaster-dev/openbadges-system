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
  private publicKey: string
  private platformId: string
  private clientId: string

  constructor() {
    const envPrivate =
      process.env.PLATFORM_JWT_PRIVATE_KEY || process.env.PLATFORM_JWT_PRIVATE_KEY_B64
    const envPublic = process.env.PLATFORM_JWT_PUBLIC_KEY || process.env.PLATFORM_JWT_PUBLIC_KEY_B64

    // Prefer environment-provided keys; support base64 variants
    const decodeMaybeB64 = (val?: string): string | null => {
      if (!val) return null
      try {
        // Heuristic: if ends with '=' or lacks PEM header, try base64 decode
        if (!val.includes('BEGIN') && /[A-Za-z0-9+/=]/.test(val)) {
          return Buffer.from(val, 'base64').toString('utf8')
        }
        return val
      } catch {
        return val
      }
    }

    const privateFromEnv = decodeMaybeB64(envPrivate)
    const publicFromEnv = decodeMaybeB64(envPublic)

    if (privateFromEnv && publicFromEnv) {
      this.privateKey = privateFromEnv
      this.publicKey = publicFromEnv
    } else {
      // Fallback to filesystem for local/dev only
      try {
        this.privateKey = readFileSync(join(process.cwd(), 'keys', 'platform-private.pem'), 'utf8')
      } catch {
        if (process.env.NODE_ENV !== 'test') {
          console.error('Private key unavailable (env/fs).')
        }
        throw new Error(
          'Private key not configured. Set PLATFORM_JWT_PRIVATE_KEY or provide keys/platform-private.pem'
        )
      }

      try {
        this.publicKey = readFileSync(join(process.cwd(), 'keys', 'platform-public.pem'), 'utf8')
      } catch {
        if (process.env.NODE_ENV !== 'test') {
          console.error('Public key unavailable (env/fs).')
        }
        throw new Error(
          'Public key not configured. Set PLATFORM_JWT_PUBLIC_KEY or provide keys/platform-public.pem'
        )
      }
    }

    this.platformId = process.env.PLATFORM_ID || 'urn:uuid:a504d862-bd64-4e0d-acff-db7955955bc1'
    this.clientId = process.env.PLATFORM_CLIENT_ID || 'openbadges-demo-main-app'
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
   * Verify JWT token using the public key
   *
   * @param token - JWT token to verify
   * @returns Decoded JWT payload or null if verification fails
   * @note This method uses the public key for secure token verification
   */
  verifyToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: this.clientId,
      }) as JWTPayload
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('JWT verification failed:', error)
      }
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
