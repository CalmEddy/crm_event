import Link from "next/link";
import { asc } from "drizzle-orm";
import { connection } from "next/server";
import {
  ButtonLink,
  DataTable,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { getDb, organizations } from "@/db";
import { ensureSeedData } from "@/db/seed";
import { labelize } from "@/lib/constants";

export default async function OrganizationsPage() {
  await connection();
  await ensureSeedData();
  const db = await getDb();
  const rows = await db
    .select()
    .from(organizations)
    .orderBy(asc(organizations.name));

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Clubs, venues, agencies, and promoters."
        actions={<ButtonLink href="/organizations/new">Add organization</ButtonLink>}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No organizations yet"
          description="Add the clubs and agencies you book with."
          action={<ButtonLink href="/organizations/new">Add organization</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={["Name", "Type", "City", ""]}
          rows={rows.map((org) => [
            <Link
              key={`${org.id}-name`}
              href={`/organizations/${org.id}`}
              className="font-medium text-[color:var(--accent)]"
            >
              {org.name}
            </Link>,
            labelize(org.type),
            org.city || "—",
            <Link key={`${org.id}-view`} href={`/organizations/${org.id}`}>
              View
            </Link>,
          ])}
        />
      )}
    </div>
  );
}
