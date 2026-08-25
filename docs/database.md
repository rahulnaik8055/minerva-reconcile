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

### `bank_transactions`

| Column              | Type          | Notes                         |
| ------------------- | ------------- | ----------------------------- |
| `id`                | uuid          | PK                            |
| `import_id`         | uuid          | FK → imports                  |
| `external_reference`| varchar(255)  | bank reference number         |
| `posted_at`         | timestamptz   | not null                      |
| `amount_cents`      | integer       | not null                      |
| `currency`          | varchar(3)    | default 'USD'                 |
| `description`       | text          | not null                      |
| `normalized_vendor` | varchar(255)  | normalized vendor name        |
| `source_row`        | integer       | CSV source row number         |

### `ledger_entries`

| Column              | Type          | Notes                         |
| ------------------- | ------------- | ----------------------------- |
| `id`                | uuid          | PK                            |
| `import_id`         | uuid          | FK → imports                  |
| `external_reference`| varchar(255)  | GL reference                  |
| `posted_at`         | timestamptz   | not null                      |
| `amount_cents`      | integer       | not null                      |
| `currency`          | varchar(3)    | default 'USD'                 |
| `account_code`      | varchar(50)   | not null                      |
| `account_name`      | varchar(255)  | not null                      |
| `description`       | text          | not null                      |
| `normalized_vendor` | varchar(255)  | normalized vendor name        |
| `source_row`        | integer       | CSV source row number         |

### `invoices`

| Column              | Type          | Notes                         |
| ------------------- | ------------- | ----------------------------- |
| `id`                | uuid          | PK                            |
| `import_id`         | uuid          | FK → imports                  |
| `invoice_number`    | varchar(255)  | not null                      |
| `vendor`            | varchar(255)  | not null                      |
| `normalized_vendor` | varchar(255)  | normalized vendor name        |
| `issued_at`         | timestamptz   | not null                      |
| `due_at`            | timestamptz   | nullable                      |
| `amount_cents`      | integer       | not null                      |
| `currency`          | varchar(3)    | default 'USD'                 |
| `reference`         | varchar(255)  | nullable                      |
| `source_row`        | integer       | CSV source row number         |

### `settlements`

| Column                 | Type          | Notes                        |
| ---------------------- | ------------- | ---------------------------- |
| `id`                   | uuid          | PK                           |
| `import_id`            | uuid          | FK → imports                 |
| `provider`             | varchar(255)  | not null                     |
| `settlement_reference` | varchar(255)  | nullable                     |
| `settlement_date`      | timestamptz   | not null                     |
| `currency`             | varchar(3)    | default 'USD'                |
| `gross_amount_cents`   | integer       | not null                     |
| `fees_cents`           | integer       | not null                     |
| `refunds_cents`        | integer       | not null                     |
| `deductions_cents`     | integer       | not null                     |
| `adjustments_cents`    | integer       | not null                     |
| `expected_net_cents`   | integer       | not null                     |
| `source_row`           | integer       | CSV source row number        |

### `settlement_lines`

| Column          | Type          | Notes                         |
| --------------- | ------------- | ----------------------------- |
| `id`            | uuid          | PK                            |
| `settlement_id` | uuid          | FK → settlements              |
| `type`          | varchar(50)   | e.g. sale, fee, refund        |
| `description`   | text          | not null                      |
| `amount_cents`  | integer       | not null                      |
| `reference`     | varchar(255)  | nullable                      |
| `source_row`    | integer       | CSV source row number         |

### `proposals`

| Column           | Type          | Notes                          |
| ---------------- | ------------- | ------------------------------ |
| `id`             | uuid          | PK                             |
| `status`         | varchar(20)   | pending / accepted / rejected  |
| `method`         | varchar(50)   | engine_match / manual          |
| `score`          | real          | confidence 0..1                |
| `rationale_json` | jsonb         | engine rationale or override   |
| `created_at`     | timestamptz   | default now                    |
| `decided_at`     | timestamptz   | nullable                       |
| `decided_by`     | varchar(255)  | nullable, actor email          |
| `superseded_by`  | uuid          | FK → proposals, nullable       |

### `proposal_links`

| Column        | Type          | Notes                           |
| ------------- | ------------- | ------------------------------- |
| `proposal_id` | uuid          | FK → proposals                  |
| `source_type` | varchar(50)   | bank_transaction, ledger_entry, etc. |
| `record_id`   | uuid          | FK to the source table          |

### `evidence`

| Column         | Type          | Notes                           |
| -------------- | ------------- | ------------------------------- |
| `id`           | uuid          | PK                              |
| `proposal_id`  | uuid          | FK → proposals                  |
| `source_type`  | varchar(50)   | source record type              |
| `source_id`    | uuid          | source record id                |
| `evidence_type`| varchar(50)   | e.g. amount_match, date_proximity |
| `detail`       | text          | human-readable evidence detail  |

### `activity_log`

| Column         | Type          | Notes                           |
| -------------- | ------------- | ------------------------------- |
| `id`           | uuid          | PK                              |
| `timestamp`    | timestamptz   | default now                     |
| `actor`        | varchar(255)  | user email                      |
| `action`       | varchar(64)   | e.g. proposal.approved          |
| `entity_type`  | varchar(50)   | e.g. proposal                   |
| `entity_id`    | uuid          | ID of the affected entity       |
| `payload_json` | jsonb         | previous/new state, reason      |
| `previous_hash`| varchar(128)  | hash of previous entry          |
| `hash`         | varchar(128)  | SHA-256 of this entry           |

### `imports`

| Column      | Type          | Notes                           |
| ----------- | ------------- | ------------------------------- |
| `id`        | uuid          | PK                              |
| `filename`  | varchar(255)  | original CSV filename           |
| `type`      | varchar(50)   | bank, ledger, invoice, settlement |
| `row_count` | integer       | total rows in file              |
| `hash`      | varchar(128)  | SHA-256 of file content         |
| `created_at`| timestamptz   | default now                     |

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
