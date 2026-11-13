import Link from "next/link";
import { connection } from "next/server";
import {
  Badge,
  ButtonLink,
  DataTable,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { ensureSeedData } from "@/db/seed";
import { listUsers } from "@/lib/current-user";

export default async function UsersPage() {
  await connection();
  await ensureSeedData();
  const rows = await listUsers();

  return (
    <div>
      <PageHeader
        title="Users"
        description="Agency staff who can be assigned to events and tasks. Signing in auto-adds your Cursor email if it is not listed yet."
        actions={<ButtonLink href="/users/new">Add user</ButtonLink>}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No users yet"
          description="Add staff so you can assign work and send Resend notifications."
          action={<ButtonLink href="/users/new">Add user</ButtonLink>}
        />
      ) : (
        <DataTable
          headers={["Name", "Email", "Status", ""]}
          rows={rows.map((user) => [
            <span key={`${user.id}-name`} className="font-medium">
              {user.name}
            </span>,
            user.email,
            <Badge key={`${user.id}-status`}>
              {user.active ? "Active" : "Inactive"}
            </Badge>,
            <Link key={`${user.id}-edit`} href={`/users/${user.id}/edit`}>
              Edit
            </Link>,
          ])}
        />
      )}
    </div>
  );
}
