# Greenroom — Event CRM

Comedy booking CRM for contacts, organizations, events, tasks, and **relative task groups**.

## Stack

- Next.js App Router + TypeScript + Tailwind
- Postgres + Drizzle ORM
- SQL migrations in `migrations/`
- Server Actions for CRUD
- Single-agency v1 (no multi-tenant auth)

Locally, if `DATABASE_URL` is unset, the app uses an on-disk [PGlite](https://pglite.dev/) database under `.data/pglite` so you can develop without Postgres.

## Domain

| Entity | Notes |
| --- | --- |
| Organizations | venue / club / agency / promoter / other |
| Contacts | people, optional org |
| Events | start datetime, location, venue, status, notes |
| Event links | contact and/or org with a role |
| Tasks | kinds: travel, payment, call, email, follow_up, other · statuses: todo / doing / done / skipped |
| Task groups + templates | reusable packs; each template has `offsetDays` relative to the event start date |

### Relative task application

When a task group is applied to an event:

1. For each template, `dueOn = event local calendar date + offsetDays` (negative = before, positive = after).
2. Concrete tasks are created and linked to the event, group, and source template.
3. Re-applying the same group is **blocked** unless you choose **add missing only** (skips templates that already spawned a task for that event).

Changing an event date does **not** auto-shift tasks. Use **Recalculate open tasks from templates** on the event page to update incomplete (`todo` / `doing`) template-linked tasks only.

Friendly offset UI (e.g. “2 weeks before”, “2 days after”, “6 months after”) stores integer `offsetDays`. Months use a 30-day approximation (so ~6 months → `182` in the seed pack).

## Setup

```bash
npm install
cp .env.example .env.local   # optional; leave DATABASE_URL empty for PGlite
npm run db:seed              # sample comedy-club data (idempotent)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Postgres (optional)

Set `DATABASE_URL` (and optionally `DATABASE_URL_UNPOOLED` for migrations through a pooler):

```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/crm_event
npm run db:migrate
npm run db:seed
npm run dev
```

Published Cursor apps that declare a database get `DATABASE_URL` injected automatically; `npm run build` applies migrations via `scripts/migrate.mjs`.

## Seed data

`npm run db:seed` (also runs automatically on first dashboard load when the DB is empty) creates:

- Laugh Track Lounge (club) + Midwest Mirth Agency
- Contacts: Dana Ortiz (buyer), Jules Park (comic), Sam Rivera (travel)
- Event: Jules Park · Friday Late (~3 weeks out)
- Task group **Standard booking**: −14 call, +2 email, +182 postcard (applied to the sample event)

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build + migrate when `DATABASE_URL` is set |
| `npm run db:migrate` | Apply `migrations/*.sql` to Postgres |
| `npm run db:seed` | Insert sample data if empty |
| `npm run db:studio` | Drizzle Kit studio (needs `DATABASE_URL`) |

## App surfaces

- **Dashboard** — upcoming events, overdue / due-soon tasks
- **Events** — list + detail (links, tasks, apply task group, recalculate)
- **Contacts / Organizations** — list + detail
- **Tasks** — filterable list
- **Task groups** — editor with friendly offset controls
