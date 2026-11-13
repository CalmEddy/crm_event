import { asc } from "drizzle-orm";
import { connection } from "next/server";
import { TaskForm } from "@/components/forms/task-form";
import { PageHeader } from "@/components/ui";
import { contacts, events, getDb } from "@/db";
import { createTask } from "@/lib/actions/tasks";
import { listActiveUsers } from "@/lib/current-user";

export default async function NewTaskPage({
  searchParams,
}: PageProps<"/tasks/new">) {
  await connection();
  const params = await searchParams;
  const eventIdRaw =
    typeof params.eventId === "string" ? Number(params.eventId) : NaN;
  const contactIdRaw =
    typeof params.contactId === "string" ? Number(params.contactId) : NaN;

  const db = await getDb();
  const [eventRows, contactRows, activeUsers] = await Promise.all([
    db.select().from(events).orderBy(asc(events.startsAt)),
    db.select().from(contacts).orderBy(asc(contacts.name)),
    listActiveUsers(),
  ]);

  return (
    <div>
      <PageHeader
        title="New task"
        description="Create a standalone task, optionally linked to an event or contact."
      />
      <TaskForm
        action={createTask}
        events={eventRows}
        contacts={contactRows}
        users={activeUsers}
        defaults={{
          eventId: Number.isFinite(eventIdRaw) ? eventIdRaw : null,
          contactId: Number.isFinite(contactIdRaw) ? contactIdRaw : null,
        }}
      />
    </div>
  );
}
