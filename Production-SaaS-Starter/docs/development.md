# Development Guide

## Prerequisites

- **Node.js** 20+ (22 recommended)
- **npm** 10+
- **Docker** + **Docker Compose** (for the local PostgreSQL, or use any
  PostgreSQL 16 instance / managed database)

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment

Copy the example files and fill in your values:

```bash
cp .env.example .env                      # reference only - see below
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

Required values:

| App     | Variable            | Notes                                    |
| ------- | ------------------- | ---------------------------------------- |
| backend | `DATABASE_URL`      | PostgreSQL connection string             |
| backend | `JWT_SECRET`        | ≥ 32 characters                          |
| frontend| `JWT_SECRET`        | **must match** the backend value         |
| frontend| `NEXT_PUBLIC_API_URL`| default `http://localhost:3001/api/v1`   |

Generate a strong secret:

```bash
openssl rand -base64 48
```

> The root `.env.example` documents every variable; individual apps read their
> own `.env` files. Never commit `.env` files.

## 3. Start the database

With Docker Compose (PostgreSQL 16 + healthcheck):

```bash
npm run docker:up
```

Or point `DATABASE_URL` at any PostgreSQL instance you have access to.

## 4. Run migrations

```bash
npm run db:migrate
```

## 5. Run the apps

Start both apps concurrently:

```bash
npm run dev
```

Or individually:

```bash
npm run dev:backend   # http://localhost:3001
npm run dev:frontend  # http://localhost:3000
```

## 6. Verify

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api/v1/health
- Swagger docs: http://localhost:3001/docs

## Useful scripts

| Command                | Description                            |
| ---------------------- | -------------------------------------- |
| `npm run dev`          | Run both apps with hot reload          |
| `npm run build`        | Production builds for both apps        |
| `npm run lint`         | ESLint both apps                       |
| `npm run typecheck`    | TypeScript checks both apps            |
| `npm run test`         | Backend unit tests (Jest)              |
| `npm run format`       | Auto-format with Prettier              |
| `npm run db:generate`  | Generate a Drizzle migration           |
| `npm run db:migrate`   | Apply migrations                       |
| `npm run db:studio`    | Open Drizzle Studio                    |
| `npm run docker:up`    | Start PostgreSQL via Docker Compose    |

## Troubleshooting

- **Login/register fail with 401** - the frontend and backend `JWT_SECRET`
  values differ, or the cookie is not being sent (check CORS `credentials`
  and that `FRONTEND_URL` matches the frontend origin).
- **`DATABASE_URL` is required** - the backend fails fast on boot if the env
  is missing. Confirm `apps/backend/.env` exists.
- **Ports in use** - backend defaults to `3001`, frontend to `3000`, Postgres
  to `5432`. Override via `PORT` and the compose file.
- **Cookie not set in production** - cookies are `secure: true` in production;
  serve the API over HTTPS.
