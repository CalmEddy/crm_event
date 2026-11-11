export const ORGANIZATION_TYPES = [
  "venue",
  "club",
  "agency",
  "promoter",
  "other",
] as const;

export const EVENT_STATUSES = [
  "inquiry",
  "booked",
  "completed",
  "canceled",
] as const;

export const TASK_KINDS = [
  "travel",
  "payment",
  "call",
  "email",
  "follow_up",
  "other",
] as const;

export const TASK_STATUSES = ["todo", "doing", "done", "skipped"] as const;

export const EVENT_LINK_ROLES = [
  "performer",
  "buyer",
  "venue contact",
  "travel",
  "promoter",
  "contact",
  "other",
] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];
export type EventStatus = (typeof EVENT_STATUSES)[number];
export type TaskKind = (typeof TASK_KINDS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

export function labelize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
