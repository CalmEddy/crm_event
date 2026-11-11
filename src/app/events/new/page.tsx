import { asc } from "drizzle-orm";
import { connection } from "next/server";
import { EventForm } from "@/components/forms/event-form";
import { PageHeader } from "@/components/ui";
import { getDb, organizations } from "@/db";
import { createEvent } from "@/lib/actions/events";

export default async function NewEventPage() {
  await connection();
  const db = await getDb();
  const orgs = await db.select().from(organizations).orderBy(asc(organizations.name));
  return (
    <div>
      <PageHeader title="New event" />
      <EventForm action={createEvent} organizations={orgs} />
    </div>
  );
}
