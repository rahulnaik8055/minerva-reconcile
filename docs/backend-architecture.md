# Backend Architecture

## Stack

- **NestJS 10** - modular, opinionated Node.js framework.
- **@nestjs/config + Joi** - environment validation at boot (`src/config/env.validation.ts`). A missing `DATABASE_URL` or a `JWT_SECRET` shorter than 32 characters fails fast.
- **Drizzle ORM + pg** - SQL-first, type-safe data access. Connection provided globally via a custom provider in `src/database/database.module.ts`.
- **@nestjs/jwt + bcrypt** - JWT signing/verification and password hashing (10 rounds).
- **@nestjs/swagger** - OpenAPI document served at `/docs`.
- **Winston (via nest-winston)** - structured logging. Human-readable colored output in development, JSON output in production. Nest's own `Logger` is wired to Winston in `main.ts`.

## Cross-cutting infrastructure

### Validation pipe
Globally configured with `whitelist: true`, `forbidNonWhitelisted: true`, and
`transform: true`. Unknown fields are rejected; DTOs are validated at request time.

### JWT guard
`JwtAuthGuard` (`src/common/guards/jwt-auth.guard.ts`) is registered globally
as `APP_GUARD`, so every route is protected by default. Mark routes public with
`@Public()` (e.g. `register`, `login`, `logout`, `health`).

### Transform interceptor
`TransformInterceptor` wraps every successful response:

```json
{ "success": true, "data": { ... } }
```

### Exception filter
`AllExceptionsFilter` (`src/common/filters/all-exceptions.filter.ts`) catches
unhandled exceptions and returns a uniform error shape:

```json
{ "success": false, "error": "message" }
```

It logs the error context through Winston and preserves the correct HTTP status.

## Modules

### `auth`
- `POST /api/v1/auth/register` - creates a user, sets the session cookie, and
  returns `{ user, accessToken }` (409 if email already exists).
- `POST /api/v1/auth/login` - verifies credentials, sets the JWT as an httpOnly
  cookie (`reconcile_token`), returns `{ user, accessToken }`.
- `GET /api/v1/auth/me` - returns the current user from the cookie.
- `POST /api/v1/auth/logout` - clears the cookie (stateless).

Cookie options: `httpOnly`, `sameSite: lax`, `secure` in production, maxAge
derived from `JWT_EXPIRATION`.

### `users`
Owns user persistence and the `toPublicUser` mapper (strips the password hash).
`UserResponseDto` is the only shape users ever leave the API.

### `health`
`GET /api/v1/health` - public liveness probe returning service, version, status
and timestamp.

### `reconciliation`
Core domain module. Sub-modules:
- **domain/** - Deterministic matching engine (`engine.ts`), signal scoring
  (`signals.ts`), settlement reconciliation (`settlements/`), and append-only
  audit chain (`audit/`).
- **review/** - REST controller for the reconciliation worklist: list/filter
  proposals, approve/reject/override decisions, list exceptions, fetch record
  details, and generate activity feed with chain verification.
- **ai/** - AI provider integration (optional). When `AICREDITS_API_KEY` is set,
  generates AI-drafted explanations for ambiguous matches and settlement
  exceptions. Always advisory — never modifies records.

### `imports`
CSV import pipeline. Accepts bank transactions, ledger entries, invoices, and
settlement lines via multipart upload. Each file is hashed, validated row-by-row
with Zod schemas, normalized, and inserted immutably.

### `demo`
Demo data seeding. Replaces all reconciliation data with a deterministic
synthetic dataset, then runs the real matching engine so every proposal, score,
and evidence item is produced by the same pipeline as a CSV import.

## Adding a new module

1. Create `src/modules/<feature>/` with controller, service, module and DTOs.
2. Register it in `src/modules/app.module.ts`.
3. If it needs database access, inject the global
   `DATABASE_CONNECTION` provider.
4. Document endpoints with Swagger decorators so they appear at `/docs`.
5. Add a `.spec.ts` unit test mirroring `auth.service.spec.ts`.

## Conventions

- Return DTOs, never entity/row objects.
- Throw `HttpException` subclasses; let the global filter format them.
- Prefer `@Public()` + global guard over per-route guards.
- All timestamps are UTC (`timestamptz`).
