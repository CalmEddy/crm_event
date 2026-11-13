import { and, eq, inArray } from "drizzle-orm";
import { getDb, notificationLog, users } from "@/db";
import { sendResendEmail } from "@/lib/notifications/resend-send";

export type NotificationKind = "assignment" | "record_change" | "task_due";

export async function notifyUsers(options: {
  kind: NotificationKind;
  entityType: string;
  entityId: number;
  userIds: number[];
  subject: string;
  body: string;
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

  let sent = 0;
  let skipped = 0;

  for (const user of recipients) {
    if (!user.email) {
      skipped += 1;
      continue;
    }

    const dedupeKey = `${options.dedupeKeyPrefix}:user:${user.id}`;
    try {
      await db.insert(notificationLog).values({
        userId: user.id,
        kind: options.kind,
        entityType: options.entityType,
        entityId: options.entityId,
        dedupeKey,
      });
    } catch {
      // Unique dedupe_key — already notified for this key.
      skipped += 1;
      continue;
    }

    const result = await sendResendEmail({
      to: user.email,
      subject: options.subject,
      text: options.body,
    });

    if (!result.ok) {
      await db
        .update(notificationLog)
        .set({ error: result.error })
        .where(eq(notificationLog.dedupeKey, dedupeKey));
      skipped += 1;
      continue;
    }

    if (result.skipped) {
      await db
        .update(notificationLog)
        .set({ error: result.reason })
        .where(eq(notificationLog.dedupeKey, dedupeKey));
      skipped += 1;
      continue;
    }

    sent += 1;
  }

  return { sent, skipped };
}
