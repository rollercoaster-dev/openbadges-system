import { Hono } from 'hono'
import { oauthService } from '../services/oauth'
import { userService } from '../services/user'
import { userSyncService } from '../services/userSync'
import { jwtService } from '../services/jwt'

const oauthRoutes = new Hono()

// Get available OAuth providers
oauthRoutes.get('/providers', async c => {
  try {
    const providers = []
    
    if (oauthService.config?.github) providers.push('github')
    if (oauthService.config?.google) providers.push('google')
    if (oauthService.config?.discord) providers.push('discord')

    return c.json({
      success: true,
      providers,
    })
  } catch (error) {
    console.error('Failed to get OAuth providers:', error)
    return c.json(
      {
        success: false,
        error: 'Failed to get OAuth providers',
      },
      500
    )
  }
})

// Initialize GitHub OAuth flow
oauthRoutes.get('/github', async c => {
  try {
    const redirectUri = c.req.query('redirect_uri') || '/'

    // Create OAuth session with PKCE
    const codeVerifier = oauthService.generateCodeVerifier()
    const codeChallenge = await oauthService.createCodeChallenge(codeVerifier)

    const { state } = await oauthService.createOAuthSession('github', redirectUri, codeVerifier)

    // Get GitHub authorization URL
    const authUrl = oauthService.getGitHubAuthUrl(state, codeChallenge)

    return c.json({
      success: true,
      authUrl,
      state,
    })
  } catch (error) {
    console.error('GitHub OAuth initialization failed:', error)
    return c.json(
      {
        success: false,
        error: 'Failed to initialize GitHub OAuth',
      },
      500
    )
  }
})

// Initialize Google OAuth flow
oauthRoutes.get('/google', async c => {
  try {
    if (!oauthService.config?.google) {
      return c.json(
        {
          success: false,
          error: 'Google OAuth not configured',
        },
        501
      )
    }

    const redirectUri = c.req.query('redirect_uri') || '/'

    // Create OAuth session with PKCE
    const codeVerifier = oauthService.generateCodeVerifier()
    const codeChallenge = await oauthService.createCodeChallenge(codeVerifier)

    const { state } = await oauthService.createOAuthSession('google', redirectUri, codeVerifier)

    // Get Google authorization URL
    const authUrl = oauthService.getGoogleAuthUrl(state, codeChallenge)

    return c.json({
      success: true,
      authUrl,
      state,
    })
  } catch (error) {
    console.error('Google OAuth initialization failed:', error)
    return c.json(
      {
        success: false,
        error: 'Failed to initialize Google OAuth',
      },
      500
    )
  }
})

// Initialize Discord OAuth flow
oauthRoutes.get('/discord', async c => {
  try {
    if (!oauthService.config?.discord) {
      return c.json(
        {
          success: false,
          error: 'Discord OAuth not configured',
        },
        501
      )
    }

    const redirectUri = c.req.query('redirect_uri') || '/'

    // Create OAuth session with PKCE
    const codeVerifier = oauthService.generateCodeVerifier()
    const codeChallenge = await oauthService.createCodeChallenge(codeVerifier)

    const { state } = await oauthService.createOAuthSession('discord', redirectUri, codeVerifier)

    // Get Discord authorization URL
    const authUrl = oauthService.getDiscordAuthUrl(state, codeChallenge)

    return c.json({
      success: true,
      authUrl,
      state,
    })
  } catch (error) {
    console.error('Discord OAuth initialization failed:', error)
    return c.json(
      {
        success: false,
        error: 'Failed to initialize Discord OAuth',
      },
      500
    )
  }
})

