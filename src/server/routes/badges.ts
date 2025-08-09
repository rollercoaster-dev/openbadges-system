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

// Public verification endpoint (no authentication required)
badgesRoutes.post('/verify', async c => {
  const openbadgesUrl = process.env.OPENBADGES_SERVER_URL || 'http://localhost:3000'

  try {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    // Forward verification request to OpenBadges server
    const response = await fetch(`${openbadgesUrl}/api/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text()
      return new Response(text, { status: response.status })
    }

    const data = await safeJsonResponse(response)
    return c.json(data, response.status as 200 | 201 | 400 | 401 | 403 | 404 | 500)
  } catch (error) {
    console.error('Error processing verification request:', error)
    return c.json(
      {
        valid: false,
        errors: ['Verification service temporarily unavailable'],
        verifiedAt: new Date().toISOString(),
      },
      500
    )
  }
})

// Public assertion retrieval endpoint (no authentication required)
badgesRoutes.get('/assertions/:id', async c => {
  const openbadgesUrl = process.env.OPENBADGES_SERVER_URL || 'http://localhost:3000'
  const assertionId = c.req.param('id')

  if (!assertionId) {
    return c.json({ error: 'Assertion ID is required' }, 400)
  }

  try {
    const response = await fetch(`${openbadgesUrl}/api/v1/assertions/${assertionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return c.json({ error: 'Assertion not found' }, 404)
      }
      return c.json({ error: 'Failed to retrieve assertion' }, response.status)
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text()
      return new Response(text, { status: response.status })
    }

    const data = await safeJsonResponse(response)
    return c.json(data, response.status as 200 | 201 | 400 | 401 | 403 | 404 | 500)
  } catch (error) {
    console.error('Error retrieving assertion:', error)
    return c.json({ error: 'Failed to retrieve assertion' }, 500)
  }
})

// Public badge class retrieval endpoint (no authentication required)
badgesRoutes.get('/badge-classes/:id', async c => {
  const openbadgesUrl = process.env.OPENBADGES_SERVER_URL || 'http://localhost:3000'
  const badgeClassId = c.req.param('id')

  if (!badgeClassId) {
    return c.json({ error: 'Badge class ID is required' }, 400)
  }

  try {
    const response = await fetch(`${openbadgesUrl}/api/v2/badge-classes/${badgeClassId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return c.json({ error: 'Badge class not found' }, 404)
      }
      return c.json({ error: 'Failed to retrieve badge class' }, response.status)
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text()
      return new Response(text, { status: response.status })
    }

    const data = await safeJsonResponse(response)
    return c.json(data, response.status as 200 | 201 | 400 | 401 | 403 | 404 | 500)
  } catch (error) {
    console.error('Error retrieving badge class:', error)
    return c.json({ error: 'Failed to retrieve badge class' }, 500)
  }
})

// Public revocation list endpoint (no authentication required)
badgesRoutes.get('/revocation-list', async c => {
  const openbadgesUrl = process.env.OPENBADGES_SERVER_URL || 'http://localhost:3000'

  try {
    const response = await fetch(`${openbadgesUrl}/api/v1/revocation-list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      // If revocation list is not available, return empty list
      return c.json([])
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return c.json([])
    }

    const data = await safeJsonResponse(response)
    return c.json(data, response.status as 200)
  } catch (error) {
    console.error('Error retrieving revocation list:', error)
    // If revocation service is unavailable, return empty list (fail open)
    return c.json([])
  }
})

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
