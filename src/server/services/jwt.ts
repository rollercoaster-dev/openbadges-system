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
  private tokenIssuer: string
  private tokenAudience?: string
  private clockToleranceSec: number

  constructor() {
    const envPrivate =
      process.env.PLATFORM_JWT_PRIVATE_KEY || process.env.PLATFORM_JWT_PRIVATE_KEY_B64
    const envPublic = process.env.PLATFORM_JWT_PUBLIC_KEY || process.env.PLATFORM_JWT_PUBLIC_KEY_B64

    // Prefer environment-provided keys; support strict base64 variants
    const BASE64_FULL_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
    const decodeMaybeB64 = (val?: string, which?: 'private' | 'public'): string | null => {
      if (!val) return null
      const trimmed = val.trim()
      // If it already looks like a PEM, return as-is
      if (trimmed.includes('-----BEGIN ')) return trimmed
      // Only attempt decode if the entire string matches base64
      if (BASE64_FULL_RE.test(trimmed)) {
        try {
          const decoded = Buffer.from(trimmed, 'base64').toString('utf8')
          return decoded
        } catch (err) {
          if (process.env.NODE_ENV !== 'test') {
            console.error(
              `Failed to base64 decode ${which ?? 'key'}:`,
              err instanceof Error ? err.message : err
            )
          }
          // Surface the error to avoid masking misconfiguration
          throw err
        }
      }
      return trimmed
    }

    const privateFromEnv = decodeMaybeB64(envPrivate, 'private')
    const publicFromEnv = decodeMaybeB64(envPublic, 'public')

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
    // Issuer defaults to clientId for backwards compatibility; can be overridden
    this.tokenIssuer = process.env.PLATFORM_JWT_ISSUER || this.clientId
    // Audience is optional; when set, both sign and verify will enforce it
    this.tokenAudience = process.env.PLATFORM_JWT_AUDIENCE || undefined
    this.clockToleranceSec = Number(process.env.JWT_CLOCK_TOLERANCE_SEC || '0') || 0
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
      issuer: this.tokenIssuer,
      audience: this.tokenAudience,
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
      const options: any = {
        algorithms: ['RS256'],
        issuer: this.tokenIssuer,
        clockTolerance: this.clockToleranceSec,
      }
      if (this.tokenAudience) {
        options.audience = this.tokenAudience
      }
      return jwt.verify(token, this.publicKey, options) as JWTPayload
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
