import { asc } from "drizzle-orm";
import { connection } from "next/server";
import { TaskForm } from "@/components/forms/task-form";
import { PageHeader } from "@/components/ui";
import { contacts, events, getDb } from "@/db";
import { createTask } from "@/lib/actions/tasks";

export default async function NewTaskPage() {
  await connection();
  const db = await getDb();
  const eventRows = await db.select().from(events).orderBy(asc(events.startsAt));
  const contactRows = await db.select().from(contacts).orderBy(asc(contacts.name));

  return (
    <div>
      <PageHeader title="New task" />
      <TaskForm
        action={createTask}
        events={eventRows}
        contacts={contactRows}
      />
    </div>
  );
}
