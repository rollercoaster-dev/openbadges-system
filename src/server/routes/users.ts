import { Hono } from 'hono'
import { userService } from '../services/user'

const userRoutes = new Hono()

// Get all users with pagination and filtering
userRoutes.get('/', async c => {
  if (!userService) {
    return c.json({ error: 'User service unavailable' }, 503)
  }
  try {
    const page = parseInt(c.req.query('page') || '1') || 1
    const limit = parseInt(c.req.query('limit') || '10') || 10
    const search = c.req.query('search') || ''
    const filters = {
      role: c.req.query('role'),
      status: c.req.query('status'),
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
    }

    const { users, total } = await userService.getUsers(page, limit, search, filters)
    return c.json({ users, total })
  } catch (err) {
    console.error('Error fetching users:', err)
    return c.json({ error: 'Failed to fetch users' }, 500)
  }
})

// Create new user
userRoutes.post('/', async c => {
  if (!userService) {
    return c.json({ error: 'User service unavailable' }, 503)
  }
  try {
    const userData = await c.req.json()
    const newUser = await userService.createUser(userData)
    return c.json(newUser, 201)
  } catch (err) {
    console.error('Error creating user:', err)
    return c.json({ error: 'Failed to create user' }, 500)
  }
})

// Get user by ID
userRoutes.get('/:id', async c => {
  if (!userService) {
    return c.json({ error: 'User service unavailable' }, 503)
  }
  try {
    const userId = c.req.param('id')
    const user = await userService.getUserById(userId)
    if (!user) return c.json({ error: 'User not found' }, 404)
    return c.json(user)
  } catch (err) {
    console.error('Error fetching user by ID:', err)
    return c.json({ error: 'Failed to fetch user' }, 500)
  }
})

// Update user
userRoutes.put('/:id', async c => {
  if (!userService) {
    return c.json({ error: 'User service unavailable' }, 503)
  }
  try {
    const userId = c.req.param('id')
    const userData = await c.req.json()
    const updatedUser = await userService.updateUser(userId, userData)
    if (!updatedUser) return c.json({ error: 'User not found' }, 404)
    return c.json(updatedUser)
  } catch (err) {
    console.error('Error updating user:', err)
    return c.json({ error: 'Failed to update user' }, 500)
  }
})

// Delete user
userRoutes.delete('/:id', async c => {
  if (!userService) {
    return c.json({ error: 'User service unavailable' }, 503)
  }
  try {
    const userId = c.req.param('id')
    await userService.deleteUser(userId)
    return c.json({ success: true })
  } catch (err) {
    console.error('Error deleting user:', err)
    return c.json({ error: 'Failed to delete user' }, 500)
  }
})

// Add user credential
userRoutes.post('/:id/credentials', async c => {
  if (!userService) {
    return c.json({ error: 'User service unavailable' }, 503)
  }
  try {
    const userId = c.req.param('id')
    const credentialData = await c.req.json()
    await userService.addUserCredential(userId, credentialData)
    return c.json({ success: true })
  } catch (err) {
    console.error('Error adding user credential:', err)
    return c.json({ error: 'Failed to add credential' }, 500)
  }
})

// Get user credentials
userRoutes.get('/:id/credentials', async c => {
  if (!userService) {
    return c.json({ error: 'User service unavailable' }, 503)
  }
  try {
    const userId = c.req.param('id')
    const credentials = await userService.getUserCredentials(userId)
    return c.json(credentials)
  } catch (err) {
    console.error('Error fetching user credentials:', err)
    return c.json({ error: 'Failed to fetch credentials' }, 500)
  }
})

// Remove user credential
userRoutes.delete('/:id/credentials/:credentialId', async c => {
  if (!userService) {
    return c.json({ error: 'User service unavailable' }, 503)
  }
  try {
    const userId = c.req.param('id')
    const credentialId = c.req.param('credentialId')
    await userService.removeUserCredential(userId, credentialId)
    return c.json({ success: true })
  } catch (err) {
    console.error('Error removing user credential:', err)
    return c.json({ error: 'Failed to remove credential' }, 500)
  }
})

export { userRoutes }
