import { connection } from "next/server";
import { ButtonLink, PageHeader } from "@/components/ui";
import {
  TeamCalendar,
  type CalendarItem,
} from "@/components/calendar/team-calendar";
import { ensureSeedData } from "@/db/seed";
import { getCurrentUserId } from "@/lib/current-user";
import { formatDateTime } from "@/lib/format";
import { loadViewRows } from "@/lib/views/load";
import type { Ref } from "@/lib/views/fields";

function dayKey(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  if (raw.length > 10) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  return raw.slice(0, 10);
}

function hasAssignee(assignees: unknown, userId: number | null) {
  if (userId == null) return false;
  if (!Array.isArray(assignees)) return false;
  return (assignees as Ref[]).some((a) => a.id === userId);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    tasks?: string;
    events?: string;
    mine?: string;
  }>;
}) {
  await connection();
  await ensureSeedData();
  const params = await searchParams;
  const showTasks = params.tasks !== "0";
  const showEvents = params.events !== "0";
  const mineOnly = params.mine === "1";
  const month = params.month?.trim() || "";

  const userId = await getCurrentUserId();
  const [taskRows, eventRows] = await Promise.all([
    loadViewRows("task"),
    loadViewRows("event"),
  ]);

  const items: CalendarItem[] = [];

  for (const row of taskRows) {
    if (mineOnly && !hasAssignee(row.values.assignees, userId)) continue;
    const day = dayKey(row.values.dueOn);
    if (!day) continue;
    items.push({
      id: row.id,
      kind: "task",
      title: String(row.values.title ?? `Task #${row.id}`),
      day,
      href: `/tasks/${row.id}`,
      status: typeof row.values.status === "string" ? row.values.status : undefined,
      subtitle:
        row.values.event && typeof row.values.event === "object"
          ? (row.values.event as Ref).label
          : undefined,
    });
  }

  for (const row of eventRows) {
    if (mineOnly && !hasAssignee(row.values.assignees, userId)) continue;
    const day = dayKey(row.values.startsAt);
    if (!day) continue;
    const startsAt =
      typeof row.values.startsAt === "string" ? row.values.startsAt : null;
    items.push({
      id: row.id,
      kind: "event",
      title: String(row.values.title ?? `Event #${row.id}`),
      day,
      href: `/events/${row.id}`,
      status: typeof row.values.status === "string" ? row.values.status : undefined,
      subtitle: startsAt ? formatDateTime(startsAt) : undefined,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Tasks by due date and events by start time. Connect Google Calendar under Settings to keep your assignments in sync."
        actions={
          <>
            <ButtonLink href="/tasks?view=calendar" variant="secondary">
              Tasks only
            </ButtonLink>
            <ButtonLink href="/events?view=calendar" variant="secondary">
              Events only
            </ButtonLink>
            <ButtonLink href="/tasks/new">Add task</ButtonLink>
          </>
        }
      />
      <TeamCalendar
        items={items}
        month={month}
        showTasks={showTasks}
        showEvents={showEvents}
        mineOnly={mineOnly}
      />
    </div>
  );
}
