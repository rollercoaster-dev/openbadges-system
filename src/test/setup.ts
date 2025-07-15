import { beforeEach, vi } from 'vitest'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock WebAuthn API
Object.defineProperty(window, 'navigator', {
  value: {
    credentials: {
      create: vi.fn(),
      get: vi.fn(),
    },
  },
})

// Mock fetch
global.fetch = vi.fn()

// Clear all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.getItem.mockReturnValue(null)
})