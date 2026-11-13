import { connection } from "next/server";
import { EntityDataView } from "@/components/data-view/entity-data-view";
import { ButtonLink, PageHeader } from "@/components/ui";
import { ensureSeedData } from "@/db/seed";

export default async function EventsPage() {
  await connection();
  await ensureSeedData();
  return (
    <div>
      <PageHeader
        title="Events"
        description="Shows and bookings with linked people, orgs, and tasks."
        actions={<ButtonLink href="/events/new">Add event</ButtonLink>}
      />
      <EntityDataView entity="event" />
    </div>
  );
}
