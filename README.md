# Greenroom — Event CRM

Comedy booking CRM for contacts, organizations, events, tasks, and **relative task groups**.

## Stack

- Next.js App Router + TypeScript + Tailwind
- Postgres + Drizzle ORM
- SQL migrations in `migrations/`
- Server Actions for CRUD
- Single-agency staff users (cookie “Act as” picker — not a security boundary)
- Outbound assignment / change / due-task emails via Resend

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
| Users (staff) | name + email; assignable to events and tasks; Resend notifications |
| Event / task assignees | many-to-many staff links; applying a task group copies event assignees onto new tasks |

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
- Staff users: Alex Chen (booker), Morgan Blake (travel), Riley Quinn
- Event: Jules Park · Friday Late (~3 weeks out), assigned to Alex + Morgan
- Task group **Standard booking**: −14 call, +2 email, +182 postcard (applied to the sample event; tasks assigned to Alex + Morgan)

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
- **Inbound** — recent Resend contact-form intakes and parse failures (links to created events)
- **Contacts / Organizations** — list + detail
- **Tasks** — filterable list
- **Task groups** — editor with friendly offset controls
- **Users** — staff directory; use **Act as** in the nav to set the current user cookie

## Staff notifications (Resend outbound)

Assignees receive email when they are newly assigned, when an assigned event/task changes (or is deleted), and via a daily due-task digest.

Set:

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Same key used for inbound body fetch; also sends outbound mail |
| `RESEND_FROM_EMAIL` | Verified sender, e.g. `Greenroom <bookings@yourdomain.com>` |
| `APP_BASE_URL` | Absolute links in emails (default `http://localhost:3000`) |
| `CRON_SECRET` | Protects the due-task cron route |

If Resend outbound env is missing, mutations still succeed and rows are written to `notification_log` with a skip reason (local-friendly).

### Due-task digest cron

Call once per day (hosting scheduler / external cron):

```bash
curl -X POST "https://<your-greenroom-host>/api/cron/due-tasks" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Open tasks (`todo` / `doing`) with `due_on <= today` are grouped per assignee. One digest per user per calendar day (`dedupe_key` prevents repeats).

The **Act as** picker is for attribution (skip self-notify) and “Mine” task filters — it is not login security.

## Email event intake (Resend Inbound)

Greenroom does **not** host the public Contact form. Your existing site keeps emailing a booking address; Resend Inbound receives that mail and POSTs a signed webhook here.

### 1. Resend DNS + inbound address

1. In [Resend](https://resend.com), add and verify your domain (MX / receiving DNS as Resend documents for Inbound).
2. Create an inbound address (e.g. `bookings@yourdomain.com`) that the Contact form sends to.

### 2. Webhook

1. Add a webhook endpoint pointing at:

   `https://<your-greenroom-host>/api/inbound/email`

2. Subscribe to **`email.received`**.
3. Copy the webhook signing secret into `RESEND_WEBHOOK_SECRET` (Svix headers `svix-id`, `svix-timestamp`, `svix-signature`).
4. Set `RESEND_API_KEY` as well — Resend’s webhook payload is metadata only; Greenroom fetches the body via the Receiving API.

Optional: `INBOUND_DEFAULT_TASK_GROUP_ID` — if set to a `task_groups.id`, that pack is applied when an inquiry is created. Leave unset for no auto-apply.

### 3. Form email body format

The embed’s “send email” action must emit **plain text** (or simple HTML) with one field per line. Labels are matched case-insensitively:

```text
Name: Jane Buyer
Email: jane@example.com
Phone: 555-0100
Notes: Looking for Saturday late show in March; capacity ~200
```

| Field | Required | Notes |
| --- | --- | --- |
| Name | yes | Becomes the contact name and event title (`Event request — {Name}`) |
| Email | yes | Upserts the contact by email |
| Phone | yes | Stored on the contact |
| Notes | no | Stored on the event (and contact when new / empty) |

Subject can be anything; it is stored on the intake row but not parsed. Missing required fields → `inbound_emails` row with status **failed**, no event. Successful parse → contact upsert, inquiry event with placeholder `startsAt` (+30 days at local noon), contact linked as **buyer**. Re-delivery of the same Resend `email_id` is idempotent (**duplicate**).

### 4. Test sample

**Structured body** (what the website form should send):

```text
Name: Jane Buyer
Email: jane.buyer@example.com
Phone: 555-0100
Notes: Looking for Saturday late show in March; capacity ~200
```

**Local intake without Resend** (uses the same processor as the webhook):

```bash
npx tsx scripts/simulate-inbound.ts          # creates inquiry + contact
npx tsx scripts/simulate-inbound.ts --fail   # records a failed intake
```

Then open **Inbound** in the app. For a live Resend check, send the structured body to your inbound address and confirm the webhook delivery in the Resend dashboard.
