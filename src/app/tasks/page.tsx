import { connection } from "next/server";
import { EntityDataView } from "@/components/data-view/entity-data-view";
import { ButtonLink, PageHeader } from "@/components/ui";
import { ensureSeedData } from "@/db/seed";

export default async function TasksPage() {
  await connection();
  await ensureSeedData();
  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Everything to do, by event, assignee, and due date."
        actions={<ButtonLink href="/tasks/new">Add task</ButtonLink>}
      />
      <EntityDataView entity="task" />
    </div>
  );
}
