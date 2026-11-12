import Link from "next/link";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { connection } from "next/server";
import {
  Badge,
  ButtonLink,
  DataTable,
  EmptyState,
  Field,
  PageHeader,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import { events, getDb, tasks } from "@/db";
import { ensureSeedData } from "@/db/seed";
import {
  TASK_KINDS,
  TASK_STATUSES,
  labelize,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";

export default async function TasksPage({
  searchParams,
}: PageProps<"/tasks">) {
  await connection();
  await ensureSeedData();
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const kind = typeof params.kind === "string" ? params.kind : "";
  const eventId = typeof params.eventId === "string" ? params.eventId : "";
  const dueFrom = typeof params.dueFrom === "string" ? params.dueFrom : "";
  const dueTo = typeof params.dueTo === "string" ? params.dueTo : "";

  const db = await getDb();
  const filters = [];
  if (status && TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) {
    filters.push(eq(tasks.status, status as (typeof TASK_STATUSES)[number]));
  }
  if (kind && TASK_KINDS.includes(kind as (typeof TASK_KINDS)[number])) {
    filters.push(eq(tasks.kind, kind as (typeof TASK_KINDS)[number]));
  }
  if (eventId) {
    const id = Number(eventId);
    if (Number.isFinite(id)) filters.push(eq(tasks.eventId, id));
  }
  if (dueFrom) filters.push(gte(tasks.dueOn, dueFrom));
  if (dueTo) filters.push(lte(tasks.dueOn, dueTo));

  const rows = await db
    .select({
      task: tasks,
      eventTitle: events.title,
    })
    .from(tasks)
    .leftJoin(events, eq(tasks.eventId, events.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(tasks.dueOn));

  const allEvents = await db.select().from(events).orderBy(asc(events.startsAt));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Filter by status, kind, event, and due window."
        actions={<ButtonLink href="/tasks/new">Add task</ButtonLink>}
      />

      <form method="get" className="grid gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Status">
          <select className={inputClassName} name="status" defaultValue={status}>
            <option value="">Any</option>
            {TASK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {labelize(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kind">
          <select className={inputClassName} name="kind" defaultValue={kind}>
            <option value="">Any</option>
            {TASK_KINDS.map((value) => (
              <option key={value} value={value}>
                {labelize(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Event">
          <select
            className={inputClassName}
            name="eventId"
            defaultValue={eventId}
          >
            <option value="">Any</option>
            {allEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due from">
          <input
            className={inputClassName}
            type="date"
            name="dueFrom"
            defaultValue={dueFrom}
          />
        </Field>
        <Field label="Due to">
          <input
            className={inputClassName}
            type="date"
            name="dueTo"
            defaultValue={dueTo}
          />
        </Field>
        <div className="sm:col-span-2 lg:col-span-5">
          <SubmitButton>Apply filters</SubmitButton>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title="No tasks match"
          description="Adjust filters or create a task / apply a task group to an event."
          action={<ButtonLink href="/tasks/new">Add task</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={["Task", "Due", "Kind", "Status", "Event", ""]}
          rows={rows.map(({ task, eventTitle }) => [
            task.title,
            formatDate(task.dueOn),
            labelize(task.kind),
            <Badge key={`${task.id}-status`}>{labelize(task.status)}</Badge>,
            task.eventId ? (
              <Link
                key={`${task.id}-event`}
                href={`/events/${task.eventId}`}
                className="text-[color:var(--accent)]"
              >
                {eventTitle}
              </Link>
            ) : (
              "—"
            ),
            <span key={`${task.id}-actions`} className="flex gap-3">
              <Link href={`/tasks/${task.id}`} className="text-[color:var(--accent)]">
                Open
              </Link>
              <Link href={`/tasks/${task.id}/edit`}>Edit</Link>
            </span>,
          ])}
        />
      )}
    </div>
  );
}
