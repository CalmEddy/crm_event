// Shared building blocks for record detail pages (events, tasks, contacts,
// organizations) so every "sheet" has the same layout.
import Link from "next/link";
import type { ReactNode } from "react";
import { eq, inArray } from "drizzle-orm";
import { Badge, Section, SubmitButton, inputClassName } from "@/components/ui";
import { events, getDb, taskAssignees, users, type Task } from "@/db";
import { updateTaskStatus } from "@/lib/actions/tasks";
import { TASK_STATUSES, labelize } from "@/lib/constants";
import { formatDate } from "@/lib/format";

/** Top card: badges, key facts, profile notes, optional controls/hint. */
export function RecordSummary({
  badges,
  facts = [],
  notes,
  children,
  hint,
}: {
  badges: ReactNode[];
  facts?: [string, ReactNode][];
  notes: string | null;
  children?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-5 text-sm">
      {badges.length ? <div className="flex flex-wrap gap-2">{badges}</div> : null}
      {children}
      {facts.length ? (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[7rem_1fr]">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-[color:var(--muted)]">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="whitespace-pre-wrap text-[color:var(--muted)]">{notes || "No notes."}</p>
      {hint ? <p className="text-xs text-[color:var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export function RecordLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-[color:var(--accent)] hover:underline">
      {children}
    </Link>
  );
}

export function BadgeLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href}>
      <Badge>{children}</Badge>
    </Link>
  );
}

export type ListItem = { key: string | number; href: string; label: string; detail?: string };

/** Section with a card list of linked records, in the same style as Tasks. */
export function RecordListSection({
  title,
  items,
  empty,
  actions,
}: {
  title: string;
  items: ListItem[];
  empty: string;
  actions?: ReactNode;
}) {
  return (
    <Section title={title} actions={actions}>
      {items.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">{empty}</p>
      ) : (
        <ul className="divide-y divide-[color:var(--line)] overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
          {items.map((item) => (
            <li key={item.key} className="px-4 py-3">
              <div className="font-medium">
                <RecordLink href={item.href}>{item.label}</RecordLink>
              </div>
              {item.detail ? <div className="text-sm text-[color:var(--muted)]">{item.detail}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** The Tasks section: due date, kind, assignees and a status control per task. */
export async function TaskListSection({
  tasks,
  actions,
  empty,
  showEvent = false,
}: {
  tasks: Task[];
  actions?: ReactNode;
  empty: string;
  /** Show each task's event (contact/organization pages). */
  showEvent?: boolean;
}) {
  const db = await getDb();
  const ids = tasks.map((task) => task.id);
  const assigneeRows = ids.length
    ? await db
        .select({ taskId: taskAssignees.taskId, name: users.name })
        .from(taskAssignees)
        .innerJoin(users, eq(taskAssignees.userId, users.id))
        .where(inArray(taskAssignees.taskId, ids))
    : [];
  const assignees = new Map<number, string[]>();
  for (const row of assigneeRows) assignees.set(row.taskId, [...(assignees.get(row.taskId) ?? []), row.name]);
  const eventIds = [...new Set(tasks.map((t) => t.eventId).filter((v): v is number => v != null))];
  const eventTitles = new Map(
    showEvent && eventIds.length
      ? (await db.select({ id: events.id, title: events.title }).from(events).where(inArray(events.id, eventIds))).map(
          (e) => [e.id, e.title] as const,
        )
      : [],
  );

  return (
    <Section title="Tasks" actions={actions}>
      {tasks.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">{empty}</p>
      ) : (
        <ul className="divide-y divide-[color:var(--line)] overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-medium">
                  <RecordLink href={`/tasks/${task.id}`}>{task.title}</RecordLink>
                </div>
                <div className="text-sm text-[color:var(--muted)]">
                  {[
                    formatDate(task.dueOn),
                    labelize(task.kind),
                    showEvent && task.eventId ? eventTitles.get(task.eventId) : null,
                    assignees.get(task.id)?.join(", "),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <TaskStatusForm taskId={task.id} status={task.status} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function TaskStatusForm({ taskId, status, label = "Update" }: { taskId: number; status: string; label?: string }) {
  return (
    <form action={updateTaskStatus.bind(null, taskId)} className="flex items-center gap-2">
      <select className={inputClassName} name="status" defaultValue={status} aria-label="Status">
        {TASK_STATUSES.map((value) => (
          <option key={value} value={value}>
            {labelize(value)}
          </option>
        ))}
      </select>
      <SubmitButton variant="secondary">{label}</SubmitButton>
    </form>
  );
}
