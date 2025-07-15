import { Hono } from 'hono';
import { jwtService } from '../services/jwt';

const authRoutes = new Hono();

// Generate platform token for OpenBadges API
authRoutes.post('/platform-token', async (c) => {
  try {
    const { user } = await c.req.json();
    
    if (!user || !user.id || !user.email) {
      return c.json({ error: 'Invalid user data' }, 400);
    }

    const apiClient = jwtService.createOpenBadgesApiClient(user);
    
    return c.json({
      success: true,
      token: apiClient.token,
      platformId: 'urn:uuid:a504d862-bd64-4e0d-acff-db7955955bc1'
    });
  } catch (error) {
    console.error('Platform token generation failed:', error);
    return c.json({ error: 'Failed to generate platform token' }, 500);
  }
});

export { authRoutes };
