import { PageHeader } from "@/components/ui";
import { OrganizationForm } from "@/components/forms/organization-form";
import { createOrganization } from "@/lib/actions/organizations";

export default function NewOrganizationPage() {
  return (
    <div>
      <PageHeader
        title="New organization"
        description="Venues, clubs, agencies, promoters, and other partners."
      />
      <OrganizationForm action={createOrganization} />
    </div>
  );
}
