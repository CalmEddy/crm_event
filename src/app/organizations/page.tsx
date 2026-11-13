import { connection } from "next/server";
import { EntityDataView } from "@/components/data-view/entity-data-view";
import { ButtonLink, PageHeader } from "@/components/ui";
import { ensureSeedData } from "@/db/seed";

export default async function OrganizationsPage() {
  await connection();
  await ensureSeedData();
  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Venues, clubs, agencies, and promoters."
        actions={<ButtonLink href="/organizations/new">Add organization</ButtonLink>}
      />
      <EntityDataView entity="organization" />
    </div>
  );
}
