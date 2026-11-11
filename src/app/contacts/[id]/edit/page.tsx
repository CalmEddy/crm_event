import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { ContactForm } from "@/components/forms/contact-form";
import { PageHeader } from "@/components/ui";
import { contacts, getDb, organizations } from "@/db";
import { updateContact } from "@/lib/actions/contacts";

export default async function EditContactPage({
  params,
}: PageProps<"/contacts/[id]/edit">) {
  await connection();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const db = await getDb();
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
  if (!contact) notFound();
  const orgs = await db
    .select()
    .from(organizations)
    .orderBy(asc(organizations.name));

  return (
    <div>
      <PageHeader title={`Edit ${contact.name}`} />
      <ContactForm
        contact={contact}
        organizations={orgs}
        action={updateContact.bind(null, id)}
      />
    </div>
  );
}
