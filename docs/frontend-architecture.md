# Frontend Architecture

## Stack

- **Next.js 15** (App Router) + **React 19** - server components by default,
  client components where interactivity is needed.
- **TypeScript** - strict, end-to-end type safety.
- **Tailwind CSS** - utility-first styling with a shadcn-style design system
  (`src/components/ui/`).
- **React Hook Form + Zod** - validated forms with typed schemas.
- **TanStack Query** - server-state caching for API data.
- **jose** - JWT verification in `middleware.ts` (Edge-compatible).

## Folder conventions

| Folder            | Purpose                                             |
| ----------------- | --------------------------------------------------- |
| `src/app/`        | File-based routing (pages, layouts, metadata)       |
| `src/components/` | Reusable UI primitives and layout components        |
| `src/features/`   | Feature modules: context, hooks, forms, services    |
| `src/lib/`        | Framework-agnostic utilities (api client, helpers)  |
| `src/hooks/`      | Shared hooks                                        |

## Data fetching

`src/lib/api.ts` exports `apiClient<T>(path, options)`:

- Sends `credentials: 'include'` so cookies are attached automatically.
- Throws `ApiError` with the server message on non-2xx responses.
- Unwraps the `{ success, data }` envelope transparently.

```ts
const user = await apiClient<User>('/auth/me');
```

## Auth flow

- `AuthProvider` (`src/features/auth/context/auth-context.tsx`) holds
  `currentUser`, `loading`, `login`, `register`, and `logout`.
- On mount it calls `/auth/me`; a 401 results in an unauthenticated state
  rather than a crash.
- `useAuth()` hook exposes the context to any client component.
- `middleware.ts` protects `/overview`, `/reconciliation`, `/report`,
  `/activity`, `/exceptions`, `/import` server-side by verifying the
  `reconcile_token` cookie with `jose` (HS256), redirecting to `/login`
  when invalid. Authenticated users visiting `/login` or `/register` are
  redirected to `/overview`.

## Adding a page

1. Create a folder under `src/app/`.
2. Add `export const metadata` for titles/descriptions.
3. Use client components + `useAuth()` for interactive sections.
4. Wrap API reads in React Query hooks within the feature module.

## Environment variables

| Variable               | Where used             | Scope          |
| ---------------------- | ---------------------- | -------------- |
| `NEXT_PUBLIC_API_URL`  | `apiClient`            | Public (browser) |
| `JWT_SECRET`           | `middleware.ts`        | Server-only    |

The frontend `JWT_SECRET` must match the backend `JWT_SECRET`.
