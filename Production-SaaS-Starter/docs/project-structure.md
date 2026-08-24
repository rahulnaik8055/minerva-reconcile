# Project Structure

```
.
├── apps/
│   ├── backend/                 # NestJS REST API
│   │   ├── drizzle/
│   │   │   └── migrations/      # Generated SQL migrations
│   │   └── src/
│   │       ├── common/          # Cross-cutting concerns
│   │       │   ├── decorators/  # @Public, @CurrentUser
│   │       │   ├── filters/     # AllExceptionsFilter
│   │       │   ├── guards/      # JwtAuthGuard
│   │       │   ├── interceptors/# TransformInterceptor
│   │       │   └── logging/     # Winston config
│   │       ├── config/          # Joi env validation
│   │       ├── database/        # Drizzle pool + schema
│   │       │   └── schema/      # users (add your own tables)
│   │       ├── interfaces/      # Shared TS interfaces
│   │       ├── modules/         # Feature modules
│   │       │   ├── auth/        # register / login / logout / me
│   │       │   ├── users/       # User data access + DTOs
│   │       │   └── health/      # /health endpoint
│   │       ├── main.ts          # Bootstrap
│   │       └── modules/app.module.ts
│   │
│   └── frontend/                # Next.js 15 App Router
│       └── src/
│           ├── app/             # Routes (pages + layouts)
│           ├── components/      # UI primitives + layout
│           │   ├── layout/      # DashboardHeader, etc.
│           │   ├── providers/   # QueryProvider
│           │   └── ui/          # Button, Input, Alert, ...
│           ├── features/        # Feature-based code
│           │   └── auth/        # AuthProvider, hooks, forms, schemas
│           ├── hooks/           # Shared React hooks
│           ├── lib/             # apiClient, utils
│           └── middleware.ts    # Route protection (jose)
│
├── docs/                        # Project documentation
├── .github/workflows/           # CI pipeline
├── package.json                 # Workspace root
├── docker-compose.yml           # Local stack
└── .env.example                 # All documented env vars
```

## Frontend routes

| Path         | Access   | Purpose                    |
| ------------ | -------- | -------------------------- |
| `/`          | Public   | Landing page               |
| `/login`     | Guest    | Sign in                    |
| `/register`  | Guest    | Create account             |
| `/dashboard` | Protected| Authenticated dashboard     |

## Backend modules

| Module  | Responsibility                          |
| ------- | --------------------------------------- |
| `auth`  | Registration, login, logout, current user |
| `users` | User persistence and public DTO mapping |
| `health`| Liveness endpoint                       |
| `database`| Global Drizzle pool provider           |

## Rules of thumb

- New feature = new folder under `apps/frontend/src/features/<feature>` and a
  matching module under `apps/backend/src/modules/<feature>`.
- Shared backend plumbing (guards, filters, interceptors, decorators) lives in
  `common/`.
- Never import across app boundaries; both apps share only the monorepo
  tooling and TypeScript config.
