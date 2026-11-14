import { eq, inArray } from "drizzle-orm";
import { getDb, notificationPrefs } from "@/db";
import {
  CHANNELS,
  KINDS,
  defaultEnabled,
  isChannel,
  isKind,
  prefKey,
  type Channel,
  type NotificationKind,
} from "@/lib/notifications/prefs-shared";

/** userId -> "kind:channel" -> enabled, with defaults filled in. */
export async function loadPrefs(userIds: number[]): Promise<Map<number, Record<string, boolean>>> {
  const result = new Map<number, Record<string, boolean>>();
  for (const userId of userIds) {
    const matrix: Record<string, boolean> = {};
    for (const { kind } of KINDS) {
      for (const channel of CHANNELS) matrix[prefKey(kind, channel)] = defaultEnabled(kind, channel);
    }
    result.set(userId, matrix);
  }
  if (userIds.length === 0) return result;
  const db = await getDb({ system: true });
  const rows = await db.select().from(notificationPrefs).where(inArray(notificationPrefs.userId, userIds));
  for (const row of rows) {
    const matrix = result.get(row.userId);
    if (matrix && isKind(row.kind) && isChannel(row.channel)) {
      matrix[prefKey(row.kind, row.channel)] = row.enabled;
    }
  }
  return result;
}

export async function loadUserPrefs(userId: number) {
  return (await loadPrefs([userId])).get(userId)!;
}

export async function saveUserPrefs(
  userId: number,
  enabled: (kind: NotificationKind, channel: Channel) => boolean,
) {
  const db = await getDb({ system: true });
  await db.delete(notificationPrefs).where(eq(notificationPrefs.userId, userId));
  await db.insert(notificationPrefs).values(
    KINDS.flatMap(({ kind }) =>
      CHANNELS.map((channel) => ({ userId, kind, channel, enabled: enabled(kind, channel) })),
    ),
  );
}
