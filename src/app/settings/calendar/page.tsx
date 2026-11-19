import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { EmptyState, PageHeader } from "@/components/ui";
import { getDb, googleCalendarAccounts } from "@/db";
import { ensureSeedData } from "@/db/seed";
import { getCurrentUser } from "@/lib/current-user";
import { googleConfigured } from "@/lib/google/config";
import { CalendarSettings } from "./calendar-settings";

export default async function CalendarSyncSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  await connection();
  await ensureSeedData();
  const user = await getCurrentUser();
  const params = await searchParams;

  if (!user) {
    return (
      <EmptyState
        title="No staff profile"
        description="Google Calendar sync belongs to a signed-in staff member."
      />
    );
  }

  const db = await getDb();
  const [account] = await db
    .select()
    .from(googleCalendarAccounts)
    .where(eq(googleCalendarAccounts.userId, user.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar sync"
        description="Push tasks and events you are assigned into your Google Calendar. Changes in Greenroom update Google; this does not pull edits back from Google."
      />
      {params.connected ? (
        <p className="text-sm text-[color:var(--accent)]" role="status">
          Google Calendar connected. Use Sync now to push your current assignments.
        </p>
      ) : null}
      {params.error ? (
        <p className="text-sm text-[color:var(--danger)]" role="alert">
          Could not connect: {params.error}
        </p>
      ) : null}
      <CalendarSettings
        configured={googleConfigured()}
        account={
          account
            ? {
                googleEmail: account.googleEmail,
                syncTasks: account.syncTasks,
                syncEvents: account.syncEvents,
                enabled: account.enabled,
                lastSyncedAt: account.lastSyncedAt,
                lastError: account.lastError,
              }
            : null
        }
      />
    </div>
  );
}
