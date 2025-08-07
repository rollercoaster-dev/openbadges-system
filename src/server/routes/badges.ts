import { Hono } from 'hono'
import { jwtService } from '../services/jwt'

const badgesRoutes = new Hono()

// Define a simpler JSON value type to avoid deep type recursion
type JSONValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: unknown }
  | unknown[]

// Helper function to safely parse JSON
async function safeJsonResponse(response: Response): Promise<JSONValue> {
  try {
    const data = await response.json()

    // Basic type checking for JSONValue
    if (
      data === null ||
      data === undefined ||
      typeof data === 'string' ||
      typeof data === 'number' ||
      typeof data === 'boolean' ||
      Array.isArray(data) ||
      (typeof data === 'object' && !Array.isArray(data))
    ) {
      return data as JSONValue
    }

    // Fallback to empty object for invalid JSON values
    return {}
  } catch (error) {
    console.error('Error parsing JSON response:', error)
    return {}
  }
}

// OpenBadges API proxy with platform authentication
badgesRoutes.all('/*', async c => {
  const openbadgesUrl = process.env.OPENBADGES_SERVER_URL || 'http://localhost:3000'
  const path = c.req.path.replace('/api/badges', '')
  const url = new URL(path, openbadgesUrl)

  try {
    // Get platform token from Authorization header
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Platform token required' }, 401)
    }

    // Verify platform token before proxying
    const token = authHeader.slice('Bearer '.length)
    const payload = jwtService.verifyToken(token)
    if (!payload) {
      return c.json({ error: 'Invalid platform token' }, 401)
    }

    const headers = new Headers(c.req.raw.headers)
    // Forward the platform token to OpenBadges server
    headers.set('Authorization', authHeader)

    const response = await fetch(url.toString(), {
      method: c.req.method,
      headers,
      body: c.req.raw.body,
    })

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text()
      return new Response(text, { status: response.status })
    }

    const data = await safeJsonResponse(response)
    return c.json(data, response.status as 200 | 201 | 400 | 401 | 403 | 404 | 500)
  } catch (error) {
    console.error('Error proxying badges request:', error)
    return c.json({ error: 'Failed to communicate with OpenBadges server' }, 500)
  }
})

export { badgesRoutes }
