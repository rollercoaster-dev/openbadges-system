import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { userRoutes } from './routes/users'
import { authRoutes } from './routes/auth'
import { badgesRoutes } from './routes/badges'
import { oauthRoutes } from './routes/oauth'
import { requireAuth } from './middleware/auth'

// Define a simpler JSON value type to avoid deep type recursion
type JSONValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: unknown }
  | unknown[]

// Initialize Hono app
const app = new Hono()

// Middleware
app.use('*', logger())
app.use(
  '*',
  cors({
    origin: ['http://localhost:7777'], // Vite dev server
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
)

// Health check endpoint
app.get('/api/health', c => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Mount routes
app.route('/api/bs/users', userRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/badges', badgesRoutes)
app.route('/api/oauth', oauthRoutes)

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

// Proxy endpoint for OpenBadges server (excluding user routes)
const proxyRequiresAuth = (process.env.OPENBADGES_PROXY_PUBLIC ?? 'false') !== 'true'

app.all('/api/bs/*', proxyRequiresAuth ? requireAuth : (c, next) => next(), async c => {
  // Skip user management endpoints - they are handled by userRoutes
  if (c.req.path.startsWith('/api/bs/users')) {
    return c.json({ error: 'Route not found' }, 404)
  }

  const openbadgesUrl = process.env.OPENBADGES_SERVER_URL || 'http://localhost:3000'
  const url = new URL(c.req.path.replace('/api/bs', ''), openbadgesUrl)

  try {
    // Configure headers based on environment
    const headers = new Headers(c.req.raw.headers)

    // Add authentication if enabled
    const authEnabled = process.env.OPENBADGES_AUTH_ENABLED !== 'false'
    const authMode = process.env.OPENBADGES_AUTH_MODE || 'docker'

    if (authEnabled) {
      if (authMode === 'docker') {
        // Docker mode: use Basic Auth
        headers.set('Authorization', 'Basic ' + btoa('admin:admin-user'))
      } else if (authMode === 'local') {
        // Local mode: add API key or basic auth if provided
        const apiKey = process.env.OPENBADGES_API_KEY
        const basicUser = process.env.OPENBADGES_BASIC_AUTH_USER
        const basicPass = process.env.OPENBADGES_BASIC_AUTH_PASS

        if (apiKey) {
          headers.set('X-API-Key', apiKey)
        } else if (basicUser && basicPass) {
          headers.set('Authorization', 'Basic ' + btoa(`${basicUser}:${basicPass}`))
        }
      }
    }

    const response = await fetch(url.toString(), {
      method: c.req.method,
      headers,
      body: c.req.raw.body,
    })

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text()
      return new Response(text, { status: response.status })
    }

    const data = await safeJsonResponse(response)
    return c.json(data, response.status as 200 | 201 | 400 | 401 | 403 | 404 | 500)
  } catch (error) {
    console.error('Error proxying request to OpenBadges server:', error)
    console.error('Server URL:', openbadgesUrl)
    console.error('Request path:', c.req.path)
    return c.json({ error: 'Failed to communicate with local OpenBadges server' }, 500)
  }
})

// Start the server
const port = parseInt(process.env.PORT || '8888')
console.log(`Server is running on http://localhost:${port}`)

// Export for Bun to pick up
export default {
  port,
  fetch: app.fetch,
}
