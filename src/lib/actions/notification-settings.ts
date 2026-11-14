"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, users } from "@/db";
import { getCurrentUser } from "@/lib/current-user";
import { addressFor, channelConfigured, deliver } from "@/lib/notifications/channels";
import { sendDueTaskDigests } from "@/lib/notifications/due-tasks";
import { saveUserPrefs } from "@/lib/notifications/prefs";
import {
  CHANNEL_LABELS,
  LEAD_DAY_OPTIONS,
  isChannel,
  prefKey,
} from "@/lib/notifications/prefs-shared";
import { appBaseUrl } from "@/lib/notifications/resend-send";
import { pollForLink } from "@/lib/notifications/telegram-link";

export type SettingsState = { ok?: string; error?: string };

const PAGE = "/settings/notifications";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required to continue.");
  return user;
}

/** "+1 (555) 010-2000" -> "+15550102000". Null when it is not a full international number. */
function normalizePhone(raw: string): string | null {
  const value = raw.replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{6,14}$/.test(value) ? value : null;
}

export async function saveNotificationSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  try {
    const user = await requireUser();
    const phoneRaw = String(formData.get("phone") ?? "").trim();
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phoneRaw && !phone) {
      return {
        error: "Enter the mobile number with its country code, for example +1 555 010 2000.",
      };
    }
    const lead = Number(formData.get("reminderLeadDays"));
    const reminderLeadDays = (LEAD_DAY_OPTIONS as readonly number[]).includes(lead) ? lead : 1;

    const db = await getDb();
    await db
      .update(users)
      .set({ phone, reminderLeadDays, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await saveUserPrefs(user.id, (kind, channel) => formData.get(`pref:${prefKey(kind, channel)}`) === "on");
    revalidatePath(PAGE);
    return { ok: "Notification settings saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save settings." };
  }
}

/** Create the one-time code the user sends to the bot. */
export async function startTelegramLink() {
  const user = await requireUser();
  const db = await getDb();
  await db
    .update(users)
    .set({ telegramLinkCode: randomBytes(8).toString("hex") })
    .where(eq(users.id, user.id));
  revalidatePath(PAGE);
}

export async function finishTelegramLink(): Promise<SettingsState> {
  try {
    const user = await requireUser();
    const result = await pollForLink(user.id);
    revalidatePath(PAGE);
    return result.linked ? { ok: result.message } : { error: result.message };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not connect Telegram." };
  }
}

export async function disconnectTelegram() {
  const user = await requireUser();
  const db = await getDb();
  await db
    .update(users)
    .set({ telegramChatId: null, telegramLinkCode: null })
    .where(eq(users.id, user.id));
  revalidatePath(PAGE);
}

export async function sendTestNotification(
  channelRaw: string,
): Promise<SettingsState> {
  try {
    const user = await requireUser();
    if (!isChannel(channelRaw)) return { error: "Unknown channel." };
    const label = CHANNEL_LABELS[channelRaw];
    if (!addressFor(user, channelRaw)) {
      return {
        error:
          channelRaw === "sms"
            ? "Save a mobile number first."
            : channelRaw === "telegram"
              ? "Connect Telegram first."
              : "No email address on your account.",
      };
    }
    if (!channelConfigured()[channelRaw]) {
      return { error: `${label} is not set up on this server yet, so nothing was sent.` };
    }
    const url = `${appBaseUrl()}${PAGE}`;
    const result = await deliver(channelRaw, user, {
      subject: "Test notification",
      body: [
        `Hi ${user.name},`,
        "",
        `This is a test from Greenroom. ${label} notifications are working.`,
        "",
        `Open: ${url}`,
      ].join("\n"),
      url,
    });
    if (!result.ok) return { error: `${label} failed: ${result.error}` };
    if (result.skipped) return { error: result.reason };
    return { ok: `Test sent by ${label.toLowerCase()}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not send the test." };
  }
}

/** Send the signed-in user's task reminder now, on the channels they chose. */
export async function sendMyReminderNow(): Promise<SettingsState> {
  try {
    const user = await requireUser();
    const result = await sendDueTaskDigests(new Date(), { onlyUserId: user.id, force: true });
    revalidatePath(PAGE);
    if (result.messagesSent > 0) {
      return { ok: `Reminder sent (${result.messagesSent} message${result.messagesSent === 1 ? "" : "s"}).` };
    }
    return {
      error:
        "Nothing was sent. Either you have no open tasks in your reminder window, or none of your chosen channels can send yet. See recent notifications below.",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not send the reminder." };
  }
}
