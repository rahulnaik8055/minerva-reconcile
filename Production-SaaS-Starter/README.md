# Reconcile

Evidence-first financial reconciliation workbench. Bank transaction and ledger CSVs are
normalized, matched deterministically, scored transparently, and reviewed by a human
before anything is decided. Every decision lands in an append-only audit trail and a
reviewed reconciliation report.

> Evidence first. AI assists. The accountant decides.

## Stack

| Layer     | Technology                          |
| --------- | ----------------------------------- |
| Frontend  | Next.js 15, React 19, Tailwind CSS  |
| Backend   | NestJS 10                           |
| Database  | PostgreSQL + Drizzle ORM            |
| Auth      | JWT (httpOnly cookie), global guard |
| Validation| Zod (frontend), class-validator + Joi (backend) |
| Testing   | Jest                                |
| CI        | GitHub Actions: lint → typecheck → test → build |

## Project structure

```
apps/
├── backend/    NestJS API under /api/v1 (modules: auth, users, health)
└── frontend/   Next.js app (app router, feature-first organization)
```

## Getting started

Requirements: Node.js 22+, Docker (for PostgreSQL).

```bash
npm install
docker compose up -d          # starts postgres on :5432
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
npm run db:migrate            # apply drizzle migrations
npm run dev                   # backend on :3001, frontend on :3000
```

Swagger docs: http://localhost:3001/docs

## Commands

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Run backend + frontend in watch mode     |
| `npm run build`     | Production build for both apps           |
| `npm run lint`      | ESLint for both apps                     |
| `npm run typecheck` | TypeScript checks for both apps          |
| `npm run test`      | Backend unit tests                       |
| `npm run db:generate` | Generate Drizzle migrations            |
| `npm run db:migrate`  | Apply migrations                       |
| `npm run docker:up` | Start PostgreSQL via Docker Compose      |

## Documentation

See [docs/](docs/README.md) for architecture, authentication flow, database
conventions, API reference, and deployment notes.
