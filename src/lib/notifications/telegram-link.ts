// Connecting a user's Telegram chat. The user opens the bot with a one-time
// code (t.me/<bot>?start=<code>); the bot then sees "/start <code>" from their
// chat, either through the webhook or through getUpdates.
import { eq } from "drizzle-orm";
import { getDb, users, type User } from "@/db";
import { sendTelegram, telegramApi } from "@/lib/notifications/channels";

export type TelegramUpdate = {
  update_id: number;
  message?: { text?: string; chat?: { id: number; type?: string } };
};

const START = /^\/start(?:@\w+)?\s+([a-f0-9]{16})\s*$/;

/** If this update is "/start <code>" for a pending user, connect them. */
export async function linkFromUpdate(update: TelegramUpdate): Promise<User | null> {
  const text = update.message?.text ?? "";
  const chat = update.message?.chat;
  const code = text.match(START)?.[1];
  // Private chats only: a group would broadcast one person's notifications.
  if (!code || !chat || (chat.type && chat.type !== "private")) return null;

  const db = await getDb({ system: true });
  const [user] = await db.select().from(users).where(eq(users.telegramLinkCode, code));
  if (!user) return null;
  const [updated] = await db
    .update(users)
    .set({ telegramChatId: String(chat.id), telegramLinkCode: null, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();
  await sendTelegram(
    String(chat.id),
    `Connected. Greenroom notifications for ${user.name} will arrive here. You can change what is sent in Greenroom under Notifications.`,
  );
  return updated ?? null;
}

const BARE_START = /^\/start(?:@\w+)?\s*$/;

/**
 * Look through the bot's recent messages for this user's code. Only works
 * while the bot has no webhook; with a webhook the link completes by itself.
 */
export async function pollForLink(userId: number): Promise<{ linked: boolean; message: string }> {
  const result = await telegramApi<TelegramUpdate[]>("getUpdates", {
    timeout: 0,
    allowed_updates: ["message"],
  });
  if (!result.ok) {
    if (result.code === 409) {
      return {
        linked: false,
        message:
          "The bot has not seen your message yet. Press Start in Telegram, wait a moment, then reload this page.",
      };
    }
    return { linked: false, message: result.error };
  }
  let linked = false;
  let last = 0;
  let sawBareStart = false;
  for (const update of result.result) {
    last = Math.max(last, update.update_id);
    const text = update.message?.text ?? "";
    if (BARE_START.test(text)) sawBareStart = true;
    const user = await linkFromUpdate(update);
    if (user?.id === userId) linked = true;
  }
  // Mark what we read as handled so old codes are not replayed.
  if (last) await telegramApi("getUpdates", { offset: last + 1, timeout: 0 });
  if (linked) return { linked: true, message: "Telegram is connected." };
  if (sawBareStart) {
    return {
      linked: false,
      message:
        "Telegram saw Start, but without your Greenroom link code. Use “Open the Greenroom bot in Telegram” on this page (not the bot from your chat list), press Start, then finish again.",
    };
  }
  return {
    linked: false,
    message: "No message from you yet. Open the link, press Start in Telegram, then try again.",
  };
}
