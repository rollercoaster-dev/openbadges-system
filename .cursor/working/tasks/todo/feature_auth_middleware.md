# Task: AuthN/AuthZ Middleware

- Priority: P0
- Branch: `feature/auth-middleware`
- Estimate: 0.5 day

## Goal

Add JWT-based authentication and role-based authorization middleware. Protect server routes; enforce admin checks for privileged operations.

## Scope

- Create `src/server/middleware/auth.ts` with:
  - `requireAuth`: verifies RS256 JWT via `jwtService.verifyToken`, attaches payload to context (e.g., `c.set('auth', payload)`)
  - `requireAdmin`: ensures `payload.metadata?.isAdmin === true`
  - `requireSelfOrAdmin(paramName: string)`: ensures `payload.sub === param` or admin
- Apply middleware to routes:
  - `src/server/routes/users.ts`:
    - GET `/` and GET `/:id`: `requireAdmin` (or consider `requireAuth` + self-only when `:id` matches)
    - POST `/`, PUT `/:id`, DELETE `/:id`: `requireAdmin`
    - Credentials endpoints: `requireSelfOrAdmin('id')`
  - `src/server/routes/auth.ts`:
    - `/oauth-token`, `/oauth-token/refresh`: `requireSelfOrAdmin` on body.userId
    - `/sync-user`: `requireSelfOrAdmin` on body.userId
    - `/badge-server-profile/:userId`: `requireSelfOrAdmin('userId')`
  - `src/server/index.ts` proxy `/api/bs/*`:
    - Gate with `requireAuth` (optional toggle via `OPENBADGES_PROXY_PUBLIC=false`), default to require auth
- Standardize 401/403 responses from middleware (no sensitive info).

## Tests

- Unit tests for middleware logic (valid, missing, malformed, expired tokens; admin vs non-admin)
- Integration tests for protected routes:
  - Users routes: admin allowed; non-admin denied; self credential ops allowed
  - Auth routes: self or admin allowed; others denied
  - Proxy gate: unauthorized access gets 401 if enabled

## Notes

- Tokens come from `Authorization: Bearer <token>`; reuse existing `jwtService` claims (uses `metadata.isAdmin`).
- Keep responses consistent with existing error JSON format.
