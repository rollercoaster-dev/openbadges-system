// Test stub for `bun:sqlite` to allow running server tests in Node
// Provides a minimal Database implementation used by src/server/services/user.ts

export class Database {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(filename?: string) {}

  exec(_sql: string): void {}

  prepare(_sql: string) {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      run: (..._params: unknown[]) => {},
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      get: (..._params: unknown[]) => undefined,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      all: (..._params: unknown[]) => [],
      finalize: () => {},
    }
  }

  close(): void {}
}

