"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { labelize } from "@/lib/constants";

export type CalendarItem = {
  id: number;
  kind: "task" | "event";
  title: string;
  /** yyyy-MM-dd for bucketing */
  day: string;
  href: string;
  status?: string;
  subtitle?: string;
};

export function TeamCalendar({
  items,
  month,
  showTasks,
  showEvents,
  mineOnly,
}: {
  items: CalendarItem[];
  month: string;
  showTasks: boolean;
  showEvents: boolean;
  mineOnly: boolean;
}) {
  const router = useRouter();
  const [anchorMonth, setAnchorMonth] = useState(
    /^\d{4}-\d{2}$/.test(month) ? month : format(new Date(), "yyyy-MM"),
  );

  const goMonth = (next: string) => {
    setAnchorMonth(next);
    const params = new URLSearchParams();
    if (next) params.set("month", next);
    if (!showTasks) params.set("tasks", "0");
    if (!showEvents) params.set("events", "0");
    if (mineOnly) params.set("mine", "1");
    const qs = params.toString();
    router.replace(qs ? `/calendar?${qs}` : "/calendar");
  };

  const setFilter = (key: "tasks" | "events" | "mine", enabled: boolean) => {
    const params = new URLSearchParams();
    if (anchorMonth) params.set("month", anchorMonth);
    const nextTasks = key === "tasks" ? enabled : showTasks;
    const nextEvents = key === "events" ? enabled : showEvents;
    const nextMine = key === "mine" ? enabled : mineOnly;
    if (!nextTasks) params.set("tasks", "0");
    if (!nextEvents) params.set("events", "0");
    if (nextMine) params.set("mine", "1");
    const qs = params.toString();
    router.replace(qs ? `/calendar?${qs}` : "/calendar");
  };

  const anchor = useMemo(
    () =>
      /^\d{4}-\d{2}$/.test(anchorMonth)
        ? parseISO(`${anchorMonth}-01`)
        : new Date(),
    [anchorMonth],
  );

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(anchor)),
    end: endOfWeek(endOfMonth(anchor)),
  });

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      if (item.kind === "task" && !showTasks) continue;
      if (item.kind === "event" && !showEvents) continue;
      map.set(item.day, [...(map.get(item.day) ?? []), item]);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "event" ? -1 : 1;
        return a.title.localeCompare(b.title);
      });
    }
    return map;
  }, [items, showTasks, showEvents]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showEvents}
            onChange={(e) => setFilter("events", e.target.checked)}
          />
          Events
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showTasks}
            onChange={(e) => setFilter("tasks", e.target.checked)}
          />
          Tasks
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setFilter("mine", e.target.checked)}
          />
          Assigned to me
        </label>
        <Link
          href="/settings/calendar"
          className="ml-auto text-[color:var(--accent)] hover:underline"
        >
          Google Calendar sync
        </Link>
      </div>

      <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
        <div className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-2">
          <button
            type="button"
            className="px-2 text-sm"
            onClick={() => goMonth(format(addMonths(anchor, -1), "yyyy-MM"))}
            aria-label="Previous month"
          >
            ←
          </button>
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">{format(anchor, "MMMM yyyy")}</h2>
            <button
              type="button"
              className="text-xs text-[color:var(--accent)]"
              onClick={() => goMonth(format(new Date(), "yyyy-MM"))}
            >
              Today
            </button>
          </div>
          <button
            type="button"
            className="px-2 text-sm"
            onClick={() => goMonth(format(addMonths(anchor, 1), "yyyy-MM"))}
            aria-label="Next month"
          >
            →
          </button>
        </div>
        <div className="grid grid-cols-7 border-b border-[color:var(--line)] text-center text-xs text-[color:var(--muted)]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1.5">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const id = format(day, "yyyy-MM-dd");
            const dayItems = byDay.get(id) ?? [];
            return (
              <div
                key={id}
                className={`min-h-28 border-b border-r border-[color:var(--line)] p-1 text-xs ${
                  isSameMonth(day, anchor)
                    ? ""
                    : "bg-[color:var(--background)] text-[color:var(--muted)]"
                }`}
              >
                <div
                  className={`mb-1 text-right ${
                    isToday(day) ? "font-bold text-[color:var(--accent)]" : ""
                  }`}
                >
                  {format(day, "d")}
                </div>
                <ul className="space-y-1">
                  {dayItems.slice(0, 5).map((item) => (
                    <li key={`${item.kind}-${item.id}`}>
                      <Link
                        href={item.href}
                        className={`block truncate rounded px-1.5 py-0.5 hover:bg-[color:var(--accent)] hover:text-white ${
                          item.kind === "task"
                            ? "bg-[color:var(--panel-soft)]"
                            : "bg-[color:var(--accent)]/15"
                        }`}
                        title={`${item.kind === "task" ? "Task" : "Event"}: ${item.title}${
                          item.status ? ` · ${labelize(item.status)}` : ""
                        }${item.subtitle ? ` · ${item.subtitle}` : ""}`}
                      >
                        <span className="mr-1 opacity-70">
                          {item.kind === "task" ? "T" : "E"}
                        </span>
                        {item.title}
                      </Link>
                    </li>
                  ))}
                  {dayItems.length > 5 ? (
                    <li className="px-1.5 text-[color:var(--muted)]">
                      +{dayItems.length - 5} more
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
