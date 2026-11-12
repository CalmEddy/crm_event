import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { TaskForm } from "@/components/forms/task-form";
import { PageHeader, SubmitButton } from "@/components/ui";
import { contacts, events, getDb, tasks } from "@/db";
import { listTaskAssigneeIds } from "@/lib/assignees";
import { deleteTask, updateTask } from "@/lib/actions/tasks";
import { listActiveUsers } from "@/lib/current-user";

export default async function EditTaskPage({
  params,
}: PageProps<"/tasks/[id]/edit">) {
  await connection();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const db = await getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) notFound();
  const [eventRows, contactRows, activeUsers, assigneeIds] = await Promise.all([
    db.select().from(events).orderBy(asc(events.startsAt)),
    db.select().from(contacts).orderBy(asc(contacts.name)),
    listActiveUsers(),
    listTaskAssigneeIds(id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${task.title}`}
        actions={
          <form action={deleteTask.bind(null, id)}>
            <SubmitButton variant="danger">Delete</SubmitButton>
          </form>
        }
      />
      <TaskForm
        task={task}
        events={eventRows}
        contacts={contactRows}
        users={activeUsers}
        assigneeIds={assigneeIds}
        action={updateTask.bind(null, id)}
      />
    </div>
  );
}
