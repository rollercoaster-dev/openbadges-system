import { vi } from 'vitest'

// Make legacy /api/bs proxy public during tests to avoid auth requirements
process.env.OPENBADGES_PROXY_PUBLIC = 'true'

// Ensure fetch exists in node environment tests
if (typeof global.fetch === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(global as any).fetch = vi.fn()
}

// Mock sqlite3 to avoid native bindings if any code path imports it
vi.mock('sqlite3', () => ({
  Database: vi.fn().mockImplementation(() => ({
    prepare: vi.fn().mockReturnValue({
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
      finalize: vi.fn(),
    }),
    exec: vi.fn(),
    close: vi.fn(),
  })),
}))

// Mock bun:sqlite so that accidental imports do not explode in Node env
vi.mock('bun:sqlite', () => ({
  Database: vi.fn().mockImplementation(() => ({
    prepare: vi.fn().mockReturnValue({
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
    }),
    exec: vi.fn(),
    close: vi.fn(),
  })),
}))
