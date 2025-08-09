import { nanoid } from 'nanoid'
import { URLSearchParams } from 'url'
import { webcrypto } from 'crypto'
import { TextEncoder } from 'util'
import { userService, User, OAuthProvider, OAuthSession } from './user'
import { oauthConfig, validateOAuthConfig } from '../config/oauth'

export interface OAuthProviderConfig {
  github?: {
    clientId: string
    clientSecret: string
    redirectUri: string
    scope: string[]
  }
  google?: {
    clientId: string
    clientSecret: string
    redirectUri: string
    scope: string[]
  }
  discord?: {
    clientId: string
    clientSecret: string
    redirectUri: string
    scope: string[]
  }
}

export interface OAuthUserProfile {
  id: string
  login: string
  email: string
  name: string
  avatar_url?: string
  provider?: string
}

export interface OAuthTokens {
  access_token: string
  refresh_token?: string
  expires_in?: number
  id_token?: string // For OpenID Connect providers like Google
}

export class OAuthService {
  public config: OAuthProviderConfig

  constructor(config: OAuthProviderConfig) {
    this.config = config
  }

  // Generate secure state parameter for OAuth flow
  generateState(): string {
    return nanoid(32)
  }

  // Generate code verifier for PKCE
  generateCodeVerifier(): string {
    return nanoid(128)
  }

  // Create code challenge from verifier
  async createCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    const digest = await webcrypto.subtle.digest('SHA-256', data)
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  // Create OAuth session
  async createOAuthSession(
    provider: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<{ state: string; session: OAuthSession }> {
    if (!userService) {
      throw new Error('User service not available')
    }

    const state = this.generateState()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    const session = await userService.createOAuthSession({
      state,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      provider,
      expires_at: expiresAt.toISOString(),
    })

    return { state, session }
  }

  // Get OAuth session
  async getOAuthSession(state: string): Promise<OAuthSession | null> {
    if (!userService) {
      throw new Error('User service not available')
    }

    const session = await userService.getOAuthSession(state)

    // Check if session has expired or been used (replay protection handled in userService)
    if (session && new Date(session.expires_at) < new Date()) {
      await userService.removeOAuthSession(state)
      return null
    }

    return session
  }

  // Mark OAuth session as used for replay protection
  async markOAuthSessionAsUsed(state: string): Promise<boolean> {
    if (!userService) {
      throw new Error('User service not available')
    }

    return await userService.markOAuthSessionAsUsed(state)
  }

  // Enhanced state validation
  validateStateFormat(state: string): boolean {
    // State should be 32 characters long (explicitly generated via nanoid for ~192 bits of entropy)
    if (!state || typeof state !== 'string' || state.length !== 32) {
      return false
    }
    
    // Check for valid nanoid characters (URL-safe base64)
    const nanoidPattern = /^[A-Za-z0-9_-]+$/
    return nanoidPattern.test(state)
  }

  // Remove OAuth session
  async removeOAuthSession(state: string): Promise<void> {
    if (!userService) {
      throw new Error('User service not available')
    }

    await userService.removeOAuthSession(state)
  }

  // Get GitHub authorization URL
  getGitHubAuthUrl(state: string, codeChallenge?: string): string {
    const config = this.config.github
    if (!config) {
      throw new Error('GitHub OAuth not configured')
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope.join(' '),
      state,
      response_type: 'code',
    })

    if (codeChallenge) {
      params.append('code_challenge', codeChallenge)
      params.append('code_challenge_method', 'S256')
    }

    return `https://github.com/login/oauth/authorize?${params.toString()}`
  }

  // Get Google authorization URL
  getGoogleAuthUrl(state: string, codeChallenge?: string): string {
    const config = this.config.google
    if (!config) {
      throw new Error('Google OAuth not configured')
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope.join(' '),
      state,
      response_type: 'code',
      access_type: 'offline', // To get refresh token
      prompt: 'consent', // To ensure refresh token is returned
    })

