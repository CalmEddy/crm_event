export type ParsedInboundFields = {
  name: string;
  email: string;
  phone: string;
  notes: string | null;
};

const FIELD_ALIASES: Record<keyof Omit<ParsedInboundFields, "notes"> | "notes", string[]> =
  {
    name: ["name", "contact name", "full name"],
    email: ["email", "e-mail", "email address"],
    phone: ["phone", "phone number", "tel", "telephone", "mobile"],
    notes: ["notes", "note", "event details", "details", "message"],
  };

function stripHtml(input: string) {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function normalizeKey(key: string) {
  return key.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

/**
 * Parse structured contact-form email bodies.
 * Expected lines: Name / Email / Phone (required), Notes (optional).
 */
export function parseInboundBody(rawBody: string): {
  fields: Partial<ParsedInboundFields>;
  missing: Array<"name" | "email" | "phone">;
} {
  const text = stripHtml(rawBody).replace(/\r\n/g, "\n");
  const found: Partial<ParsedInboundFields> = {};

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const key = normalizeKey(match[1]);
    const value = match[2].trim();
    if (!value) continue;

    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as Array<
      [keyof ParsedInboundFields, string[]]
    >) {
      if (aliases.includes(key) && found[field] == null) {
        found[field] = value;
      }
    }
  }

  const missing: Array<"name" | "email" | "phone"> = [];
  if (!found.name?.trim()) missing.push("name");
  if (!found.email?.trim()) missing.push("email");
  if (!found.phone?.trim()) missing.push("phone");

  return { fields: found, missing };
}

export function htmlOrTextToBody(text: string | null | undefined, html: string | null | undefined) {
  if (text?.trim()) return text;
  if (html?.trim()) return stripHtml(html);
  return "";
}
