import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Define a simpler JSON value type to avoid deep type recursion
type JSONValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: unknown }
  | unknown[];

// Initialize Hono app
const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173'], // Vite dev server
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper function to safely parse JSON
async function safeJsonResponse(response: Response): Promise<JSONValue> {
  try {
    const data = await response.json();

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
      return data as JSONValue;
    }

    // Fallback to empty object for invalid JSON values
    return {};
  } catch (error) {
    console.error('Error parsing JSON response:', error);
    return {};
  }
}

// Proxy endpoint for OpenBadges server
app.all('/api/bs/*', async (c) => {
  const url = new URL(
    c.req.path.replace('/api/bs', ''),
    'http://localhost:3000'
  );

  try {
    const response = await fetch(url.toString(), {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: c.req.raw.body,
    });

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      return new Response(text, { status: response.status });
    }

    const data = await safeJsonResponse(response);
    return c.json(data, response.status as any);
  } catch (error) {
    console.error('Error proxying request to OpenBadges server:', error);
    return c.json(
      { error: 'Failed to communicate with OpenBadges server' },
      500
    );
  }
});

// Start the server
const port = parseInt(process.env.PORT || '3030');
console.log(`Server is running on http://localhost:${port}`);

// Export for Bun to pick up
export default {
  port,
  fetch: app.fetch,
};
