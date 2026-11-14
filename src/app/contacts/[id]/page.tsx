import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { ActivityTimeline } from "@/components/activity-timeline";
import { ContactDetails } from "@/components/contact-details";
import { CustomFieldsPanel } from "@/components/custom-fields-panel";
import { NotesPanel } from "@/components/notes-panel";
import { RecordMetaPanel } from "@/components/record-meta-panel";
import { BadgeLink, RecordSummary, TaskListSection } from "@/components/record-page";
import { RelatedLinksPanel } from "@/components/related-links-panel";
import { Badge, ButtonLink, PageHeader, SubmitButton } from "@/components/ui";
import { contacts, eventContacts, events, getDb, organizations, tasks } from "@/db";
import { deleteContact } from "@/lib/actions/contacts";
import { removeEventLink } from "@/lib/actions/events";
import { labelize } from "@/lib/constants";
import {
  loadEntityOptions,
  loadNotesForEntity,
  loadRelatedLinksForEntity,
} from "@/lib/entities";
import { formatDateTime } from "@/lib/format";

export default async function ContactDetailPage({
  params,
}: PageProps<"/contacts/[id]">) {
  await connection();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const db = await getDb();
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
  if (!contact) notFound();

  const [org] = contact.organizationId
    ? await db.select().from(organizations).where(eq(organizations.id, contact.organizationId))
    : [null];

  // Events this person is booked on (the event's people & orgs).
  const eventLinks = await db
    .select({ link: eventContacts, event: events })
    .from(eventContacts)
    .innerJoin(events, eq(eventContacts.eventId, events.id))
    .where(eq(eventContacts.contactId, id));

  const contactTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.contactId, id))
    .orderBy(asc(tasks.dueOn));

  const [options, noteRows, related] = await Promise.all([
    loadEntityOptions(),
    loadNotesForEntity({ type: "contact", id }),
    loadRelatedLinksForEntity({ type: "contact", id }),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        title={contact.name}
        description={[contact.role, org?.name].filter(Boolean).join(" · ") || "Contact"}
        actions={
          <>
            <ButtonLink href={`/tasks/new?contactId=${id}`}>Add task</ButtonLink>
            <ButtonLink href={`/contacts/${id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            <form action={deleteContact.bind(null, id)}>
              <SubmitButton variant="danger">Delete</SubmitButton>
            </form>
          </>
        }
      />

      <RecordSummary
        badges={[
          contact.role ? <Badge key="role">{contact.role}</Badge> : null,
          org ? (
            <BadgeLink key="org" href={`/organizations/${org.id}`}>
              {org.name}
            </BadgeLink>
          ) : null,
        ].filter(Boolean)}
        notes={contact.notes}
      >
        <ContactDetails details={contact} />
      </RecordSummary>

      <RecordMetaPanel entity="contact" id={id} />

      <TaskListSection
        tasks={contactTasks}
        showEvent
        empty="No tasks for this contact. Use “Add task” to create one."
      />

      <CustomFieldsPanel entity="contact" id={id} />

      <NotesPanel entityType="contact" entityId={id} notes={noteRows} options={options} />

      <RelatedLinksPanel
        entityType="contact"
        entityId={id}
        links={related}
        extraLinks={eventLinks.map(({ link, event }) => ({
          key: `event-contact-${link.id}`,
          type: "event" as const,
          id: event.id,
          label: event.title,
          href: `/events/${event.id}`,
          detail: [labelize(link.role), formatDateTime(event.startsAt), link.notes].filter(Boolean).join(" · "),
          remove: removeEventLink.bind(null, event.id, link.id, `/contacts/${id}`),
        }))}
      />

      <ActivityTimeline entity="contact" id={id} />
    </div>
  );
}
