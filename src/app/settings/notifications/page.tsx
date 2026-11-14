import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { DataTable, EmptyState, PageHeader, Section } from "@/components/ui";
import { getDb, notificationLog } from "@/db";
import { ensureSeedData } from "@/db/seed";
import { getCurrentUser } from "@/lib/current-user";
import { formatDateTime } from "@/lib/format";
import { channelConfigured, telegramBotUsername } from "@/lib/notifications/channels";
import { loadUserPrefs } from "@/lib/notifications/prefs";
import { CHANNEL_LABELS, KINDS, isChannel } from "@/lib/notifications/prefs-shared";
import { NotificationSettings } from "./notification-settings";

export default async function NotificationSettingsPage() {
  await connection();
  await ensureSeedData();
  const user = await getCurrentUser();

  if (!user) {
    return (
      <EmptyState
        title="No staff profile"
        description="Notification settings belong to a signed-in staff member."
      />
    );
  }

  const db = await getDb();
  const configured = channelConfigured();
  const [prefs, recent, botUsername] = await Promise.all([
    loadUserPrefs(user.id),
    db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.userId, user.id))
      .orderBy(desc(notificationLog.sentAt))
      .limit(10),
    configured.telegram && user.telegramLinkCode ? telegramBotUsername() : null,
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notifications"
        description="Choose what Greenroom tells you about and where: email, text message or Telegram. These settings are yours alone."
      />
      <NotificationSettings
        email={user.email}
        phone={user.phone}
        leadDays={user.reminderLeadDays}
        prefs={prefs}
        configured={configured}
        telegram={{
          connected: Boolean(user.telegramChatId),
          code: user.telegramLinkCode,
          botUsername,
        }}
      />
      <Section title="Recent notifications">
        {recent.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">Nothing has been sent to you yet.</p>
        ) : (
          <DataTable
            headers={["When", "About", "Channel", "Result"]}
            rows={recent.map((row) => [
              formatDateTime(row.sentAt),
              KINDS.find((item) => item.kind === row.kind)?.label ?? row.kind,
              isChannel(row.channel) ? CHANNEL_LABELS[row.channel] : row.channel,
              row.error ? `Not sent: ${row.error}` : "Sent",
            ])}
          />
        )}
      </Section>
    </div>
  );
}
