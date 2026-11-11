import Link from "next/link";
import { asc } from "drizzle-orm";
import { connection } from "next/server";
import {
  Badge,
  ButtonLink,
  DataTable,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { events, getDb } from "@/db";
import { ensureSeedData } from "@/db/seed";
import { labelize } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export default async function EventsPage() {
  await connection();
  await ensureSeedData();
  const db = await getDb();
  const rows = await db.select().from(events).orderBy(asc(events.startsAt));

  return (
    <div>
      <PageHeader
        title="Events"
        description="Shows and bookings with linked people, orgs, and tasks."
        actions={<ButtonLink href="/events/new">Add event</ButtonLink>}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Create a show date to attach contacts and apply task groups."
          action={<ButtonLink href="/events/new">Add event</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={["Event", "When", "Venue", "Status", ""]}
          rows={rows.map((event) => [
            <Link
              key={`${event.id}-title`}
              href={`/events/${event.id}`}
              className="font-medium text-[color:var(--accent)]"
            >
              {event.title}
            </Link>,
            formatDateTime(event.startsAt),
            event.venue || event.location || "—",
            <Badge key={`${event.id}-status`}>{labelize(event.status)}</Badge>,
            <Link key={`${event.id}-view`} href={`/events/${event.id}`}>
              View
            </Link>,
          ])}
        />
      )}
    </div>
  );
}
