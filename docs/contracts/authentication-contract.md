# Authentication Contract

P05 replaces the transitional `x-player-id` boundary for platform HTTP routes and realtime gateway handshakes.

## HTTP Session Model

- `POST /api/auth/register`
  - body: `{ email, password }`
  - behavior: creates a new authenticated player account, starts an opaque server-side session, and sets an `HttpOnly` session cookie
- `POST /api/auth/login`
  - body: `{ email, password }`
  - behavior: validates credentials, starts a new opaque server-side session, and sets an `HttpOnly` session cookie
- `GET /api/auth/session`
  - behavior: returns the authenticated player identity for the current session cookie
- `POST /api/auth/logout`
  - behavior: revokes the current opaque session and clears the cookie

Session cookie policy:

- cookie name: `gc_session`
- transport: `HttpOnly`
- same-site policy: `Lax`
- browser clients authenticate HTTP routes with the cookie; request bodies do not provide `playerId`

## Realtime Ticket Model

- `POST /api/auth/realtime-ticket`
  - auth required: valid session cookie
  - body: `{ clientType, clientVersion, platform }`
  - behavior: returns a short-lived, one-time realtime ticket

Gateway handshake model:

- websocket handshake payload identity source: `ticket`
- gateway resolves the ticket through `POST /api/internal/realtime/identity/resolve`
- successful resolution binds the returned authenticated `playerId` to the connection
- tickets are one-time use and fail once consumed, expired, or backed by a revoked session

## Internal Gateway Auth

- internal realtime routes require `x-realtime-gateway-secret`
- platform-api source of truth env var: `AUTH_GATEWAY_SHARED_SECRET`
- realtime-gateway source of truth env var: `PLATFORM_API_SHARED_SECRET`

## Transitional Test Shim

- production and development transport identity no longer trust `x-player-id`
- test-only helpers may still inject `x-player-id` while the remaining pre-P05 integration suite is migrated to real auth setup