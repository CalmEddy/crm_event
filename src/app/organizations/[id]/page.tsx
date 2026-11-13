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
} from "@/components/ui";
import { contacts, events, getDb, organizations } from "@/db";
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
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id));
  if (!org) notFound();

  const people = await db
    .select()
    .from(contacts)
    .where(eq(contacts.organizationId, id));
  const relatedEvents = await db
    .select()
    .from(events)
    .where(eq(events.venueOrganizationId, id));

  const [options, noteRows, related] = await Promise.all([
    loadEntityOptions(),
    loadNotesForEntity({ type: "organization", id }),
    loadRelatedLinksForEntity({ type: "organization", id }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={org.name}
        description={[labelize(org.type), org.city].filter(Boolean).join(" · ")}
        actions={
          <>
            <ButtonLink href={`/organizations/${id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            <form action={deleteOrganization.bind(null, id)}>
              <SubmitButton variant="danger">Delete</SubmitButton>
            </form>
          </>
        }
      />

      <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-5 text-sm">
        <div className="mb-2 flex gap-2">
          <Badge>{labelize(org.type)}</Badge>
          {org.city ? <Badge>{org.city}</Badge> : null}
        </div>
        {org.address ? <p>{org.address}</p> : null}
        <p className="mt-3 whitespace-pre-wrap text-[color:var(--muted)]">
          {org.notes || "No profile notes."}
        </p>
      </div>

      <Section title="Contacts">
        {people.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No contacts linked.</p>
        ) : (
          <ul className="space-y-2">
            {people.map((person) => (
              <li key={person.id}>
                <Link
                  href={`/contacts/${person.id}`}
                  className="text-[color:var(--accent)]"
                >
                  {person.name}
                </Link>
                {person.role ? (
                  <span className="text-sm text-[color:var(--muted)]">
                    {" "}
                    · {person.role}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Venue events">
        {relatedEvents.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No events as venue org.</p>
        ) : (
          <ul className="space-y-2">
            {relatedEvents.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="text-[color:var(--accent)]"
                >
                  {event.title}
                </Link>
                <span className="text-sm text-[color:var(--muted)]">
                  {" "}
                  · {formatDateTime(event.startsAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <NotesPanel
        entityType="organization"
        entityId={id}
        notes={noteRows}
        options={options}
      />

      <RelatedLinksPanel
        entityType="organization"
        entityId={id}
        links={related}
        options={options}
      />

      <ActivityTimeline entity="organization" id={id} />
    </div>
  );
}
