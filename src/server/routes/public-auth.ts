import { Hono } from 'hono'
import { z } from 'zod'
import { userService } from '../services/user'
import { jwtService } from '../services/jwt'

const publicAuthRoutes = new Hono()

// Schemas
const userLookupSchema = z
  .object({
    username: z.string().optional(),
    email: z.string().email().optional(),
  })
  .refine(data => data.username || data.email, {
    message: 'Either username or email must be provided',
  })

const userCreateSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  avatar: z.string().url().optional(),
  isActive: z.boolean().default(true),
  roles: z.array(z.string()).default(['USER']),
})

const credentialSchema = z.object({
  id: z.string().min(1),
  publicKey: z.string().min(1),
  transports: z.array(z.string()).default([]),
  counter: z.number().int().nonnegative().default(0),
  createdAt: z.string().default(() => new Date().toISOString()),
  lastUsed: z.string().default(() => new Date().toISOString()),
  name: z.string().min(1),
  type: z.enum(['platform', 'cross-platform']),
})

// Public endpoint to check if user exists (for WebAuthn registration)
publicAuthRoutes.get('/users/lookup', async c => {
  if (!userService) {
    return c.json({ error: 'User service unavailable' }, 503)
  }

  try {
    const query = c.req.query()
    const parsed = userLookupSchema.safeParse(query)

    if (!parsed.success) {
      return c.json({ error: 'Username or email parameter required' }, 400)
    }

    const { username, email } = parsed.data
    let user = null

    if (username) {
      user = await userService.getUserByUsername(username)
    } else if (email) {
      user = await userService.getUserByEmail(email)
    }

    if (user) {
      // Return minimal user info for lookup
      return c.json({
        exists: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          isAdmin: user.roles.includes('ADMIN'),
          createdAt: user.createdAt,
          credentials: await userService.getUserCredentials(user.id),
        },
      })
    } else {
      return c.json({ exists: false })
    }
  } catch (err) {
    console.error('Error looking up user:', err)
    return c.json({ error: 'Failed to lookup user' }, 500)
  }
})

// Public endpoint to create new user (for WebAuthn registration)
publicAuthRoutes.post('/users/register', async c => {
  if (!userService) {
    return c.json({ error: 'User service unavailable' }, 503)
  }

  try {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    const parsed = userCreateSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid user data', details: parsed.error.issues }, 400)
    }

    // Check if user already exists
    const existingByUsername = await userService.getUserByUsername(parsed.data.username)
    if (existingByUsername) {
      return c.json({ error: 'Username already exists' }, 409)
    }

    const existingByEmail = await userService.getUserByEmail(parsed.data.email)
    if (existingByEmail) {
      return c.json({ error: 'Email already exists' }, 409)
    }

    // Create new user
    const newUser = await userService.createUser(parsed.data)

    return c.json(
      {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        avatar: newUser.avatar,
        isAdmin: newUser.roles.includes('ADMIN'),
        createdAt: newUser.createdAt,
        credentials: [],
      },
      201
    )
  } catch (err) {
    console.error('Error creating user:', err)
    return c.json({ error: 'Failed to create user' }, 500)
  }
})

// Public endpoint to add credential to user (for WebAuthn registration)
publicAuthRoutes.post('/users/:id/credentials', async c => {
  if (!userService) {
    return c.json({ error: 'User service unavailable' }, 503)
  }

  try {
    const userId = c.req.param('id')

    // Verify user exists
    const user = await userService.getUserById(userId)
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    const parsed = credentialSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid credential data', details: parsed.error.issues }, 400)
    }

    await userService.addUserCredential(userId, parsed.data)
    return c.json({ success: true })
  } catch (err) {
    console.error('Error adding user credential:', err)
    return c.json({ error: 'Failed to add credential' }, 500)
  }
})

// Public endpoint to update credential last used time (for WebAuthn authentication)
publicAuthRoutes.patch('/users/:userId/credentials/:credentialId', async c => {
  if (!userService) {
    return c.json({ error: 'User service unavailable' }, 503)
  }

  try {
    const userId = c.req.param('userId')
    const credentialId = c.req.param('credentialId')

    // Verify user exists
    const user = await userService.getUserById(userId)
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    const updateSchema = z.object({
      lastUsed: z.string(),
    })

    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid update data' }, 400)
    }

    // Update credential last used time
    await userService.updateUserCredential(userId, credentialId, { lastUsed: parsed.data.lastUsed })
    return c.json({ success: true })
  } catch (err) {
    console.error('Error updating credential:', err)
    return c.json({ error: 'Failed to update credential' }, 500)
  }
})

// Public endpoint to generate JWT token for WebAuthn authenticated users
publicAuthRoutes.post('/users/:id/token', async c => {
  if (!userService) {
    return c.json({ error: 'User service unavailable' }, 503)
  }

  try {
    const userId = c.req.param('id')

    // Verify user exists
    const user = await userService.getUserById(userId)
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Generate JWT token for this user
    const platformUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: user.roles.includes('ADMIN'),
    }

    const token = jwtService.generatePlatformToken(platformUser)

    return c.json({
      success: true,
      token,
      platformId: 'urn:uuid:a504d862-bd64-4e0d-acff-db7955955bc1',
    })
  } catch (err) {
    console.error('Error generating token:', err)
    return c.json({ error: 'Failed to generate token' }, 500)
  }
})

export { publicAuthRoutes }
