import Link from "next/link";
import { desc } from "drizzle-orm";
import { connection } from "next/server";
import {
  Badge,
  DataTable,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { inboundEmails, getDb } from "@/db";
import { ensureSeedData } from "@/db/seed";
import { labelize } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export default async function InboundPage() {
  await connection();
  await ensureSeedData();
  const db = await getDb();
  const rows = await db
    .select()
    .from(inboundEmails)
    .orderBy(desc(inboundEmails.createdAt))
    .limit(100);

  return (
    <div>
      <PageHeader
        title="Inbound"
        description="Contact-form emails received via Resend. Failures stay here until the form body is fixed and resent."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No inbound emails yet"
          description="Point a Resend Inbound webhook at /api/inbound/email and send a structured contact request."
        />
      ) : (
        <DataTable
          headers={["When", "From", "Subject", "Status", "Event", "Error"]}
          rows={rows.map((row) => [
            formatDateTime(row.createdAt),
            row.fromAddress || "—",
            row.subject || "—",
            <Badge key={`${row.id}-status`}>{labelize(row.status)}</Badge>,
            row.eventId ? (
              <Link
                key={`${row.id}-event`}
                href={`/events/${row.eventId}`}
                className="font-medium text-[color:var(--accent)]"
              >
                Event #{row.eventId}
              </Link>
            ) : (
              "—"
            ),
            row.error ? (
              <span className="text-[color:var(--danger)]">{row.error}</span>
            ) : (
              "—"
            ),
          ])}
        />
      )}
    </div>
  );
}
