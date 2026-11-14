import { asc } from "drizzle-orm";
import { connection } from "next/server";
import { ContactForm } from "@/components/forms/contact-form";
import { PageHeader } from "@/components/ui";
import { getDb, organizations } from "@/db";
import { createContact } from "@/lib/actions/contacts";

export default async function NewContactPage({ searchParams }: PageProps<"/contacts/new">) {
  await connection();
  const params = await searchParams;
  const orgId = typeof params.organizationId === "string" ? Number(params.organizationId) : NaN;
  const db = await getDb();
  const orgs = await db.select().from(organizations).orderBy(asc(organizations.name));

  return (
    <div>
      <PageHeader title="New contact" />
      <ContactForm
        action={createContact}
        organizations={orgs}
        defaultOrganizationId={Number.isInteger(orgId) && orgs.some((o) => o.id === orgId) ? orgId : null}
      />
    </div>
  );
}