// Handle GitHub OAuth callback
oauthRoutes.get('/github/callback', async c => {
  try {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')

    if (error) {
      console.error('GitHub OAuth error:', error)
      return c.json(
        {
          success: false,
          error: `GitHub OAuth error: ${error}`,
        },
        400
      )
    }

    if (!code || !state) {
      return c.json(
        {
          success: false,
          error: 'Missing code or state parameter',
        },
        400
      )
    }

    // Enhanced state validation
    if (!oauthService.validateStateFormat(state)) {
      const maskedState = `${state.slice(0, 4)}...${state.slice(-4)}`
      console.warn(`Invalid state format received: ${maskedState}`)
      return c.json(
        {
          success: false,
          error: 'Invalid state parameter format',
        },
        400
      )
    }

    // Verify OAuth session and check for replay attacks
    const session = await oauthService.getOAuthSession(state)
    if (!session) {
      return c.json(
        {
          success: false,
          error: 'Invalid or expired OAuth session',
        },
        400
      )
    }

    // Mark session as used to prevent replay attacks
    const wasMarked = await oauthService.markOAuthSessionAsUsed(state)
    if (!wasMarked) {
      console.warn(`OAuth session replay attempt detected: ${state}`)
      return c.json(
        {
          success: false,
          error: 'Session has already been used',
        },
        409
      )
    }

    // Validate PKCE if code verifier exists
    if (session.code_verifier) {
      // Note: GitHub OAuth callback doesn't include code_challenge, 
      // so we'll validate it during token exchange
      console.debug('PKCE flow detected; provider will validate during token exchange')
    }

    // Exchange code for access token
    const tokens = await oauthService.exchangeCodeForToken('github', code, session.code_verifier)

    // Get user profile from GitHub
    const profile = await oauthService.getUserProfile('github', tokens.access_token)

    // Check if user already exists with this GitHub account
    let user = await oauthService.findUserByOAuthProvider('github', profile.id)
    if (user) {
      // User exists, update OAuth provider tokens
      const existingProvider = await userService?.getOAuthProvider(user.id, 'github')
      if (existingProvider) {
        const expiresAt = tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : undefined

        await userService?.updateOAuthProvider(existingProvider.id, {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          profile_data: JSON.stringify(profile),
        })
      }
    } else {
      // Check if user exists with same email
      user = (await userService?.getUserByEmail(profile.email)) || null

      if (user) {
        // Link OAuth provider to existing user
        await oauthService.linkOAuthProvider(user.id, 'github', profile.id, tokens, profile)
      } else {
        // Create new user from OAuth profile
        const result = await oauthService.createUserFromOAuth('github', profile.id, tokens, profile)
        user = result.user
        // OAuth provider is created within the service, no need to store reference
      }
    }

    // Clean up OAuth session (after successful use)
    await oauthService.removeOAuthSession(state)

    // Sync user with badge server
    try {
      const syncResult = await userSyncService.syncUser(user)
      if (syncResult.success) {
        console.log('User synced with badge server:', syncResult.created ? 'created' : 'updated')
      } else {
        console.warn('Failed to sync user with badge server:', syncResult.error)
      }
    } catch (syncError) {
      console.error('Error syncing user with badge server:', syncError)
    }

    // Generate JWT token for authentication
    const jwtToken = jwtService.generatePlatformToken({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: user.roles?.includes('ADMIN') || false,
    })

    // Check if this is an API request or browser redirect
    const acceptHeader = c.req.header('Accept')
    const isApiRequest = acceptHeader && acceptHeader.includes('application/json')

    if (isApiRequest) {
      // Return JSON response for API requests
      return c.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          isAdmin: user.roles.includes('ADMIN'),
          roles: user.roles,
        },
        token: jwtToken,
        redirectUri: session.redirect_uri || '/',
      })
    } else {
      // Redirect to frontend callback page with authentication data
      const userData = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isAdmin: user.roles.includes('ADMIN'),
        roles: user.roles,
      }

      // Create a secure way to pass auth data to frontend
      // For now, we'll use URL params (in production, consider using encrypted cookies or session storage)
      const callbackUrl = new URL('/auth/oauth/callback', c.req.url)
      callbackUrl.searchParams.set('success', 'true')
      callbackUrl.searchParams.set('token', jwtToken)
      callbackUrl.searchParams.set('user', encodeURIComponent(JSON.stringify(userData)))
      callbackUrl.searchParams.set('redirect_uri', session.redirect_uri || '/')

      return c.redirect(callbackUrl.toString())
    }
  } catch (error) {
    console.error('GitHub OAuth callback failed:', error)
    return c.json(
      {
        success: false,
        error: 'OAuth authentication failed',
      },
      500
    )
  }
})