    if (codeChallenge) {
      params.append('code_challenge', codeChallenge)
      params.append('code_challenge_method', 'S256')
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  // Get Discord authorization URL
  getDiscordAuthUrl(state: string, codeChallenge?: string): string {
    const config = this.config.discord
    if (!config) {
      throw new Error('Discord OAuth not configured')
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope.join(' '),
      state,
      response_type: 'code',
    })

    if (codeChallenge) {
      params.append('code_challenge', codeChallenge)
      params.append('code_challenge_method', 'S256')
    }

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`
  }

  // Get authorization URL for any provider
  getAuthUrl(provider: string, state: string, codeChallenge?: string): string {
    switch (provider) {
      case 'github':
        return this.getGitHubAuthUrl(state, codeChallenge)
      case 'google':
        return this.getGoogleAuthUrl(state, codeChallenge)
      case 'discord':
        return this.getDiscordAuthUrl(state, codeChallenge)
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`)
    }
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(
    provider: string,
    code: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    switch (provider) {
      case 'github':
        return this.exchangeGitHubCode(code, codeVerifier)
      case 'google':
        return this.exchangeGoogleCode(code, codeVerifier)
      case 'discord':
        return this.exchangeDiscordCode(code, codeVerifier)
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`)
    }
  }

  // Exchange GitHub authorization code for access token
  private async exchangeGitHubCode(code: string, codeVerifier?: string): Promise<OAuthTokens> {
    const config = this.config.github
    if (!config) {
      throw new Error('GitHub OAuth not configured')
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    })

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier)
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      throw new Error(`GitHub token exchange failed: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`)
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    }
  }

  // Exchange Google authorization code for access token
  private async exchangeGoogleCode(code: string, codeVerifier?: string): Promise<OAuthTokens> {
    const config = this.config.google
    if (!config) {
      throw new Error('Google OAuth not configured')
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    })

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier)
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      throw new Error(`Google token exchange failed: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`Google OAuth error: ${data.error_description || data.error}`)
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      id_token: data.id_token,
    }
  }

  // Exchange Discord authorization code for access token
  private async exchangeDiscordCode(code: string, codeVerifier?: string): Promise<OAuthTokens> {
    const config = this.config.discord
    if (!config) {
      throw new Error('Discord OAuth not configured')
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    })

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier)
    }

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      throw new Error(`Discord token exchange failed: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`Discord OAuth error: ${data.error_description || data.error}`)
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    }
  }

  // Refresh token for providers that support it
  async refreshAccessToken(provider: string, refreshToken: string): Promise<OAuthTokens> {
    switch (provider) {
      case 'google':
        return this.refreshGoogleToken(refreshToken)
      case 'discord':
        return this.refreshDiscordToken(refreshToken)
      case 'github':
        throw new Error('GitHub does not support refresh tokens')
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`)
    }
  }

  // Refresh Google access token
  private async refreshGoogleToken(refreshToken: string): Promise<OAuthTokens> {
    const config = this.config.google
    if (!config) {
      throw new Error('Google OAuth not configured')
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      throw new Error(`Google token refresh failed: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`Google token refresh error: ${data.error_description || data.error}`)
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken, // Google may not return new refresh token
      expires_in: data.expires_in,
      id_token: data.id_token,
    }
  }

  // Refresh Discord access token
  private async refreshDiscordToken(refreshToken: string): Promise<OAuthTokens> {
    const config = this.config.discord
    if (!config) {
      throw new Error('Discord OAuth not configured')
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      throw new Error(`Discord token refresh failed: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`Discord token refresh error: ${data.error_description || data.error}`)
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    }
  }

  // Check if provider supports refresh tokens
  supportsRefreshTokens(provider: string): boolean {
    switch (provider) {
      case 'google':
      case 'discord':
        return true
      case 'github':
        return false
      default:
        return false
    }
  }

  // Get user profile from OAuth provider
  async getUserProfile(provider: string, accessToken: string): Promise<OAuthUserProfile> {
    switch (provider) {
      case 'github':
        return this.getGitHubUserProfile(accessToken)
      case 'google':
        return this.getGoogleUserProfile(accessToken)
      case 'discord':
        return this.getDiscordUserProfile(accessToken)
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`)
    }
  }

  // Get GitHub user profile
  private async getGitHubUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'OpenBadges-System',
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const profile = await response.json()

    // Get user's primary email if not public
    let email = profile.email
    if (!email) {
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'OpenBadges-System',
        },
      })

      if (emailResponse.ok) {
        const emails = await emailResponse.json()
        const primaryEmail = emails.find((e: { primary: boolean; email: string }) => e.primary)
        email = primaryEmail?.email || emails[0]?.email
      }
    }

    return {
      id: profile.id.toString(),
      login: profile.login,
      email,
      name: profile.name || profile.login,
      avatar_url: profile.avatar_url,
      provider: 'github',
    }
  }

  // Get Google user profile
  private async getGoogleUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`)
    }

    const profile = await response.json()

    return {
      id: profile.id,
      login: profile.email.split('@')[0], // Use email prefix as login
      email: profile.email,
      name: profile.name || profile.given_name || profile.email,
      avatar_url: profile.picture,
      provider: 'google',
    }
  }

  // Get Discord user profile
  private async getDiscordUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`)
    }

    const profile = await response.json()

    return {
      id: profile.id,
      login: profile.username,
      email: profile.email,
      name: profile.global_name || profile.username,
      avatar_url: profile.avatar 
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : undefined,
      provider: 'discord',
    }
  }

  // Link OAuth provider to existing user
  async linkOAuthProvider(
    userId: string,
    provider: string,
    providerUserId: string,
    tokens: OAuthTokens,
    profile: OAuthUserProfile
  ): Promise<OAuthProvider> {
    if (!userService) {
      throw new Error('User service not available')
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : undefined

    return await userService.createOAuthProvider({
      user_id: userId,
      provider,
      provider_user_id: providerUserId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      profile_data: JSON.stringify(profile),
    })
  }

  // Create user from OAuth profile
  async createUserFromOAuth(
    provider: string,
    providerUserId: string,
    tokens: OAuthTokens,
    profile: OAuthUserProfile
  ): Promise<{ user: User; oauthProvider: OAuthProvider }> {
    if (!userService) {
      throw new Error('User service not available')
    }

    // Create user
    const user = await userService.createUser({
      username: profile.login,
      email: profile.email,
      firstName: profile.name.split(' ')[0] || profile.login,
      lastName: profile.name.split(' ').slice(1).join(' ') || '',
      avatar: profile.avatar_url,
      isActive: true,
      roles: ['USER'],
    })

    // Link OAuth provider
    const oauthProvider = await this.linkOAuthProvider(
      user.id,
      provider,
      providerUserId,
      tokens,
      profile
    )

    return { user, oauthProvider }
  }

  // Find user by OAuth provider
  async findUserByOAuthProvider(provider: string, providerUserId: string): Promise<User | null> {
    if (!userService) {
      throw new Error('User service not available')
    }

    const oauthProvider = await userService.getOAuthProviderByProviderId(provider, providerUserId)
    if (!oauthProvider) {
      return null
    }

    return await userService.getUserById(oauthProvider.user_id)
  }

  // Clean up expired sessions
  async cleanupExpiredSessions(): Promise<void> {
    if (!userService) {
      throw new Error('User service not available')
    }

    await userService.cleanupExpiredOAuthSessions()
    await userService.cleanupUsedOAuthSessions()
  }

  // Initialize OAuth service (cleanup expired sessions)
  async initialize(): Promise<void> {
    try {
      await this.cleanupExpiredSessions()
      console.log('OAuth service initialized and expired sessions cleaned up')
    } catch (error) {
      console.error('OAuth service initialization failed:', error)
    }
  }

  // Get OAuth configuration summary (for diagnostics)
  getConfigSummary(): { [key: string]: boolean } {
    return {
      github: !!this.config.github,
      google: !!this.config.google,
      discord: !!this.config.discord,
    }
  }
}

// Validate OAuth configuration on startup
try {
  validateOAuthConfig()
} catch (error) {
  console.error('OAuth configuration validation failed:', error)
}

// Create OAuth service instance
export const oauthService = new OAuthService({
  github: oauthConfig.providers.github.enabled
    ? {
        clientId: oauthConfig.providers.github.clientId,
        clientSecret: oauthConfig.providers.github.clientSecret,
        redirectUri: oauthConfig.providers.github.callbackUrl,
        scope: oauthConfig.providers.github.scope,
      }
    : undefined,
  google: oauthConfig.providers.google.enabled
    ? {
        clientId: oauthConfig.providers.google.clientId,
        clientSecret: oauthConfig.providers.google.clientSecret,
        redirectUri: oauthConfig.providers.google.callbackUrl,
        scope: oauthConfig.providers.google.scope,
      }
    : undefined,
  discord: oauthConfig.providers.discord.enabled
    ? {
        clientId: oauthConfig.providers.discord.clientId,
        clientSecret: oauthConfig.providers.discord.clientSecret,
        redirectUri: oauthConfig.providers.discord.callbackUrl,
        scope: oauthConfig.providers.discord.scope,
      }
    : undefined,
})

// Initialize OAuth service
oauthService.initialize().catch(error => {
  console.error('Failed to initialize OAuth service:', error)
})
