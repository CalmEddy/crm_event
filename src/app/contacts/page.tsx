import { connection } from "next/server";
import { EntityDataView } from "@/components/data-view/entity-data-view";
import { ButtonLink, PageHeader } from "@/components/ui";
import { ensureSeedData } from "@/db/seed";

export default async function ContactsPage() {
  await connection();
  await ensureSeedData();
  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Buyers, comics, travel, and venue people."
        actions={<ButtonLink href="/contacts/new">Add contact</ButtonLink>}
      />
      <EntityDataView entity="contact" />
    </div>
  );
}
