import { format, parseISO, isValid } from "date-fns";

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(date)) return String(value);
  return format(date, "MMM d, yyyy");
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(date)) return String(value);
  return format(date, "MMM d, yyyy · h:mm a");
}

export function toDateInputValue(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(date)) return "";
  return format(date, "yyyy-MM-dd");
}

export function toDateTimeLocalValue(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (!isValid(date)) return "";
  return format(date, "yyyy-MM-dd'T'HH:mm");
}
