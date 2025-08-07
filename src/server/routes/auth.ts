import { Hono } from 'hono'
import { jwtService } from '../services/jwt'
import { userService } from '../services/user'
import { userSyncService } from '../services/userSync'

const authRoutes = new Hono()

// Generate platform token for OpenBadges API
authRoutes.post('/platform-token', async c => {
  try {
    const { user } = await c.req.json()

    if (!user || !user.id || !user.email) {
      return c.json({ error: 'Invalid user data' }, 400)
    }

    const apiClient = jwtService.createOpenBadgesApiClient(user)

    return c.json({
      success: true,
      token: apiClient.token,
      platformId: 'urn:uuid:a504d862-bd64-4e0d-acff-db7955955bc1',
    })
  } catch (error) {
    console.error('Platform token generation failed:', error)
    return c.json({ error: 'Failed to generate platform token' }, 500)
  }
})

// Get OAuth access token for badge server
authRoutes.post('/oauth-token', async c => {
  try {
    const { userId } = await c.req.json()

    if (!userId) {
      return c.json({ error: 'User ID is required' }, 400)
    }

    // Get user's OAuth providers
    const oauthProviders = await userService?.getOAuthProvidersByUser(userId)

    if (!oauthProviders || oauthProviders.length === 0) {
      return c.json({ error: 'No OAuth providers found for user' }, 404)
    }

    // For now, use the first available provider (typically GitHub)
    const provider = oauthProviders[0]
    if (!provider) {
      return c.json({ error: 'No OAuth provider available' }, 404)
    }

    // Check if token is still valid (not expired)
    if (provider.token_expires_at && new Date(provider.token_expires_at) <= new Date()) {
      return c.json({ error: 'OAuth token expired' }, 401)
    }

    return c.json({
      success: true,
      access_token: provider.access_token,
      provider: provider.provider,
      expires_at: provider.token_expires_at,
    })
  } catch (error) {
    console.error('OAuth token retrieval failed:', error)
    return c.json({ error: 'Failed to get OAuth token' }, 500)
  }
})

// Refresh OAuth access token
authRoutes.post('/oauth-token/refresh', async c => {
  try {
    const { userId } = await c.req.json()

    if (!userId) {
      return c.json({ error: 'User ID is required' }, 400)
    }

    // Get user's OAuth providers
    const oauthProviders = await userService?.getOAuthProvidersByUser(userId)

    if (!oauthProviders || oauthProviders.length === 0) {
      return c.json({ error: 'No OAuth providers found for user' }, 404)
    }

    // For now, use the first available provider (typically GitHub)
    const provider = oauthProviders[0]
    if (!provider) {
      return c.json({ error: 'No OAuth provider available' }, 404)
    }

    if (!provider.refresh_token) {
      return c.json({ error: 'No refresh token available' }, 400)
    }

    // Refresh the token with the OAuth provider
    // Note: GitHub doesn't provide refresh tokens, so this is more relevant for other providers
    // For GitHub, users would need to re-authenticate if token expires
    if (provider.provider === 'github') {
      return c.json({ error: 'GitHub tokens cannot be refreshed. Please re-authenticate.' }, 400)
    }

    // For other providers, implement token refresh logic here
    return c.json({ error: 'Token refresh not implemented for this provider' }, 501)
  } catch (error) {
    console.error('OAuth token refresh failed:', error)
    return c.json({ error: 'Failed to refresh OAuth token' }, 500)
  }
})

// Sync user data with badge server
authRoutes.post('/sync-user', async c => {
  try {
    const { userId } = await c.req.json()

    if (!userId) {
      return c.json({ error: 'User ID is required' }, 400)
    }

    // Get user from local database
    const user = await userService?.getUserById(userId)
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Sync user with badge server
    const syncResult = await userSyncService.syncUser(user)

    if (syncResult.success) {
      return c.json({
        success: true,
        user: syncResult.user,
        created: syncResult.created,
        updated: syncResult.updated,
      })
    } else {
      return c.json(
        {
          success: false,
          error: syncResult.error,
        },
        500
      )
    }
  } catch (error) {
    console.error('User sync failed:', error)
    return c.json({ error: 'Failed to sync user' }, 500)
  }
})

// Get badge server user profile
authRoutes.get('/badge-server-profile/:userId', async c => {
  try {
    const userId = c.req.param('userId')

    if (!userId) {
      return c.json({ error: 'User ID is required' }, 400)
    }

    const profile = await userSyncService.getBadgeServerUserProfile(userId)

    if (profile) {
      return c.json({
        success: true,
        profile,
      })
    } else {
      return c.json(
        {
          success: false,
          error: 'Profile not found',
        },
        404
      )
    }
  } catch (error) {
    console.error('Failed to get badge server profile:', error)
    return c.json({ error: 'Failed to get profile' }, 500)
  }
})

export { authRoutes }
