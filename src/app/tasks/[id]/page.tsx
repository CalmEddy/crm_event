import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { ActivityTimeline } from "@/components/activity-timeline";
import { CustomFieldsPanel } from "@/components/custom-fields-panel";
import { NotesPanel } from "@/components/notes-panel";
import { RecordMetaPanel } from "@/components/record-meta-panel";
import { RecordLink, RecordSummary, TaskStatusForm } from "@/components/record-page";
import { RelatedLinksPanel } from "@/components/related-links-panel";
import { Badge, ButtonLink, PageHeader, SubmitButton } from "@/components/ui";
import { contacts, events, getDb, tasks } from "@/db";
import { deleteTask } from "@/lib/actions/tasks";
import { labelize } from "@/lib/constants";
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

  const [options, noteRows, related] = await Promise.all([
    loadEntityOptions(),
    loadNotesForEntity({ type: "task", id }),
    loadRelatedLinksForEntity({ type: "task", id }),
  ]);

  const followUp = new URLSearchParams();
  if (task.eventId) followUp.set("eventId", String(task.eventId));
  if (task.contactId) followUp.set("contactId", String(task.contactId));

  return (
    <div className="space-y-10">
      <PageHeader
        title={task.title}
        description={`${formatDate(task.dueOn)} · ${labelize(task.kind)}`}
        actions={
          <>
            <ButtonLink href={`/tasks/new${followUp.size ? `?${followUp}` : ""}`}>Add task</ButtonLink>
            <ButtonLink href={`/tasks/${id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            <form action={deleteTask.bind(null, id)}>
              <SubmitButton variant="danger">Delete</SubmitButton>
            </form>
          </>
        }
      />

      <RecordSummary
        badges={[
          <Badge key="status">{labelize(task.status)}</Badge>,
          <Badge key="kind">{labelize(task.kind)}</Badge>,
        ]}
        facts={[
          ["Due", formatDate(task.dueOn)],
          ["Event", event ? <RecordLink href={`/events/${event.id}`}>{event.title}</RecordLink> : "—"],
          ["Contact", contact ? <RecordLink href={`/contacts/${contact.id}`}>{contact.name}</RecordLink> : "—"],
          ["Status", <TaskStatusForm key="status" taskId={id} status={task.status} />],
        ]}
        notes={task.notes}
      />

      <RecordMetaPanel entity="task" id={id} />

      <CustomFieldsPanel entity="task" id={id} />

      <NotesPanel entityType="task" entityId={id} notes={noteRows} options={options} />

      <RelatedLinksPanel entityType="task" entityId={id} links={related} options={options} />

      <ActivityTimeline entity="task" id={id} />
    </div>
  );
}
