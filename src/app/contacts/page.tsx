import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import {
  ButtonLink,
  DataTable,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { contacts, getDb, organizations } from "@/db";
import { ensureSeedData } from "@/db/seed";

export default async function ContactsPage() {
  await connection();
  await ensureSeedData();
  const db = await getDb();
  const rows = await db
    .select({
      contact: contacts,
      organizationName: organizations.name,
    })
    .from(contacts)
    .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
    .orderBy(asc(contacts.name));

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Buyers, comics, travel, and venue people."
        actions={<ButtonLink href="/contacts/new">Add contact</ButtonLink>}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          description="Add people you book with and assign them to organizations."
          action={<ButtonLink href="/contacts/new">Add contact</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={["Name", "Role", "Organization", "Email", ""]}
          rows={rows.map(({ contact, organizationName }) => [
            <Link
              key={`${contact.id}-name`}
              href={`/contacts/${contact.id}`}
              className="font-medium text-[color:var(--accent)]"
            >
              {contact.name}
            </Link>,
            contact.role || "—",
            organizationName || "—",
            contact.email || "—",
            <Link key={`${contact.id}-view`} href={`/contacts/${contact.id}`}>
              View
            </Link>,
          ])}
        />
      )}
    </div>
  );
}
