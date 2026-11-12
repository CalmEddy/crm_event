import { NextResponse } from "next/server";
import { processInboundEmail } from "@/lib/inbound/process";
import { fetchReceivedEmail, verifyResendWebhook } from "@/lib/inbound/resend";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();

  let event;
  try {
    event = verifyResendWebhook(payload, {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const emailId = event.data?.email_id;
  if (!emailId) {
    return NextResponse.json(
      { error: "Missing data.email_id" },
      { status: 400 },
    );
  }

  let bodyText: string | null = null;
  let bodyHtml: string | null = null;
  let subject = event.data.subject ?? null;
  let fromAddress = event.data.from ?? null;

  try {
    const content = await fetchReceivedEmail(emailId);
    bodyText = content.text ?? null;
    bodyHtml = content.html ?? null;
    subject = content.subject ?? subject;
    fromAddress = content.from ?? fromAddress;
  } catch (error) {
    // Transient — let Resend retry. Do not write a failed intake row yet.
    const message =
      error instanceof Error ? error.message : "Failed to load email body";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const result = await processInboundEmail({
    providerMessageId: emailId,
    subject,
    fromAddress,
    bodyText,
    bodyHtml,
  });

  // 200 after verification so parse failures are stored once and not retried forever.
  return NextResponse.json(result);
}
