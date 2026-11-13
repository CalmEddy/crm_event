// Server-rendered widget bodies. Each widget loads only what it shows.
import Link from "next/link";
import { and, asc, count, eq, gte, inArray, lt, lte, ne, notExists, notInArray } from "drizzle-orm";
import { addDays, formatISO } from "date-fns";
import { Badge } from "@/components/ui";
import { events, getDb, savedViews, taskAssignees, tasks, type Task } from "@/db";
import { EVENT_STATUSES, labelize } from "@/lib/constants";
import type { DashboardWidget, KpiMetric } from "@/lib/dashboard/widgets";
import { entityHref } from "@/lib/entities";
import { formatDate, formatDateTime } from "@/lib/format";
import { VIEW_CONFIGS } from "@/lib/views/fields";
import { loadViewRows } from "@/lib/views/load";
import { applyViewState, cellText, parseViewState } from "@/lib/views/query";

const OPEN = notInArray(tasks.status, ["done", "skipped"]);

function dates() {
  const now = new Date();
  return {
    now,
    today: formatISO(now, { representation: "date" }),
    week: formatISO(addDays(now, 7), { representation: "date" }),
  };
}

export async function WidgetContent({
  widget,
  userId,
}: {
  widget: DashboardWidget;
  userId: number | null;
}) {
  const limit = widget.limit ?? 8;
  switch (widget.type) {
    case "kpi":
      return <Kpi metric={widget.metric ?? "overdue_tasks"} userId={userId} />;
    case "upcoming_events":
      return <UpcomingEvents limit={limit} />;
    case "overdue_tasks":
    case "due_soon":
    case "my_tasks":
      return <TaskWidget type={widget.type} limit={limit} userId={userId} />;
    case "pipeline":
      return <Pipeline />;
    case "saved_view":
      return <SavedViewWidget viewId={widget.viewId} limit={limit} userId={userId} />;
  }
}

function kpiLink(metric: KpiMetric): string {
  const { today, week } = dates();
  const yesterday = formatISO(addDays(new Date(), -1), { representation: "date" });
  const open = "f.status=todo,doing&sort=dueOn";
  return {
    overdue_tasks: `/tasks?${open}&f.dueOn=..${yesterday}`,
    due_this_week: `/tasks?${open}&f.dueOn=${today}..${week}`,
    my_open_tasks: "/tasks?f.assignees=me&f.status=todo,doing",
    upcoming_events: "/events?view=calendar",
    unassigned_tasks: "/tasks?f.assignees=none&f.status=todo,doing",
  }[metric];
}

