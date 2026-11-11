import Link from "next/link";
import { asc, count } from "drizzle-orm";
import { connection } from "next/server";
import {
  ButtonLink,
  DataTable,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { getDb, taskGroups, taskTemplates } from "@/db";
import { ensureSeedData } from "@/db/seed";

export default async function TaskGroupsPage() {
  await connection();
  await ensureSeedData();
  const db = await getDb();
  const groups = await db.select().from(taskGroups).orderBy(asc(taskGroups.name));
  const templateCounts = await db
    .select({
      taskGroupId: taskTemplates.taskGroupId,
      value: count(),
    })
    .from(taskTemplates)
    .groupBy(taskTemplates.taskGroupId);
  const countByGroup = new Map(
    templateCounts.map((row) => [row.taskGroupId, Number(row.value)]),
  );

  return (
    <div>
      <PageHeader
        title="Task groups"
        description="Reusable relative task packs. Offsets are stored as days from the event start date."
        actions={<ButtonLink href="/task-groups/new">Add task group</ButtonLink>}
      />
      {groups.length === 0 ? (
        <EmptyState
          title="No task groups"
          description="Create a Standard booking pack with call / email / postcard templates."
          action={<ButtonLink href="/task-groups/new">Add task group</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={["Group", "Templates", "Description", ""]}
          rows={groups.map((group) => [
            <Link
              key={`${group.id}-name`}
              href={`/task-groups/${group.id}`}
              className="font-medium text-[color:var(--accent)]"
            >
              {group.name}
            </Link>,
            String(countByGroup.get(group.id) ?? 0),
            group.description || "—",
            <Link key={`${group.id}-view`} href={`/task-groups/${group.id}`}>
              Edit
            </Link>,
          ])}
        />
      )}
    </div>
  );
}
