import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { EventForm } from "@/components/forms/event-form";
import { PageHeader } from "@/components/ui";
import { events, getDb, organizations } from "@/db";
import { updateEvent } from "@/lib/actions/events";

export default async function EditEventPage({
  params,
}: PageProps<"/events/[id]/edit">) {
  await connection();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const db = await getDb();
  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event) notFound();
  const orgs = await db
    .select()
    .from(organizations)
    .orderBy(asc(organizations.name));

  return (
    <div>
      <PageHeader title={`Edit ${event.title}`} />
      <EventForm
        event={event}
        organizations={orgs}
        action={updateEvent.bind(null, id)}
      />
    </div>
  );
}