async function Kpi({ metric, userId }: { metric: KpiMetric; userId: number | null }) {
  const db = await getDb();
  const { now, today, week } = dates();
  let value = 0;
  if (metric === "upcoming_events") {
    const [row] = await db
      .select({ n: count() })
      .from(events)
      .where(and(gte(events.startsAt, now), lt(events.startsAt, addDays(now, 30)), ne(events.status, "canceled")));
    value = row.n;
  } else if (metric === "my_open_tasks") {
    if (userId != null) {
      const [row] = await db
        .select({ n: count() })
        .from(tasks)
        .innerJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
        .where(and(OPEN, eq(taskAssignees.userId, userId)));
      value = row.n;
    }
  } else {
    const where =
      metric === "overdue_tasks"
        ? and(OPEN, lt(tasks.dueOn, today))
        : metric === "due_this_week"
          ? and(OPEN, gte(tasks.dueOn, today), lte(tasks.dueOn, week))
          : and(
              OPEN,
              notExists(db.select().from(taskAssignees).where(eq(taskAssignees.taskId, tasks.id))),
            );
    const [row] = await db.select({ n: count() }).from(tasks).where(where);
    value = row.n;
  }
  const alarming = metric === "overdue_tasks" && value > 0;
  return (
    <Link href={kpiLink(metric)} className="block">
      <div
        className={`font-[family-name:var(--font-display)] text-4xl ${
          alarming ? "text-[color:var(--danger)]" : "text-[color:var(--ink)]"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-[color:var(--muted)]">View →</div>
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-[color:var(--muted)]">{children}</p>;
}

const rowClass =
  "flex items-start justify-between gap-3 py-2 text-sm transition hover:bg-[color:var(--panel-soft)]";

async function UpcomingEvents({ limit }: { limit: number }) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(events)
    .where(and(gte(events.startsAt, new Date()), ne(events.status, "canceled")))
    .orderBy(asc(events.startsAt))
    .limit(limit);
  if (rows.length === 0) {
    return (
      <Empty>
        No upcoming events.{" "}
        <Link className="text-[color:var(--accent)] underline" href="/events/new">
          Add event
        </Link>
      </Empty>
    );
  }
  return (
    <ul className="divide-y divide-[color:var(--line)]">
      {rows.map((event) => (
        <li key={event.id}>
          <Link href={`/events/${event.id}`} className={rowClass}>
            <div>
              <div className="font-medium text-[color:var(--ink)]">{event.title}</div>
              <div className="text-[color:var(--muted)]">
                {event.venue || event.location || "Venue TBD"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge>{labelize(event.status)}</Badge>
              <span className="text-[color:var(--muted)]">{formatDateTime(event.startsAt)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function TaskWidget({
  type,
  limit,
  userId,
}: {
  type: "overdue_tasks" | "due_soon" | "my_tasks";
  limit: number;
  userId: number | null;
}) {
  const db = await getDb();
  const { today, week } = dates();
  let rows: Task[];
  if (type === "my_tasks") {
    if (userId == null) return <Empty>Your account isn&apos;t linked to a staff user.</Empty>;
    rows = (
      await db
        .select({ task: tasks })
        .from(tasks)
        .innerJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
        .where(and(OPEN, eq(taskAssignees.userId, userId)))
        .orderBy(asc(tasks.dueOn))
        .limit(limit)
    ).map((row) => row.task);
  } else {
    rows = await db
      .select()
      .from(tasks)
      .where(
        type === "overdue_tasks"
          ? and(OPEN, lt(tasks.dueOn, today))
          : and(OPEN, gte(tasks.dueOn, today), lte(tasks.dueOn, week)),
      )
      .orderBy(asc(tasks.dueOn))
      .limit(limit);
  }
  if (rows.length === 0) {
    return (
      <Empty>
        {type === "overdue_tasks"
          ? "Nothing overdue."
          : type === "due_soon"
            ? "No tasks due soon."
            : "Nothing assigned to you."}
      </Empty>
    );
  }
  const eventIds = [...new Set(rows.map((t) => t.eventId).filter((id): id is number => id != null))];
  const related = eventIds.length
    ? await db.select({ id: events.id, title: events.title }).from(events).where(inArray(events.id, eventIds))
    : [];
  const eventTitle = new Map(related.map((e) => [e.id, e.title]));
  return (
    <ul className="divide-y divide-[color:var(--line)]">
      {rows.map((task) => (
        <li key={task.id}>
          <Link href={`/tasks?open=${task.id}`} className={rowClass}>
            <div>
              <div className="font-medium text-[color:var(--ink)]">{task.title}</div>
              <div className="text-[color:var(--muted)]">
                {task.eventId ? (eventTitle.get(task.eventId) ?? "Linked event") : "No event"}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className={task.dueOn && task.dueOn < today ? "text-[color:var(--danger)]" : ""}>
                {formatDate(task.dueOn)}
              </div>
              <div className="text-[color:var(--muted)]">{labelize(task.kind)}</div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Pipeline() {
  const db = await getDb();
  const rows = await db
    .select({ status: events.status, n: count() })
    .from(events)
    .where(gte(events.startsAt, new Date()))
    .groupBy(events.status);
  const counts = new Map(rows.map((row) => [row.status, row.n]));
  const max = Math.max(1, ...rows.map((row) => row.n));
  return (
    <ul className="space-y-2 text-sm">
      {EVENT_STATUSES.map((status) => {
        const n = counts.get(status) ?? 0;
        return (
          <li key={status}>
            <Link
              href={`/events?view=board&f.status=${status}`}
              className="grid grid-cols-[6rem_1fr_2rem] items-center gap-2 hover:opacity-80"
            >
              <span className="text-[color:var(--muted)]">{labelize(status)}</span>
              <span className="h-2 overflow-hidden rounded-full bg-[color:var(--panel-soft)]">
                <span
                  className="block h-full rounded-full bg-[color:var(--accent)]"
                  style={{ width: `${(n / max) * 100}%` }}
                />
              </span>
              <span className="text-right tabular-nums">{n}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

async function SavedViewWidget({
  viewId,
  limit,
  userId,
}: {
  viewId?: number;
  limit: number;
  userId: number | null;
}) {
  if (!viewId) return <Empty>Pick a saved view in edit mode.</Empty>;
  const db = await getDb();
  const [view] = await db.select().from(savedViews).where(eq(savedViews.id, viewId)).limit(1);
  if (!view || (!view.shared && view.userId !== userId)) {
    return <Empty>This saved view no longer exists.</Empty>;
  }
  const config = VIEW_CONFIGS[view.entity];
  const state = parseViewState(new URLSearchParams(view.query), config);
  const all = applyViewState(await loadViewRows(view.entity), config, state, userId);
  const rows = all.slice(0, limit);
  const href = `${config.basePath}?${new URLSearchParams([...new URLSearchParams(view.query), ["sv", String(view.id)]])}`;
  return (
    <div>
      {rows.length === 0 ? (
        <Empty>No matching {config.pluralLabel.toLowerCase()}.</Empty>
      ) : (
        <ul className="divide-y divide-[color:var(--line)]">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={entityHref(view.entity, row.id)} className={rowClass}>
                <span className="font-medium text-[color:var(--ink)]">
                  {cellText(row.values[config.titleKey])}
                </span>
                <span className="shrink-0 text-[color:var(--muted)]">
                  {config.subtitleKeys
                    .map((key) => cellText(row.values[key]))
                    .filter(Boolean)
                    .join(" · ")
                    .slice(0, 60)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={href} className="mt-2 inline-block text-xs text-[color:var(--accent)]">
        {all.length > rows.length ? `All ${all.length} →` : "Open view →"}
      </Link>
    </div>
  );
}
