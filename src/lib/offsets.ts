import { addDays, formatISO } from "date-fns";

export type OffsetUnit = "days" | "weeks" | "months";
export type OffsetDirection = "before" | "after" | "on";

export function parseOffsetDays(offsetDays: number): {
  amount: number;
  unit: OffsetUnit;
  direction: OffsetDirection;
} {
  if (offsetDays === 0) {
    return { amount: 0, unit: "days", direction: "on" };
  }

  const abs = Math.abs(offsetDays);
  const direction: OffsetDirection = offsetDays < 0 ? "before" : "after";

  // Prefer months when within 2 days of an N×30 approximation (e.g. 182 ≈ 6 months).
  if (abs >= 30) {
    const months = Math.round(abs / 30);
    if (Math.abs(months * 30 - abs) <= 2) {
      return { amount: months, unit: "months", direction };
    }
  }
  if (abs % 7 === 0) {
    return { amount: abs / 7, unit: "weeks", direction };
  }
  return { amount: abs, unit: "days", direction };
}

export function toOffsetDays(
  amount: number,
  unit: OffsetUnit,
  direction: OffsetDirection,
): number {
  if (direction === "on" || amount === 0) return 0;
  const days =
    unit === "months" ? amount * 30 : unit === "weeks" ? amount * 7 : amount;
  return direction === "before" ? -days : days;
}

export function formatOffsetLabel(offsetDays: number): string {
  const { amount, unit, direction } = parseOffsetDays(offsetDays);
  if (direction === "on") return "On event day";
  const unitLabel =
    amount === 1 ? unit.slice(0, -1) : unit;
  return `${amount} ${unitLabel} ${direction}`;
}

/** dueOn = event local calendar date + offsetDays */
export function dueOnFromEventDate(
  startsAt: Date | string,
  offsetDays: number,
): string {
  const start = typeof startsAt === "string" ? new Date(startsAt) : startsAt;
  const eventDate = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  return formatISO(addDays(eventDate, offsetDays), { representation: "date" });
}
