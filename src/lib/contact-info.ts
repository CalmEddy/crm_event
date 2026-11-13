// Standard contact details shared by contacts and organizations (client-safe).

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "example.com" -> "https://example.com"; rejects things that aren't URLs. */
export function normalizeWebsite(value: string | null): string | null {
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) throw new Error();
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error("Enter a valid website");
  }
}

export const CONTACT_INFO_FIELDS = [
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "mobile", label: "Mobile", type: "tel" },
  { name: "website", label: "Website", type: "text" },
  { name: "address", label: "Street address", type: "text" },
  { name: "city", label: "City", type: "text" },
  { name: "region", label: "State / region", type: "text" },
  { name: "postalCode", label: "Postal code", type: "text" },
  { name: "country", label: "Country", type: "text" },
] as const;
export type ContactInfoKey = (typeof CONTACT_INFO_FIELDS)[number]["name"];

/** Read and validate the contact-detail inputs from a form. */
export function readContactInfo<K extends ContactInfoKey>(
  formData: FormData,
  keys: readonly K[],
): Record<K, string | null> {
  const out = {} as Record<K, string | null>;
  for (const key of keys) {
    const value = String(formData.get(key) ?? "").trim() || null;
    if (key === "email" && value && !EMAIL_RE.test(value)) {
      throw new Error("Enter a valid email address");
    }
    out[key] = key === "website" ? normalizeWebsite(value) : value;
  }
  return out;
}

export const CONTACT_KEYS = ["email", "phone", "mobile", "website", "address", "city", "region", "postalCode", "country"] as const;
export const ORGANIZATION_KEYS = ["email", "phone", "website", "address", "city", "region", "postalCode", "country"] as const;
