import { Webhook } from "svix";

export type ResendReceivedEvent = {
  type: string;
  created_at?: string;
  data: {
    email_id: string;
    from?: string;
    to?: string[];
    subject?: string | null;
    message_id?: string | null;
    attachments?: unknown[];
  };
};

export function verifyResendWebhook(
  payload: string,
  headers: {
    id: string | null;
    timestamp: string | null;
    signature: string | null;
  },
): ResendReceivedEvent {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    throw new Error("RESEND_WEBHOOK_SECRET is not configured");
  }
  if (!headers.id || !headers.timestamp || !headers.signature) {
    throw new Error("Missing Svix webhook headers");
  }

  const wh = new Webhook(secret);
  // svix@2 verify() validates signatures and returns undefined; parse yourself.
  wh.verify(payload, {
    "svix-id": headers.id,
    "svix-timestamp": headers.timestamp,
    "svix-signature": headers.signature,
  });
  return JSON.parse(payload) as ResendReceivedEvent;
}

export type ReceivedEmailContent = {
  id: string;
  from?: string | null;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
};

export async function fetchReceivedEmail(
  emailId: string,
): Promise<ReceivedEmailContent> {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const response = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Failed to fetch received email ${emailId}: ${response.status} ${detail}`,
    );
  }

  return (await response.json()) as ReceivedEmailContent;
}
