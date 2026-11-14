// Outbound channels: email (Resend), SMS (Twilio) and Telegram (Bot API).
// Each one is skipped with a reason when its env is not set.
import type { User } from "@/db";
import { sendResendEmail, type SendEmailResult } from "@/lib/notifications/resend-send";
import type { Channel } from "@/lib/notifications/prefs-shared";

export type SendResult = SendEmailResult;

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

/** Which channels this server can actually send on. */
export function channelConfigured(): Record<Channel, boolean> {
  return {
    email: Boolean(env("RESEND_API_KEY") && env("RESEND_FROM_EMAIL")),
    sms: Boolean(env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && env("TWILIO_FROM_NUMBER")),
    telegram: Boolean(env("TELEGRAM_BOT_TOKEN")),
  };
}

/** Where a user receives a channel, or null when it is not set up. */
export function addressFor(user: User, channel: Channel): string | null {
  if (channel === "email") return user.email || null;
  if (channel === "sms") return user.phone || null;
  return user.telegramChatId || null;
}

export async function sendSms(to: string, text: string): Promise<SendResult> {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const from = env("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) {
    const reason = "Twilio is not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)";
    console.info(`[notifications] skip text message: ${reason}`);
    return { ok: true, skipped: true, reason };
  }
  try {
    const params = new URLSearchParams({ To: to, Body: text });
    // A Messaging Service SID (MG...) can be used in place of a sender number.
    params.set(from.startsWith("MG") ? "MessagingServiceSid" : "From", from);
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      },
    );
    const data = (await response.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!response.ok) {
      return { ok: false, error: `Twilio ${response.status}: ${data.message || response.statusText}` };
    }
    return { ok: true, id: data.sid };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

type TelegramResponse<T> = { ok: true; result: T } | { ok: false; error: string; code?: number };

export async function telegramApi<T>(
  method: string,
  payload: Record<string, unknown> = {},
): Promise<TelegramResponse<T>> {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" };
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: T;
      description?: string;
      error_code?: number;
    };
    if (!data.ok) {
      return {
        ok: false,
        error: `Telegram ${data.error_code ?? response.status}: ${data.description || response.statusText}`,
        code: data.error_code ?? response.status,
      };
    }
    return { ok: true, result: data.result as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function sendTelegram(chatId: string, text: string): Promise<SendResult> {
  if (!env("TELEGRAM_BOT_TOKEN")) {
    const reason = "TELEGRAM_BOT_TOKEN is not configured";
    console.info(`[notifications] skip Telegram message: ${reason}`);
    return { ok: true, skipped: true, reason };
  }
  const result = await telegramApi<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4000),
    link_preview_options: { is_disabled: true },
  });
  return result.ok ? { ok: true, id: String(result.result.message_id) } : { ok: false, error: result.error };
}

let botUsername: string | null = null;

/** The bot's @username, for the "open in Telegram" link. */
export async function telegramBotUsername(): Promise<string | null> {
  if (botUsername) return botUsername;
  const result = await telegramApi<{ username?: string }>("getMe");
  if (result.ok && result.result.username) botUsername = result.result.username;
  return botUsername;
}

export type OutboundMessage = { subject: string; body: string; url?: string | null };

/** Send one message to one user on one channel, shaped for that channel. */
export async function deliver(channel: Channel, user: User, message: OutboundMessage): Promise<SendResult> {
  const to = addressFor(user, channel);
  if (!to) return { ok: true, skipped: true, reason: `No ${channel} address on file` };
  if (channel === "email") {
    return sendResendEmail({ to, subject: message.subject, text: message.body });
  }
  if (channel === "sms") {
    // Texts stay short: the headline and a link to the details.
    const url = message.url ?? message.body.match(/^Open[^:\n]*: (\S+)$/m)?.[1];
    return sendSms(to, `Greenroom: ${message.subject}${url ? `\n${url}` : ""}`);
  }
  return sendTelegram(to, `${message.subject}\n\n${message.body}`);
}
