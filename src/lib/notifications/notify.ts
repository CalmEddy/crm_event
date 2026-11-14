import { and, eq, inArray } from "drizzle-orm";
import { getDb, notificationLog, users } from "@/db";
import { addressFor, deliver } from "@/lib/notifications/channels";
import { loadPrefs } from "@/lib/notifications/prefs";
import { CHANNELS, prefKey, type NotificationKind } from "@/lib/notifications/prefs-shared";

export type { NotificationKind };

/**
 * Notify users about something, on every channel each of them has switched on
 * for this kind. The actor (whoever made the change) is never notified.
 */
export async function notifyUsers(options: {
  kind: NotificationKind;
  entityType: string;
  entityId: number;
  userIds: number[];
  subject: string;
  body: string;
  /** Link to the record, used for short channels such as SMS. */
  url?: string | null;
  dedupeKeyPrefix: string;
  actorUserId?: number | null;
}) {
  const uniqueIds = [...new Set(options.userIds)].filter(
    (id) => id !== options.actorUserId,
  );
  if (uniqueIds.length === 0) return { sent: 0, skipped: 0 };

  const db = await getDb({ system: true });
  const recipients = await db
    .select()
    .from(users)
    .where(and(inArray(users.id, uniqueIds), eq(users.active, true)));
  const prefs = await loadPrefs(recipients.map((user) => user.id));

  let sent = 0;
  let skipped = 0;

  for (const user of recipients) {
    for (const channel of CHANNELS) {
      if (!prefs.get(user.id)?.[prefKey(options.kind, channel)]) continue;
      if (!addressFor(user, channel)) {
        skipped += 1;
        continue;
      }

      // Email keeps the original key format so earlier sends still dedupe.
      const dedupeKey =
        `${options.dedupeKeyPrefix}:user:${user.id}` + (channel === "email" ? "" : `:${channel}`);
      try {
        await db.insert(notificationLog).values({
          userId: user.id,
          kind: options.kind,
          entityType: options.entityType,
          entityId: options.entityId,
          dedupeKey,
          channel,
        });
      } catch {
        // Unique dedupe_key: already notified for this key.
        skipped += 1;
        continue;
      }

      const result = await deliver(channel, user, options);
      if (result.ok && !result.skipped) {
        sent += 1;
        continue;
      }
      await db
        .update(notificationLog)
        .set({ error: result.ok ? result.reason : result.error })
        .where(eq(notificationLog.dedupeKey, dedupeKey));
      skipped += 1;
    }
  }

  return { sent, skipped };
}
