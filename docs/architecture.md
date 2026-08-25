# Architecture

## Overview

Reconcile is a full-stack TypeScript monorepo managed with
[npm workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces).

```
┌─────────────────────────────────────────────┐
│                Next.js (apps/frontend)      │
│  App Router · Server & Client Components    │
│  AuthProvider (React Context) · RHF + Zod   │
│  React Query · Middleware (jose)            │
└───────────────────┬─────────────────────────┘
                    │  HTTP + JSON (REST)
                    │  JWT in httpOnly cookie
                    ▼
┌─────────────────────────────────────────────┐
│                NestJS (apps/backend)        │
│  Global JwtAuthGuard · ValidationPipe       │
│  TransformInterceptor · Exception filter    │
│  Winston (structured logging)               │
└───────────────────┬─────────────────────────┘
                    │  Drizzle ORM
                    ▼
┌─────────────────────────────────────────────┐
│                PostgreSQL                    │
│   users · bank_transactions · ledger_entries  │
│   invoices · settlements · settlement_lines   │
│   proposals · proposal_links · evidence       │
│   activity_log · imports                      │
└─────────────────────────────────────────────┘
```

### Key decisions

- **Monorepo** - one repo, two apps, shared tooling and a single lockfile.
  Frontend and backend evolve in lockstep.
- **REST API with a documented contract** - NestJS controllers expose a typed
  API (Swagger at `/docs`), consumed by a typed client on the frontend.
- **JWT in an httpOnly cookie** - the token never reaches client-side
  JavaScript, mitigating XSS token theft. The frontend middleware verifies the
  cookie on the server for route protection.
- **Drizzle ORM** - type-safe, SQL-first database access with generated
  migrations.

## Request lifecycle (backend)

1. Request arrives → global prefix `/api/v1` is stripped.
2. `cookieParser` populates `req.cookies`.
3. The global `JwtAuthGuard` (registered via `APP_GUARD`) checks the session
   cookie unless the route is marked `@Public()`.
4. `ValidationPipe` validates and transforms DTOs (`whitelist` + reject
   unknown fields).
5. The route handler runs and returns a DTO (or throws).
6. `TransformInterceptor` wraps success responses in `{ success, data }`.
7. `AllExceptionsFilter` catches unhandled errors and returns a uniform
   `{ success: false, error }` shape, logging through Winston.
8. Errors bubble up with the correct HTTP status code.

## Request lifecycle (frontend)

1. Client component calls `apiClient(path, options)` in
   `src/lib/api.ts`, which sends `credentials: 'include'` cookies.
2. The Next.js middleware (`src/middleware.ts`) runs on navigation to
   protected pages (`/overview`, `/reconciliation`, `/report`, `/activity`,
   `/exceptions`, `/import`) and auth pages (`/login`, `/register`),
   verifying the JWT server-side with `jose`.
3. `AuthProvider` hydrates the current user on mount and exposes
   `login` / `register` / `logout` / `currentUser` via `useAuth`.
4. Server components are rendered server-side; client components take over
   interactivity.

## Naming conventions

- All API routes live under `/api/v1`.
- Backend modules are feature folders (`modules/<feature>`).
- Database tables use snake_case columns; TypeScript uses camelCase
  (Drizzle maps automatically).
- Package names: root `reconcile`, apps
  `@reconcile/backend` and `@reconcile/frontend`.

See [backend-architecture.md](backend-architecture.md),
[frontend-architecture.md](frontend-architecture.md), and
[project-structure.md](project-structure.md) for details.
