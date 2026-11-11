import Link from "next/link";
import { and, asc, gte, inArray, lt, lte, ne, notInArray } from "drizzle-orm";
import { addDays, formatISO } from "date-fns";
import { connection } from "next/server";
import { Badge, EmptyState, PageHeader, Section } from "@/components/ui";
import { events, getDb, tasks } from "@/db";
import { ensureSeedData } from "@/db/seed";
import { labelize } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export default async function DashboardPage() {
  await connection();
  await ensureSeedData();
  const db = await getDb();
  const now = new Date();
  const today = formatISO(now, { representation: "date" });
  const soon = formatISO(addDays(now, 7), { representation: "date" });

  const upcomingEvents = await db
    .select()
    .from(events)
    .where(and(gte(events.startsAt, now), ne(events.status, "canceled")))
    .orderBy(asc(events.startsAt))
    .limit(8);

  const overdueTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        notInArray(tasks.status, ["done", "skipped"]),
        lt(tasks.dueOn, today),
      ),
    )
    .orderBy(asc(tasks.dueOn))
    .limit(12);

  const dueSoonTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        notInArray(tasks.status, ["done", "skipped"]),
        gte(tasks.dueOn, today),
        lte(tasks.dueOn, soon),
      ),
    )
    .orderBy(asc(tasks.dueOn))
    .limit(12);

  const eventIds = [
    ...new Set(
      [...overdueTasks, ...dueSoonTasks]
        .map((task) => task.eventId)
        .filter((id): id is number => id != null),
    ),
  ];
  const relatedEvents =
    eventIds.length > 0
      ? await db.select().from(events).where(inArray(events.id, eventIds))
      : [];
  const eventTitle = new Map(relatedEvents.map((event) => [event.id, event.title]));

  return (
    <div className="space-y-10">
      <PageHeader
        title="Dashboard"
        description="Upcoming shows plus overdue and due-soon booking tasks."
      />

      <Section title="Upcoming events">
        {upcomingEvents.length === 0 ? (
          <EmptyState
            title="No upcoming events"
            description="Create an event to start linking contacts and applying task groups."
            action={
              <Link className="text-[color:var(--accent)] underline" href="/events/new">
                Add event
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-[color:var(--line)] overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="flex flex-col gap-1 px-4 py-4 transition hover:bg-[color:var(--panel-soft)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium text-[color:var(--ink)]">{event.title}</div>
                  <div className="text-sm text-[color:var(--muted)]">
                    {event.venue || event.location || "Venue TBD"}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge>{labelize(event.status)}</Badge>
                  <span className="text-[color:var(--muted)]">
                    {formatDateTime(event.startsAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Overdue tasks">
          <TaskList
            items={overdueTasks}
            eventTitle={eventTitle}
            empty="Nothing overdue."
          />
        </Section>
        <Section title="Due in the next 7 days">
          <TaskList
            items={dueSoonTasks}
            eventTitle={eventTitle}
            empty="No tasks due soon."
          />
        </Section>
      </div>
    </div>
  );
}

function TaskList({
  items,
  eventTitle,
  empty,
}: {
  items: Array<typeof tasks.$inferSelect>;
  eventTitle: Map<number, string>;
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-8 text-sm text-[color:var(--muted)]">
        {empty}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[color:var(--line)] overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
      {items.map((task) => (
        <Link
          key={task.id}
          href="/tasks"
          className="block px-4 py-3 transition hover:bg-[color:var(--panel-soft)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-[color:var(--ink)]">{task.title}</div>
              <div className="text-sm text-[color:var(--muted)]">
                {task.eventId
                  ? eventTitle.get(task.eventId) ?? "Linked event"
                  : "No event"}
              </div>
            </div>
            <div className="text-right text-sm">
              <div>{formatDate(task.dueOn)}</div>
              <div className="text-[color:var(--muted)]">{labelize(task.kind)}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