// Handle Google OAuth callback
oauthRoutes.get('/google/callback', async c => {
  try {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')

    if (error) {
      console.error('Google OAuth error:', error)
      return c.json(
        {
          success: false,
          error: `Google OAuth error: ${error}`,
        },
        400
      )
    }

    if (!code || !state) {
      return c.json(
        {
          success: false,
          error: 'Missing code or state parameter',
        },
        400
      )
    }

    // Enhanced state validation
    if (!oauthService.validateStateFormat(state)) {
      const maskedState = `${state.slice(0, 4)}...${state.slice(-4)}`
      console.warn(`Invalid state format received: ${maskedState}`)
      return c.json(
        {
          success: false,
          error: 'Invalid state parameter format',
        },
        400
      )
    }

    // Verify OAuth session and check for replay attacks
    const session = await oauthService.getOAuthSession(state)
    if (!session) {
      return c.json(
        {
          success: false,
          error: 'Invalid or expired OAuth session',
        },
        400
      )
    }

    // Mark session as used to prevent replay attacks
    const wasMarked = await oauthService.markOAuthSessionAsUsed(state)
    if (!wasMarked) {
      console.warn(`OAuth session replay attempt detected: ${state}`)
      return c.json(
        {
          success: false,
          error: 'Session has already been used',
        },
        409
      )
    }

    // Exchange code for access token
    const tokens = await oauthService.exchangeCodeForToken('google', code, session.code_verifier)

    // Get user profile from Google
    const profile = await oauthService.getUserProfile('google', tokens.access_token)

    // Check if user already exists with this Google account
    let user = await oauthService.findUserByOAuthProvider('google', profile.id)
    if (user) {
      // User exists, update OAuth provider tokens
      const existingProvider = await userService?.getOAuthProvider(user.id, 'google')
      if (existingProvider) {
        const expiresAt = tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : undefined

        await userService?.updateOAuthProvider(existingProvider.id, {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          profile_data: JSON.stringify(profile),
        })
      }
    } else {
      // Check if user exists with same email
      user = (await userService?.getUserByEmail(profile.email)) || null

      if (user) {
        // Link OAuth provider to existing user
        await oauthService.linkOAuthProvider(user.id, 'google', profile.id, tokens, profile)
      } else {
        // Create new user from OAuth profile
        const result = await oauthService.createUserFromOAuth('google', profile.id, tokens, profile)
        user = result.user
      }
    }

    // Clean up OAuth session (after successful use)
    await oauthService.removeOAuthSession(state)

    // Sync user with badge server
    try {
      const syncResult = await userSyncService.syncUser(user)
      if (syncResult.success) {
        console.log('User synced with badge server:', syncResult.created ? 'created' : 'updated')
      } else {
        console.warn('Failed to sync user with badge server:', syncResult.error)
      }
    } catch (syncError) {
      console.error('Error syncing user with badge server:', syncError)
    }

    // Generate JWT token for authentication
    const jwtToken = jwtService.generatePlatformToken({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: user.roles?.includes('ADMIN') || false,
    })

    // Check if this is an API request or browser redirect
    const acceptHeader = c.req.header('Accept')
    const isApiRequest = acceptHeader && acceptHeader.includes('application/json')

    if (isApiRequest) {
      // Return JSON response for API requests
      return c.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          isAdmin: user.roles.includes('ADMIN'),
          roles: user.roles,
        },
        token: jwtToken,
        redirectUri: session.redirect_uri || '/',
      })
    } else {
      // Redirect to frontend callback page with authentication data
      const userData = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isAdmin: user.roles.includes('ADMIN'),
        roles: user.roles,
      }

      const callbackUrl = new URL('/auth/oauth/callback', c.req.url)
      callbackUrl.searchParams.set('success', 'true')
      callbackUrl.searchParams.set('token', jwtToken)
      callbackUrl.searchParams.set('user', encodeURIComponent(JSON.stringify(userData)))
      callbackUrl.searchParams.set('redirect_uri', session.redirect_uri || '/')

      return c.redirect(callbackUrl.toString())
    }
  } catch (error) {
    console.error('Google OAuth callback failed:', error)
    return c.json(
      {
        success: false,
        error: 'OAuth authentication failed',
      },
      500
    )
  }
})

