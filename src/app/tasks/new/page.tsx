import { asc } from "drizzle-orm";
import { connection } from "next/server";
import { TaskForm } from "@/components/forms/task-form";
import { PageHeader } from "@/components/ui";
import { contacts, events, getDb } from "@/db";
import { createTask } from "@/lib/actions/tasks";

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
  const eventRows = await db.select().from(events).orderBy(asc(events.startsAt));
  const contactRows = await db.select().from(contacts).orderBy(asc(contacts.name));

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
        defaults={{
          eventId: Number.isFinite(eventIdRaw) ? eventIdRaw : null,
          contactId: Number.isFinite(contactIdRaw) ? contactIdRaw : null,
        }}
      />
    </div>
  );
}
