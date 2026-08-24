# Deployment

## Overview

The project ships two independently deployable services plus PostgreSQL:

| Service  | Location            | Port (default) |
| -------- | ------------------- | -------------- |
| Frontend | `apps/frontend`     | 3000           |
| Backend  | `apps/backend`      | 3001           |
| Database | PostgreSQL 16       | 5432           |

Both apps have production Dockerfiles and can be deployed to any container
platform (Fly.io, Railway, Render, AWS ECS, Google Cloud Run, a VPS, etc.).

## Docker images

- `apps/backend/Dockerfile` - builds the NestJS app (`dist/`) and runs it with
  `node dist/main`.
- `apps/frontend/Dockerfile` - builds the Next.js app and runs a standalone
  Node server.

`docker-compose.yml` provides a full local stack for development.

## Environment variables

Set these in your hosting environment. Never commit them.

### Backend

| Variable          | Required | Notes                                   |
| ----------------- | -------- | --------------------------------------- |
| `NODE_ENV`        | yes      | `production` for JSON logs + secure cookies |
| `PORT`            | no       | default `3001`                          |
| `DATABASE_URL`    | yes      | PostgreSQL connection string            |
| `FRONTEND_URL`    | yes      | CORS origin (your frontend URL)         |
| `JWT_SECRET`      | yes      | ≥ 32 characters                         |
| `JWT_EXPIRATION`  | no       | default `7d`                            |
| `LOG_LEVEL`       | no       | overrides default log level             |

### Frontend

| Variable               | Required | Notes                              |
| ---------------------- | -------- | ---------------------------------- |
| `NEXT_PUBLIC_API_URL`  | yes      | Public API base URL                |
| `JWT_SECRET`           | yes      | **must match** backend `JWT_SECRET` |

In production the frontend `NEXT_PUBLIC_API_URL` must point at your deployed
backend (e.g. `https://api.yourdomain.com/api/v1`) and `FRONTEND_URL` on the
backend must be the deployed frontend origin.

## Running migrations

Apply migrations before (or as part of) deploying new backend versions:

```bash
npm run db:migrate
```

In CI/CD you can run this against the production database using a migration
step with the production `DATABASE_URL` injected. Never use `db:push` against
production.

## HTTPS and cookies

The session cookie is flagged `secure` when `NODE_ENV=production`, so the
backend must be served over HTTPS. Terminate TLS at your load balancer /
reverse proxy and forward requests to the app.

## Health checks

Use `GET /api/v1/health` as the liveness probe for both the container
orchestrator and external uptime monitors.

## Example: minimal VPS / Docker deployment

1. Build images:
   ```bash
   docker build -f apps/backend/Dockerfile -t my-backend .
   docker build -f apps/frontend/Dockerfile -t my-frontend .
   ```
2. Run with a managed PostgreSQL (e.g. Neon, RDS, Supabase) and set the env
   vars above.
3. Point a reverse proxy (Caddy/nginx) at each container and enable HTTPS.