// Handle Discord OAuth callback
oauthRoutes.get('/discord/callback', async c => {
  try {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')

    if (error) {
      console.error('Discord OAuth error:', error)
      return c.json(
        {
          success: false,
          error: `Discord OAuth error: ${error}`,
        },
        400
      )
    }

    if (!code || !state) {
      return c.json(
        {
          success: false,
          error: 'Missing code or state parameter',
        },
        400
      )
    }

    // Enhanced state validation
    if (!oauthService.validateStateFormat(state)) {
      const maskedState = `${state.slice(0, 4)}...${state.slice(-4)}`
      console.warn(`Invalid state format received: ${maskedState}`)
      return c.json(
        {
          success: false,
          error: 'Invalid state parameter format',
        },
        400
      )
    }

    // Verify OAuth session and check for replay attacks
    const session = await oauthService.getOAuthSession(state)
    if (!session) {
      return c.json(
        {
          success: false,
          error: 'Invalid or expired OAuth session',
        },
        400
      )
    }

    // Mark session as used to prevent replay attacks
    const wasMarked = await oauthService.markOAuthSessionAsUsed(state)
    if (!wasMarked) {
      console.warn(`OAuth session replay attempt detected: ${state}`)
      return c.json(
        {
          success: false,
          error: 'Session has already been used',
        },
        409
      )
    }

    // Exchange code for access token
    const tokens = await oauthService.exchangeCodeForToken('discord', code, session.code_verifier)

    // Get user profile from Discord
    const profile = await oauthService.getUserProfile('discord', tokens.access_token)

    // Check if user already exists with this Discord account
    let user = await oauthService.findUserByOAuthProvider('discord', profile.id)
    if (user) {
      // User exists, update OAuth provider tokens
      const existingProvider = await userService?.getOAuthProvider(user.id, 'discord')
      if (existingProvider) {
        const expiresAt = tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : undefined

        await userService?.updateOAuthProvider(existingProvider.id, {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          profile_data: JSON.stringify(profile),
        })
      }
    } else {
      // Check if user exists with same email
      user = (await userService?.getUserByEmail(profile.email)) || null

      if (user) {
        // Link OAuth provider to existing user
        await oauthService.linkOAuthProvider(user.id, 'discord', profile.id, tokens, profile)
      } else {
        // Create new user from OAuth profile
        const result = await oauthService.createUserFromOAuth('discord', profile.id, tokens, profile)
        user = result.user
      }
    }

    // Clean up OAuth session (after successful use)
    await oauthService.removeOAuthSession(state)

    // Sync user with badge server
    try {
      const syncResult = await userSyncService.syncUser(user)
      if (syncResult.success) {
        console.log('User synced with badge server:', syncResult.created ? 'created' : 'updated')
      } else {
        console.warn('Failed to sync user with badge server:', syncResult.error)
      }
    } catch (syncError) {
      console.error('Error syncing user with badge server:', syncError)
    }

    // Generate JWT token for authentication
    const jwtToken = jwtService.generatePlatformToken({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: user.roles?.includes('ADMIN') || false,
    })

    // Check if this is an API request or browser redirect
    const acceptHeader = c.req.header('Accept')
    const isApiRequest = acceptHeader && acceptHeader.includes('application/json')

    if (isApiRequest) {
      // Return JSON response for API requests
      return c.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          isAdmin: user.roles.includes('ADMIN'),
          roles: user.roles,
        },
        token: jwtToken,
        redirectUri: session.redirect_uri || '/',
      })
    } else {
      // Redirect to frontend callback page with authentication data
      const userData = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isAdmin: user.roles.includes('ADMIN'),
        roles: user.roles,
      }

      const callbackUrl = new URL('/auth/oauth/callback', c.req.url)
      callbackUrl.searchParams.set('success', 'true')
      callbackUrl.searchParams.set('token', jwtToken)
      callbackUrl.searchParams.set('user', encodeURIComponent(JSON.stringify(userData)))
      callbackUrl.searchParams.set('redirect_uri', session.redirect_uri || '/')

      return c.redirect(callbackUrl.toString())
    }
  } catch (error) {
    console.error('Discord OAuth callback failed:', error)
    return c.json(
      {
        success: false,
        error: 'OAuth authentication failed',
      },
      500
    )
  }
})

// Unlink OAuth provider
oauthRoutes.delete('/:provider', async c => {
  try {
    const provider = c.req.param('provider')
    const userId = c.req.query('user_id')

    if (!userId) {
      return c.json(
        {
          success: false,
          error: 'User ID required',
        },
        400
      )
    }

    // Remove OAuth provider
    await userService?.removeOAuthProvider(userId, provider)

    return c.json({
      success: true,
      message: `${provider} account unlinked successfully`,
    })
  } catch (error) {
    console.error('Failed to unlink OAuth provider:', error)
    return c.json(
      {
        success: false,
        error: 'Failed to unlink OAuth provider',
      },
      500
    )
  }
})

// Get user's linked OAuth providers
oauthRoutes.get('/user/:userId/providers', async c => {
  try {
    const userId = c.req.param('userId')

    if (!userService) {
      return c.json(
        {
          success: false,
          error: 'User service not available',
        },
        500
      )
    }

    // Get all OAuth providers for user
    const providers = []

    const githubProvider = await userService.getOAuthProvider(userId, 'github')
    if (githubProvider) {
      providers.push({
        provider: 'github',
        linked: true,
        profile: githubProvider.profile_data ? JSON.parse(githubProvider.profile_data) : null,
        linked_at: githubProvider.created_at,
      })
    }

    return c.json({
      success: true,
      providers,
    })
  } catch (error) {
    console.error('Failed to get user OAuth providers:', error)
    return c.json(
      {
        success: false,
        error: 'Failed to get OAuth providers',
      },
      500
    )
  }
})

// Clean up expired OAuth sessions (admin endpoint)
oauthRoutes.post('/cleanup', async c => {
  try {
    await oauthService.cleanupExpiredSessions()

    return c.json({
      success: true,
      message: 'Expired OAuth sessions cleaned up',
    })
  } catch (error) {
    console.error('Failed to cleanup OAuth sessions:', error)
    return c.json(
      {
        success: false,
        error: 'Failed to cleanup OAuth sessions',
      },
      500
    )
  }
})

export { oauthRoutes }
