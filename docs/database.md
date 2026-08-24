# Database

## Stack

- **PostgreSQL 16** - relational database.
- **Drizzle ORM** - typed, SQL-first query builder.
- **drizzle-kit** - generates and runs migrations.

## Connection

The backend resolves `DATABASE_URL` from the environment
(`.env`). For local development with Docker Compose:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reconcile
```

The connection pool is exposed globally via the `DATABASE_CONNECTION` provider
in `apps/backend/src/database/database.module.ts`. Inject it into any service
that needs data access.

## Schema

Drizzle schema files live in `apps/backend/src/database/schema/`. Columns use
snake_case; the TypeScript properties are camelCase (mapped automatically).
Timestamps are UTC (`timestamptz`).

### `users`

| Column         | Type          | Notes                    |
| -------------- | ------------- | ------------------------ |
| `id`           | uuid          | PK, `gen_random_uuid()`  |
| `email`        | varchar(255)  | unique, not null         |
| `password_hash`| varchar(255)  | not null                 |
| `full_name`    | varchar(255)  | not null                 |
| `created_at`   | timestamptz   | default now              |
| `updated_at`   | timestamptz   | default now              |

Add new tables here as your product grows. Follow the same conventions:
UUID primary keys, snake_case columns, and UTC timestamps.

## Migrations

Migrations are committed in `apps/backend/drizzle/migrations/` and applied
manually or in CI/deploy pipelines:

```bash
npm run db:generate   # create a new migration from schema changes
npm run db:migrate    # apply pending migrations
npm run db:push       # push schema without migrations (dev only)
npm run db:studio     # open Drizzle Studio UI
```

### Making schema changes

1. Edit the schema file(s) under `src/database/schema/`.
2. Run `npm run db:generate` and review the generated SQL.
3. Run `npm run db:migrate` against your database.
4. Commit both the schema change and the migration.

## Anti-patterns to avoid

- Do not mutate rows directly in controllers - encapsulate in services.
- Do not return row objects to the client - map to DTOs.
- Never put secrets or connection strings in committed files - use `.env`.
