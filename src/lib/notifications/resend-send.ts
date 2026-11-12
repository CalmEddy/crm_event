export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; id?: string; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

export async function sendResendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.RESEND_FROM_EMAIL?.trim() ?? "";

  if (!apiKey || !from) {
    const reason = !apiKey
      ? "RESEND_API_KEY is not configured"
      : "RESEND_FROM_EMAIL is not configured";
    console.info(`[notifications] skip email to ${input.to}: ${reason}`);
    return { ok: true, skipped: true, reason };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        error: `Resend ${response.status}: ${detail || response.statusText}`,
      };
    }

    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function appBaseUrl() {
  return (
    process.env.APP_BASE_URL?.trim().replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}
