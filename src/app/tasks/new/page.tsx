import { asc } from "drizzle-orm";
import { connection } from "next/server";
import { TaskForm } from "@/components/forms/task-form";
import { PageHeader } from "@/components/ui";
import { contacts, events, getDb } from "@/db";
import { createTask } from "@/lib/actions/tasks";
import { listActiveUsers } from "@/lib/current-user";

export default async function NewTaskPage() {
  await connection();
  const db = await getDb();
  const [eventRows, contactRows, activeUsers] = await Promise.all([
    db.select().from(events).orderBy(asc(events.startsAt)),
    db.select().from(contacts).orderBy(asc(contacts.name)),
    listActiveUsers(),
  ]);

  return (
    <div>
      <PageHeader title="New task" />
      <TaskForm
        action={createTask}
        events={eventRows}
        contacts={contactRows}
        users={activeUsers}
      />
    </div>
  );
}
