# OAuth Flows Robustness Improvements

## Overview

This document outlines the robustness improvements made to the OAuth authentication flows in the OpenBadges system. These improvements enhance security, prevent replay attacks, improve state/PKCE handling, and add support for additional OAuth providers.

## Key Improvements

### 1. State/PKCE Integrity and Expiry Enforcement

#### Enhanced State Validation
- **Format Validation**: State parameters are now validated for correct format (32-character nanoid)
- **Character Set Validation**: Ensures state uses valid URL-safe base64 characters
- **Automatic Expiry**: OAuth sessions now have automatic expiry (10 minutes default)
- **Cleanup**: Expired sessions are automatically cleaned up

#### PKCE Enforcement
- **Code Challenge Validation**: PKCE code challenges are properly validated
- **Code Verifier Storage**: Secure storage and validation of code verifiers
- **S256 Method**: Uses SHA256 for code challenge generation

### 2. Replay Attack Prevention

#### Session Usage Tracking
- **Used-At Timestamp**: OAuth sessions track when they've been used
- **Single-Use Sessions**: Each OAuth session can only be used once
- **Replay Detection**: Attempts to reuse sessions are detected and logged
- **Automatic Cleanup**: Used sessions are cleaned up after 1 hour

#### Database Schema Enhancements
```sql
ALTER TABLE oauth_sessions ADD COLUMN used_at TEXT;
CREATE INDEX idx_oauth_sessions_used_at ON oauth_sessions(used_at);
```

### 3. Additional Provider Scaffolds

#### Supported Providers
- **GitHub**: Existing provider with enhanced security
- **Google**: New provider with OpenID Connect support
- **Discord**: New provider with refresh token support

#### Configuration-Based Enabling
```bash
# Environment Variables
OAUTH_GOOGLE_ENABLED=true
OAUTH_GOOGLE_CLIENT_ID=your_google_client_id
OAUTH_GOOGLE_CLIENT_SECRET=your_google_client_secret
OAUTH_GOOGLE_CALLBACK_URL=http://localhost:8888/api/oauth/google/callback

OAUTH_DISCORD_ENABLED=true
OAUTH_DISCORD_CLIENT_ID=your_discord_client_id
OAUTH_DISCORD_CLIENT_SECRET=your_discord_client_secret
OAUTH_DISCORD_CALLBACK_URL=http://localhost:8888/api/oauth/discord/callback
```

### 4. Refresh Token Implementation

#### Provider Support
- **Google**: Full refresh token support with automatic token renewal
- **Discord**: Refresh token support for extended access
- **GitHub**: No refresh tokens (requires re-authentication)

#### Token Refresh Logic
- Automatic detection of refresh-capable providers
- Graceful handling of refresh failures
- Proper token storage and updates

## Security Enhancements

### State Parameter Security
```typescript
// Enhanced state validation
validateStateFormat(state: string): boolean {
  if (!state || typeof state !== 'string' || state.length !== 32) {
    return false
  }
  const nanoidPattern = /^[A-Za-z0-9_-]+$/
  return nanoidPattern.test(state)
}
```

### PKCE Implementation
```typescript
// Secure PKCE code challenge creation
async createCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await webcrypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}
```

### Replay Protection
```typescript
// Mark session as used
async markOAuthSessionAsUsed(state: string): Promise<boolean> {
  const now = new Date().toISOString()
  const changes = this.runQuery(
    'UPDATE oauth_sessions SET used_at = ? WHERE state = ? AND used_at IS NULL', 
    [now, state]
  )
  return changes > 0
}
```

## API Endpoints

### OAuth Initialization
- `GET /api/oauth/github` - Initialize GitHub OAuth flow
- `GET /api/oauth/google` - Initialize Google OAuth flow  
- `GET /api/oauth/discord` - Initialize Discord OAuth flow

### OAuth Callbacks
- `GET /api/oauth/github/callback` - Handle GitHub OAuth callback
- `GET /api/oauth/google/callback` - Handle Google OAuth callback
- `GET /api/oauth/discord/callback` - Handle Discord OAuth callback

### Token Management
- `POST /api/auth/oauth-token/refresh` - Refresh OAuth access tokens
- `GET /api/oauth/providers` - List available OAuth providers

## Configuration

### Required Environment Variables

#### Google OAuth
```bash
OAUTH_GOOGLE_ENABLED=true
OAUTH_GOOGLE_CLIENT_ID=your_google_client_id
OAUTH_GOOGLE_CLIENT_SECRET=your_google_client_secret
OAUTH_GOOGLE_CALLBACK_URL=http://localhost:8888/api/oauth/google/callback
```

#### Discord OAuth
```bash
OAUTH_DISCORD_ENABLED=true
OAUTH_DISCORD_CLIENT_ID=your_discord_client_id
OAUTH_DISCORD_CLIENT_SECRET=your_discord_client_secret
OAUTH_DISCORD_CALLBACK_URL=http://localhost:8888/api/oauth/discord/callback
```

## Error Handling

### Enhanced Error Responses
- **Invalid State Format**: Returns specific error for malformed state parameters
- **Replay Attempts**: Detects and logs replay attack attempts
- **Expired Sessions**: Automatic cleanup with informative error messages
- **Refresh Failures**: Graceful handling of token refresh failures

### Logging
- All OAuth security events are logged with appropriate severity levels
- Replay attempts trigger warning logs
- Failed authentications are tracked for security monitoring

## Testing Considerations

### Security Testing
- Test replay attack prevention
- Validate state parameter format checking
- Verify PKCE implementation
- Test session expiry handling

### Provider Testing
- Test each OAuth provider individually
- Verify refresh token functionality
- Test configuration-based provider enabling

## Migration Notes

### Database Updates
The database schema has been updated to support the new security features:
- Added `used_at` column to `oauth_sessions` table
- Added indexes for performance
- Made `state` column unique to prevent duplicates

### Backward Compatibility
- Existing OAuth sessions will continue to work
- New security features apply to new sessions only
- No breaking changes to existing API endpoints

## Monitoring and Maintenance

### Automatic Cleanup
- Expired sessions are cleaned up on service initialization
- Used sessions are cleaned up after 1 hour
- Regular cleanup prevents database bloat

### Health Checks
- OAuth service provides configuration summary
- Service initialization status is logged
- Provider availability can be checked via `/providers` endpoint

## Best Practices

### Development
- Always test OAuth flows in development environment
- Use HTTPS in production for all OAuth redirects
- Regularly rotate OAuth client secrets

### Production
- Monitor OAuth error rates and replay attempts
- Set up alerts for unusual OAuth activity
- Regularly review and update provider configurations

### Security
- Implement rate limiting on OAuth endpoints
- Monitor for suspicious state parameter patterns
- Regularly audit OAuth provider configurations