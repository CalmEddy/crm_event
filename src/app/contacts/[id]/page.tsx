import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import {
  ButtonLink,
  PageHeader,
  Section,
  SubmitButton,
} from "@/components/ui";
import {
  contacts,
  eventContacts,
  events,
  getDb,
  organizations,
  tasks,
} from "@/db";
import { deleteContact } from "@/lib/actions/contacts";
import { labelize } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

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
    ? await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, contact.organizationId))
    : [null];

  const links = await db
    .select({
      link: eventContacts,
      event: events,
    })
    .from(eventContacts)
    .innerJoin(events, eq(eventContacts.eventId, events.id))
    .where(eq(eventContacts.contactId, id));

  const relatedTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.contactId, id));

  return (
    <div className="space-y-8">
      <PageHeader
        title={contact.name}
        description={contact.role || "Contact"}
        actions={
          <>
            <ButtonLink href={`/contacts/${id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            <form action={deleteContact.bind(null, id)}>
              <SubmitButton variant="danger">Delete</SubmitButton>
            </form>
          </>
        }
      />

      <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-5 text-sm space-y-2">
        <p>
          <span className="text-[color:var(--muted)]">Email:</span>{" "}
          {contact.email || "—"}
        </p>
        <p>
          <span className="text-[color:var(--muted)]">Phone:</span>{" "}
          {contact.phone || "—"}
        </p>
        <p>
          <span className="text-[color:var(--muted)]">Organization:</span>{" "}
          {org ? (
            <Link
              href={`/organizations/${org.id}`}
              className="text-[color:var(--accent)]"
            >
              {org.name}
            </Link>
          ) : (
            "—"
          )}
        </p>
        <p className="whitespace-pre-wrap text-[color:var(--muted)] pt-2">
          {contact.notes || "No notes."}
        </p>
      </div>

      <Section title="Events">
        {links.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No linked events.</p>
        ) : (
          <ul className="space-y-2">
            {links.map(({ link, event }) => (
              <li key={link.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="text-[color:var(--accent)]"
                >
                  {event.title}
                </Link>
                <span className="text-sm text-[color:var(--muted)]">
                  {" "}
                  · {link.role} · {formatDateTime(event.startsAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Tasks">
        {relatedTasks.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No assigned tasks.</p>
        ) : (
          <ul className="space-y-2">
            {relatedTasks.map((task) => (
              <li key={task.id} className="text-sm">
                {task.title} · {formatDate(task.dueOn)} · {labelize(task.status)}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
