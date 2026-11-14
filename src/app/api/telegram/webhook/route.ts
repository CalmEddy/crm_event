import { NextResponse } from "next/server";
import { linkFromUpdate, type TelegramUpdate } from "@/lib/notifications/telegram-link";

/**
 * Telegram bot webhook. Its only job is connecting a user's chat when they
 * press Start with their one-time code. Telegram sends the secret configured
 * with setWebhook in the X-Telegram-Bot-Api-Secret-Token header.
 */
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const update = (await request.json()) as TelegramUpdate;
    await linkFromUpdate(update);
  } catch (error) {
    console.error("[telegram webhook]", error);
  }
  // Always 200 so Telegram does not retry the same update forever.
  return NextResponse.json({ ok: true });
}
