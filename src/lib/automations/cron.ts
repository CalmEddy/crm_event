/** Minimal 5-field cron matcher (minute hour dom month dow). Supports * and simple lists/ranges. */

function matchField(expr: string, value: number, min: number, max: number): boolean {
  if (expr === "*") return true;
  for (const part of expr.split(",")) {
    if (part.includes("/")) {
      const [range, stepRaw] = part.split("/");
      const step = Number(stepRaw);
      if (!Number.isFinite(step) || step <= 0) return false;
      const start = range === "*" ? min : Number(range);
      if (!Number.isFinite(start)) return false;
      if (value >= start && (value - start) % step === 0) return true;
      continue;
    }
    if (part.includes("-")) {
      const [a, b] = part.split("-").map(Number);
      if (value >= a && value <= b) return true;
      continue;
    }
    if (Number(part) === value) return true;
  }
  return false;
}

export function cronMatches(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dom, month, dow] = parts;
  return (
    matchField(minute, date.getMinutes(), 0, 59) &&
    matchField(hour, date.getHours(), 0, 23) &&
    matchField(dom, date.getDate(), 1, 31) &&
    matchField(month, date.getMonth() + 1, 1, 12) &&
    matchField(dow, date.getDay(), 0, 6)
  );
}

/** Shift "now" into an IANA timezone wall-clock Date for cron/schedule checks. */
export function wallClockInTimezone(now: Date, timezone: string): Date {
  if (!timezone || timezone === "local") return now;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? NaN);
    return new Date(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
  } catch {
    return now;
  }
}
