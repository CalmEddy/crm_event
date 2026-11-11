import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { OrganizationForm } from "@/components/forms/organization-form";
import { PageHeader } from "@/components/ui";
import { getDb, organizations } from "@/db";
import { updateOrganization } from "@/lib/actions/organizations";

export default async function EditOrganizationPage({
  params,
}: PageProps<"/organizations/[id]/edit">) {
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

  return (
    <div>
      <PageHeader title={`Edit ${org.name}`} />
      <OrganizationForm
        organization={org}
        action={updateOrganization.bind(null, id)}
      />
    </div>
  );
}
