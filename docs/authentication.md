# Authentication

Reconcile ships with a complete, stateless JWT authentication flow using
httpOnly cookies. This document explains how it works end-to-end.

## Overview

```
Register / Login
      │
      ▼
Backend verifies input → hashes/compares password (bcrypt)
      │
      ▼
Backend signs JWT (HS256) → sets httpOnly cookie `reconcile_token`
      │
      ▼
Browser stores cookie → sent automatically on every request
      │
      ▼
Backend JwtAuthGuard verifies cookie → user identified
Frontend middleware verifies cookie with jose → routes protected
```

## Components

### Backend

| Component                          | Responsibility                               |
| ---------------------------------- | -------------------------------------------- |
| `JwtAuthGuard` (global)            | Rejects requests without a valid token       |
| `@Public()` decorator              | Opts a route out of the global guard         |
| `@CurrentUser()` decorator         | Injects the decoded JWT payload into a route |
| `AuthService`                      | Business logic for register/login/logout     |
| `AuthController`                   | HTTP endpoints + cookie handling             |

### Frontend

| Component                        | Responsibility                               |
| -------------------------------- | -------------------------------------------- |
| `middleware.ts`                  | Server-side route protection using `jose`    |
| `AuthProvider` + `useAuth`       | Client-side auth state and actions           |
| `auth.service.ts`                | Typed calls to the auth endpoints            |

## Flow details

### Registration (`POST /api/v1/auth/register`)
1. Validates `{ email, fullName, password }` (password min 8 chars).
2. Rejects with **409** if the email is already registered.
3. Hashes the password with bcrypt (10 rounds).
4. Persists the user, then signs a JWT and sets the `reconcile_token`
   cookie - **exactly like login** (the shared `createSession` logic).
5. Returns `{ user, accessToken }` so the user is authenticated immediately
   and redirected straight to the dashboard. No second step is required.

### Login (`POST /api/v1/auth/login`)
1. Validates `{ email, password }`.
2. Compares the password hash; **401** on mismatch (same message for unknown
   email to avoid user enumeration).
3. Signs a JWT with claims `{ sub, email, fullName }`.
4. Sets the `reconcile_token` cookie and returns `{ user, accessToken }`.

Cookie options:

```ts
{
  httpOnly: true,
  secure: NODE_ENV === 'production', // HTTPS-only in production
  sameSite: 'lax',
  path: '/',
  maxAge: derived from JWT_EXPIRATION, // default 7d
}
```

### Current user (`GET /api/v1/auth/me`)
Protected by the global guard. Returns the profile for the token's `sub` claim,
or **401** if the user no longer exists.

### Logout (`POST /api/v1/auth/logout`)
Stateless. Clears the cookie. There is nothing to revoke server-side unless
you add a token blacklist (see "Extending").

## Cookie name

Both sides reference the same cookie name `reconcile_token`:

- Backend: `apps/backend/src/modules/auth/auth.constants.ts`
- Frontend: `apps/frontend/src/middleware.ts`

If you change it, update both.

## Route protection

| Route        | Backend  | Frontend middleware        |
| ------------ | -------- | -------------------------- |
| `/api/v1/auth/*` (public) | `@Public()` | -              |
| `/dashboard/*`            | guard   | verifies cookie → redirects to `/login` if invalid |
| `/login`, `/register`     | public  | redirects to `/dashboard` if already authenticated |

The frontend middleware is defense-in-depth; the backend guard is the source
of truth. Always protect data on the backend.

## Security considerations

- The JWT never reaches client-side JavaScript (httpOnly).
- `sameSite: 'lax'` mitigates CSRF for top-level navigation flows.
- Passwords are bcrypt-hashed; never store plain text.
- Use a 32+ character `JWT_SECRET`; rotate it if it is ever exposed.
- In production, cookies are `secure` (HTTPS only).

## Extending (e.g. refresh tokens)

The current flow uses a single short-lived access token in a cookie. To add
refresh tokens:

1. Store `{ userId, tokenHash, expiresAt }` in a `sessions` table.
2. Issue a refresh token on login alongside the access token.
3. Add a `POST /auth/refresh` endpoint that rotates the refresh token.
4. Keep both cookies httpOnly. Reuse the existing guard/validation patterns.
