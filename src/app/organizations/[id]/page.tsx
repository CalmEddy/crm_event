import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { connection } from "next/server";
import { ActivityTimeline } from "@/components/activity-timeline";
import { ContactDetails } from "@/components/contact-details";
import { CustomFieldsPanel } from "@/components/custom-fields-panel";
import { NotesPanel } from "@/components/notes-panel";
import { RecordMetaPanel } from "@/components/record-meta-panel";
import { RecordListSection, RecordSummary, TaskListSection } from "@/components/record-page";
import { RelatedLinksPanel } from "@/components/related-links-panel";
import { Badge, ButtonLink, PageHeader, SubmitButton } from "@/components/ui";
import { contacts, eventContacts, events, getDb, organizations, tasks } from "@/db";
import { removeEventLink } from "@/lib/actions/events";
import { deleteOrganization } from "@/lib/actions/organizations";
import { labelize } from "@/lib/constants";
import {
  loadEntityOptions,
  loadNotesForEntity,
  loadRelatedLinksForEntity,
} from "@/lib/entities";
import { formatDateTime } from "@/lib/format";

export default async function OrganizationDetailPage({
  params,
}: PageProps<"/organizations/[id]">) {
  await connection();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const db = await getDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!org) notFound();

  const people = await db
    .select()
    .from(contacts)
    .where(eq(contacts.organizationId, id))
    .orderBy(asc(contacts.name));
  const venueEvents = await db
    .select()
    .from(events)
    .where(eq(events.venueOrganizationId, id))
    .orderBy(asc(events.startsAt));
  // Tasks for this organization's people.
  const peopleIds = people.map((person) => person.id);
  const orgTasks = peopleIds.length
    ? await db.select().from(tasks).where(inArray(tasks.contactId, peopleIds)).orderBy(asc(tasks.dueOn))
    : [];
  // Events this organization is booked on (the event's people & orgs).
  const eventLinks = await db
    .select({ link: eventContacts, event: events })
    .from(eventContacts)
    .innerJoin(events, eq(eventContacts.eventId, events.id))
    .where(eq(eventContacts.organizationId, id));

  const [options, noteRows, related] = await Promise.all([
    loadEntityOptions(),
    loadNotesForEntity({ type: "organization", id }),
    loadRelatedLinksForEntity({ type: "organization", id }),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        title={org.name}
        description={[labelize(org.type), org.city].filter(Boolean).join(" · ")}
        actions={
          <>
            <ButtonLink href={`/contacts/new?organizationId=${id}`}>Add contact</ButtonLink>
            <ButtonLink href={`/organizations/${id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            <form action={deleteOrganization.bind(null, id)}>
              <SubmitButton variant="danger">Delete</SubmitButton>
            </form>
          </>
        }
      />

      <RecordSummary
        badges={[
          <Badge key="type">{labelize(org.type)}</Badge>,
          org.city ? <Badge key="city">{org.city}</Badge> : null,
        ].filter(Boolean)}
        notes={org.notes}
      >
        <ContactDetails details={org} />
      </RecordSummary>

      <RecordMetaPanel entity="organization" id={id} />

      <RecordListSection
        title="People"
        empty="No contacts at this organization yet. Use “Add contact” to add one."
        items={people.map((person) => ({
          key: person.id,
          href: `/contacts/${person.id}`,
          label: person.name,
          detail: [person.role, person.email, person.phone].filter(Boolean).join(" · "),
        }))}
      />

      <RecordListSection
        title="Venue events"
        empty="No events at this venue."
        items={venueEvents.map((event) => ({
          key: event.id,
          href: `/events/${event.id}`,
          label: event.title,
          detail: [formatDateTime(event.startsAt), labelize(event.status)].join(" · "),
        }))}
      />

      <TaskListSection
        tasks={orgTasks}
        showEvent
        empty="No tasks for this organization's people."
      />

      <CustomFieldsPanel entity="organization" id={id} />

      <NotesPanel entityType="organization" entityId={id} notes={noteRows} options={options} />

      <RelatedLinksPanel
        entityType="organization"
        entityId={id}
        links={related}
        extraLinks={eventLinks.map(({ link, event }) => ({
          key: `event-contact-${link.id}`,
          type: "event" as const,
          id: event.id,
          label: event.title,
          href: `/events/${event.id}`,
          detail: [labelize(link.role), formatDateTime(event.startsAt), link.notes].filter(Boolean).join(" · "),
          remove: removeEventLink.bind(null, event.id, link.id, `/organizations/${id}`),
        }))}
      />

      <ActivityTimeline entity="organization" id={id} />
    </div>
  );
}
