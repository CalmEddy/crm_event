import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { ActivityTimeline } from "@/components/activity-timeline";
import { NotesPanel } from "@/components/notes-panel";
import { RelatedLinksPanel } from "@/components/related-links-panel";
import {
  Badge,
  ButtonLink,
  PageHeader,
  Section,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import { contacts, events, getDb, tasks } from "@/db";
import { usersByIds, listTaskAssigneeIds } from "@/lib/assignees";
import { deleteTask, updateTaskStatus } from "@/lib/actions/tasks";
import { TASK_STATUSES, labelize } from "@/lib/constants";
import {
  loadEntityOptions,
  loadNotesForEntity,
  loadRelatedLinksForEntity,
} from "@/lib/entities";
import { formatDate } from "@/lib/format";

export default async function TaskDetailPage({
  params,
}: PageProps<"/tasks/[id]">) {
  await connection();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const db = await getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) notFound();

  const [event] = task.eventId
    ? await db.select().from(events).where(eq(events.id, task.eventId))
    : [null];
  const [contact] = task.contactId
    ? await db.select().from(contacts).where(eq(contacts.id, task.contactId))
    : [null];

  const [options, noteRows, related, assigneeIds] = await Promise.all([
    loadEntityOptions(),
    loadNotesForEntity({ type: "task", id }),
    loadRelatedLinksForEntity({ type: "task", id }),
    listTaskAssigneeIds(id),
  ]);
  const assigneeUsers = await usersByIds(assigneeIds);

  return (
    <div className="space-y-10">
      <PageHeader
        title={task.title}
        description={`${formatDate(task.dueOn)} · ${labelize(task.kind)}`}
        actions={
          <>
            <ButtonLink href={`/tasks/${id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            <form action={deleteTask.bind(null, id)}>
              <SubmitButton variant="danger">Delete</SubmitButton>
            </form>
          </>
        }
      />

      <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge>{labelize(task.status)}</Badge>
          <Badge>{labelize(task.kind)}</Badge>
        </div>
        <p className="text-sm">
          <span className="text-[color:var(--muted)]">Event:</span>{" "}
          {event ? (
            <Link href={`/events/${event.id}`} className="text-[color:var(--accent)]">
              {event.title}
            </Link>
          ) : (
            "—"
          )}
        </p>
        <p className="text-sm">
          <span className="text-[color:var(--muted)]">Contact:</span>{" "}
          {contact ? (
            <Link
              href={`/contacts/${contact.id}`}
              className="text-[color:var(--accent)]"
            >
              {contact.name}
            </Link>
          ) : (
            "—"
          )}
        </p>
        <p className="text-sm text-[color:var(--muted)]">
          Assignees:{" "}
          {assigneeUsers.length > 0
            ? assigneeUsers.map((user) => user.name).join(", ")
            : "None — edit the task to assign staff."}
        </p>
        <p className="whitespace-pre-wrap text-sm text-[color:var(--muted)]">
          {task.notes || "No profile notes on this task."}
        </p>
        <form
          action={updateTaskStatus.bind(null, id)}
          className="flex flex-wrap items-center gap-2 pt-2"
        >
          <select
            className={inputClassName}
            name="status"
            defaultValue={task.status}
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {labelize(status)}
              </option>
            ))}
          </select>
          <SubmitButton variant="secondary">Update status</SubmitButton>
        </form>
      </div>

      <NotesPanel
        entityType="task"
        entityId={id}
        notes={noteRows}
        options={options}
      />

      <RelatedLinksPanel
        entityType="task"
        entityId={id}
        links={related}
        options={options}
      />

      <ActivityTimeline entity="task" id={id} />

      <Section title="Quick actions">
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/tasks/new">Create another task</ButtonLink>
          {task.eventId ? (
            <ButtonLink
              href={`/events/${task.eventId}`}
              variant="secondary"
            >
              Open event
            </ButtonLink>
          ) : null}
        </div>
      </Section>
    </div>
  );
}
