import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AddDialog } from "@/components/add-dialog";
import { CustomFieldsPanel } from "@/components/custom-fields-panel";
import { NotesPanel } from "@/components/notes-panel";
import { RecordMetaPanel } from "@/components/record-meta-panel";
import { BadgeLink, RecordSummary, TaskListSection } from "@/components/record-page";
import { RelatedLinksPanel } from "@/components/related-links-panel";
import {
  Badge,
  ButtonLink,
  Field,
  PageHeader,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import {
  contacts,
  eventContacts,
  events,
  getDb,
  organizations,
  taskGroupApplications,
  taskGroups,
  tasks,
} from "@/db";
import { deleteEvent, removeEventLink } from "@/lib/actions/events";
import {
  applyTaskGroupToEvent,
  recalculateOpenTasksFromTemplates,
} from "@/lib/actions/task-groups";
import { labelize } from "@/lib/constants";
import {
  loadEntityOptions,
  loadNotesForEntity,
  loadRelatedLinksForEntity,
} from "@/lib/entities";
import { formatDateTime } from "@/lib/format";
import { formatOffsetLabel } from "@/lib/offsets";

export default async function EventDetailPage({
  params,
}: PageProps<"/events/[id]">) {
  await connection();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const db = await getDb();
  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event) notFound();

  const [venueOrg] = event.venueOrganizationId
    ? await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, event.venueOrganizationId))
    : [null];

  const links = await db
    .select({ link: eventContacts, contact: contacts, organization: organizations })
    .from(eventContacts)
    .leftJoin(contacts, eq(eventContacts.contactId, contacts.id))
    .leftJoin(organizations, eq(eventContacts.organizationId, organizations.id))
    .where(eq(eventContacts.eventId, id));

  const eventTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.eventId, id))
    .orderBy(asc(tasks.dueOn));

  const groups = await db.select().from(taskGroups).orderBy(asc(taskGroups.name));
  const applications = await db
    .select({ group: taskGroups })
    .from(taskGroupApplications)
    .innerJoin(taskGroups, eq(taskGroupApplications.taskGroupId, taskGroups.id))
    .where(eq(taskGroupApplications.eventId, id));

  const [options, noteRows, related] = await Promise.all([
    loadEntityOptions(),
    loadNotesForEntity({ type: "event", id }),
    loadRelatedLinksForEntity({ type: "event", id }),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        title={event.title}
        description={`${formatDateTime(event.startsAt)} · ${event.venue || event.location || "Venue TBD"}`}
        actions={
          <>
            <ButtonLink href={`/tasks/new?eventId=${id}`}>Add task</ButtonLink>
            <ButtonLink href={`/events/${id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            <form action={deleteEvent.bind(null, id)}>
              <SubmitButton variant="danger">Delete</SubmitButton>
            </form>
          </>
        }
      />

      <RecordSummary
        badges={[
          <Badge key="status">{labelize(event.status)}</Badge>,
          venueOrg ? (
            <BadgeLink key="venue" href={`/organizations/${venueOrg.id}`}>
              {venueOrg.name}
            </BadgeLink>
          ) : null,
        ].filter(Boolean)}
        facts={[
          ["When", formatDateTime(event.startsAt)],
          ["Venue", [event.venue, event.location].filter(Boolean).join(" · ") || "—"],
        ]}
        notes={event.notes}
        hint="Changing the event date does not auto-shift existing tasks. Use “Recalculate from templates” for incomplete template-linked tasks."
      />

      <RecordMetaPanel entity="event" id={id} />

      <TaskListSection
        tasks={eventTasks}
        empty="No tasks yet. Use “Apply task group” to add a set of tasks."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <form action={recalculateOpenTasksFromTemplates.bind(null, id)}>
              <SubmitButton variant="secondary">Recalculate from templates</SubmitButton>
            </form>
            <AddDialog label="Apply task group" title="Apply task group">
              {applications.length > 0 ? (
                <p className="mb-3 text-sm text-[color:var(--muted)]">
                  Already applied: {applications.map(({ group }) => group.name).join(", ")}.
                  Re-apply uses “add missing only” to skip templates that already spawned a task.
                </p>
              ) : null}
              <form action={applyTaskGroupToEvent.bind(null, id)} className="space-y-3">
                <Field
                  label="Task group"
                  hint="dueOn = event date + offsetDays (negative before, positive after)"
                >
                  <select className={inputClassName} name="taskGroupId" required>
                    <option value="">Select group</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Mode">
                  <select className={inputClassName} name="mode" defaultValue="block">
                    <option value="block">Apply once (block if already applied)</option>
                    <option value="add_missing">Add missing only</option>
                  </select>
                </Field>
                <SubmitButton>Apply to event</SubmitButton>
              </form>
              {groups.length === 0 ? (
                <p className="mt-3 text-sm text-[color:var(--muted)]">
                  Create a task group first. Example offsets: {formatOffsetLabel(-14)},{" "}
                  {formatOffsetLabel(2)}, {formatOffsetLabel(182)}.
                </p>
              ) : null}
            </AddDialog>
          </div>
        }
      />

      <CustomFieldsPanel entity="event" id={id} />

      <NotesPanel entityType="event" entityId={id} notes={noteRows} options={options} />

      <RelatedLinksPanel
        entityType="event"
        entityId={id}
        links={related}
        extraLinks={links
          .map(({ link, contact, organization }) => {
            const target = contact
              ? { type: "contact" as const, id: contact.id, label: contact.name, href: `/contacts/${contact.id}` }
              : organization
                ? { type: "organization" as const, id: organization.id, label: organization.name, href: `/organizations/${organization.id}` }
                : null;
            if (!target) return null;
            return {
              key: `event-contact-${link.id}`,
              ...target,
              detail: [labelize(link.role), contact && organization ? organization.name : null, link.notes]
                .filter(Boolean)
                .join(" · "),
              remove: removeEventLink.bind(null, id, link.id, undefined),
            };
          })
          .filter((row) => row != null)}
      />

      <ActivityTimeline entity="event" id={id} />
    </div>
  );
}
