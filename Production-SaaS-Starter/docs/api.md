# API Reference

Base URL: `http://localhost:3001/api/v1`

All responses use a uniform envelope:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "message" }
```

The interactive OpenAPI documentation is served by the backend at
`http://localhost:3001/docs`.

Error status codes you will encounter:

| Code | Meaning                                   |
| ---- | ----------------------------------------- |
| 400  | Validation failed (invalid fields)        |
| 401  | Missing or invalid token / bad credentials|
| 409  | Resource conflict (email already exists)  |
| 500  | Unexpected server error                   |

---

## Health

### `GET /health` — Public

Liveness probe. Returns 200 when the service is up.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-01-15T10:30:00.000Z",
    "service": "reconcile-api",
    "version": "0.1.0"
  }
}
```

---

## Auth

### `POST /auth/register` — Public

Creates a new account and immediately starts an authenticated session
(sets the `reconcile_token` cookie, exactly like login).

**Request body**

```json
{
  "fullName": "Jane Smith",
  "email": "jane@company.com",
  "password": "password123"
}
```

| Field      | Type   | Constraints                     |
| ---------- | ------ | ------------------------------- |
| `fullName` | string | 2–255 characters, required      |
| `email`    | string | valid email, 255 max, required  |
| `password` | string | 8–128 characters, required      |

**Response `201`**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d",
      "email": "jane@company.com",
      "fullName": "Jane Smith",
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-01-15T10:30:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors:** `409` if the email is already registered.

---

### `POST /auth/login` — Public

Verifies credentials, sets the `reconcile_token` httpOnly cookie, and
returns the user plus the raw token.

**Request body**

```json
{
  "email": "jane@company.com",
  "password": "password123"
}
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d",
      "email": "jane@company.com",
      "fullName": "Jane Smith",
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-01-15T10:30:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors:** `401` for invalid email or password (identical message to avoid
user enumeration).

---

### `GET /auth/me` — Protected

Returns the currently authenticated user (derived from the session cookie).

**Response `200`**

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d",
    "email": "jane@company.com",
    "fullName": "Jane Smith",
    "createdAt": "2026-01-15T10:30:00.000Z",
    "updatedAt": "2026-01-15T10:30:00.000Z"
  }
}
```

**Errors:** `401` when the token is missing or invalid.

---

### `POST /auth/logout` — Public

Clears the session cookie. Stateless - no server-side session is revoked.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

## Client-side usage

The frontend `apiClient` (`apps/frontend/src/lib/api.ts`) handles cookies,
error mapping, and envelope unwrapping automatically:

```ts
const user = await apiClient<UserResponseDto>('/auth/me');
```

For cURL:

```bash
# Login and save the cookie
curl -c cookies.txt -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@company.com","password":"password123"}'

# Use the cookie
curl -b cookies.txt http://localhost:3001/api/v1/auth/me
```
