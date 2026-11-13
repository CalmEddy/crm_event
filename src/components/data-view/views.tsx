"use client";

import Link from "next/link";
import { useState } from "react";
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
import { formatDate, formatDateTime } from "@/lib/format";
import { labelize } from "@/lib/constants";
import type {
  CellValue,
  EntityViewConfig,
  FieldDef,
  Ref,
  ViewRow,
} from "@/lib/views/fields";
import { cellText, groupKeys } from "@/lib/views/query";

const RELATION_PATHS: Record<string, string> = {
  event: "/events",
  contact: "/contacts",
  organization: "/organizations",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const AVATAR_COLORS = ["#2f6f5e", "#9a6b2f", "#5b5f97", "#9b3d3d", "#3d7a9b", "#6b7a2f"];

export function Avatars({ users }: { users: Ref[] }) {
  if (users.length === 0) return <span className="text-[color:var(--muted)]">—</span>;
  return (
    <span className="flex -space-x-1.5" title={users.map((u) => u.label).join(", ")}>
      {users.slice(0, 4).map((user) => (
        <span
          key={user.id}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white"
          style={{ background: AVATAR_COLORS[user.id % AVATAR_COLORS.length] }}
        >
          {initials(user.label)}
        </span>
      ))}
      {users.length > 4 ? (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[color:var(--panel-soft)] text-[10px]">
          +{users.length - 4}
        </span>
      ) : null}
      <span className="sr-only">{users.map((u) => u.label).join(", ")}</span>
    </span>
  );
}

export function Cell({ field, value }: { field: FieldDef; value: CellValue | undefined }) {
  if (value == null || value === "") return <span className="text-[color:var(--muted)]">—</span>;
  switch (field.type) {
    case "date":
      return <>{formatDate(value as string)}</>;
    case "datetime":
      return <>{formatDateTime(value as string)}</>;
    case "enum":
      return (
        <span className="inline-flex rounded-md bg-[color:var(--panel-soft)] px-2 py-0.5 text-xs font-medium">
          {labelize(value as string)}
        </span>
      );
    case "users":
      return <Avatars users={value as Ref[]} />;
    case "relation": {
      const ref = value as Ref;
      const base = RELATION_PATHS[field.key];
      return base ? (
        <Link href={`${base}/${ref.id}`} className="text-[color:var(--accent)] hover:underline">
          {ref.label}
        </Link>
      ) : (
        <>{ref.label}</>
      );
    }
    default:
      return <>{value as string}</>;
  }
}

function groupLabel(field: FieldDef | undefined, key: string) {
  if (!key) return field?.type === "users" ? "Unassigned" : "None";
  if (field?.type === "enum") return labelize(key);
  if (field?.type === "date" || field?.type === "datetime") {
    return format(parseISO(`${key}-01`), "MMMM yyyy");
  }
  return key;
}

function buildGroups(config: EntityViewConfig, rows: ViewRow[], group: string) {
  const field = config.fields.find((f) => f.key === group);
  if (!field) return [{ key: "__all", label: "", rows }];
  const map = new Map<string, ViewRow[]>();
  if (field.type === "enum") for (const o of field.options ?? []) map.set(o.value, []);
  for (const row of rows) {
    for (const key of groupKeys(field, row.values[group])) {
      map.set(key, [...(map.get(key) ?? []), row]);
    }
  }
  return [...map.entries()]
    .filter(([, list]) => list.length > 0)
    .map(([key, list]) => ({ key, label: groupLabel(field, key), rows: list }));
}

function TitleLink({ config, row }: { config: EntityViewConfig; row: ViewRow }) {
  return (
    <Link
      href={`${config.basePath}/${row.id}`}
      className="font-medium text-[color:var(--ink)] hover:text-[color:var(--accent)] hover:underline"
    >
      {cellText(row.values[config.titleKey]) || `#${row.id}`}
    </Link>
  );
}

export function TableView({
  config,
  rows,
  cols,
  group,
  sortKey,
  sortDir,
  onSort,
}: {
  config: EntityViewConfig;
  rows: ViewRow[];
  cols: string[];
  group: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  const fields = cols
    .map((key) => config.fields.find((f) => f.key === key))
    .filter((f): f is FieldDef => Boolean(f));
  const groups = buildGroups(config, rows, group);
  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 border-b border-[color:var(--line)] bg-[color:var(--panel-soft)] text-[color:var(--muted)]">
          <tr>
            {fields.map((field) => (
              <th
                key={field.key}
                className="px-4 py-2.5 font-medium"
                aria-sort={
                  sortKey === field.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                }
              >
                <button
                  type="button"
                  onClick={() => onSort(field.key)}
                  className="inline-flex items-center gap-1 hover:text-[color:var(--ink)]"
                >
                  {field.label}
                  <span aria-hidden className="text-xs">
                    {sortKey === field.key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.key}>
            {g.label ? (
              <tr className="bg-[color:var(--background)]">
                <th colSpan={fields.length} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  {g.label} <span className="font-normal">({g.rows.length})</span>
                </th>
              </tr>
            ) : null}
            {g.rows.map((row) => (
              <tr key={`${g.key}-${row.id}`} className="border-b border-[color:var(--line)] last:border-0 hover:bg-white">
                {fields.map((field) => (
                  <td key={field.key} className="px-4 py-2.5 align-top">
                    {field.key === config.titleKey ? (
                      <TitleLink config={config} row={row} />
                    ) : (
                      <Cell field={field} value={row.values[field.key]} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function CardBody({ config, row }: { config: EntityViewConfig; row: ViewRow }) {
  return (
    <>
      <TitleLink config={config} row={row} />
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--muted)]">
        {config.subtitleKeys.map((key) => {
          const field = config.fields.find((f) => f.key === key);
          const value = row.values[key];
          if (!field || value == null || value === "" || (Array.isArray(value) && !value.length)) {
            return null;
          }
          return (
            <span key={key} className="inline-flex items-center">
              <Cell field={field} value={value} />
            </span>
          );
        })}
      </div>
    </>
  );
}

export function ListView({
  config,
  rows,
  group,
}: {
  config: EntityViewConfig;
  rows: ViewRow[];
  group: string;
}) {
  const groups = buildGroups(config, rows, group);
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.key}>
          {g.label ? (
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              {g.label} ({g.rows.length})
            </h3>
          ) : null}
          <ul className="divide-y divide-[color:var(--line)] rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
            {g.rows.map((row) => {
              const badgeField = config.fields.find((f) => f.key === config.boardKey);
              return (
                <li key={`${g.key}-${row.id}`} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <CardBody config={config} row={row} />
                  </div>
                  {badgeField ? <Cell field={badgeField} value={row.values[badgeField.key]} /> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function BoardView({
  config,
  rows,
  boardKey,
  onMove,
}: {
  config: EntityViewConfig;
  rows: ViewRow[];
  boardKey: string;
  onMove: (id: number, key: string, value: string) => void;
}) {
  const field = config.fields.find((f) => f.key === boardKey);
  const [dragOver, setDragOver] = useState<string | null>(null);
  if (!field?.options) return null;
  const canEdit = Boolean(field.editable);
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {field.options.map((option) => {
        const columnRows = rows.filter((row) => row.values[boardKey] === option.value);
        return (
          <section
            key={option.value}
            aria-label={option.label}
            onDragOver={(event) => {
              if (!canEdit) return;
              event.preventDefault();
              setDragOver(option.value);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(event) => {
              setDragOver(null);
              const id = Number(event.dataTransfer.getData("text/plain"));
              const row = rows.find((r) => r.id === id);
              if (row && row.values[boardKey] !== option.value) onMove(id, boardKey, option.value);
            }}
            className={`flex w-72 shrink-0 flex-col rounded-xl border bg-[color:var(--panel-soft)] p-2 ${
              dragOver === option.value ? "border-[color:var(--accent)]" : "border-[color:var(--line)]"
            }`}
          >
            <h3 className="flex items-center justify-between px-1.5 pb-2 text-sm font-semibold">
              {option.label}
              <span className="text-xs font-normal text-[color:var(--muted)]">{columnRows.length}</span>
            </h3>
            <ul className="flex min-h-16 flex-col gap-2">
              {columnRows.map((row) => (
                <li
                  key={row.id}
                  draggable={canEdit}
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", String(row.id))}
                  className={`rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] p-3 shadow-sm ${
                    canEdit ? "cursor-grab active:cursor-grabbing" : ""
                  }`}
                >
                  <CardBody config={config} row={row} />
                  {canEdit ? (
                    <label className="mt-2 flex items-center gap-1 text-xs text-[color:var(--muted)]">
                      <span className="sr-only">Move to</span>
                      <select
                        aria-label={`Move ${cellText(row.values[config.titleKey])} to`}
                        className="rounded border border-[color:var(--line)] bg-white px-1 py-0.5 text-xs"
                        value={option.value}
                        onChange={(event) => onMove(row.id, boardKey, event.target.value)}
                      >
                        {field.options!.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function CalendarView({
  config,
  rows,
  month,
  onMonth,
}: {
  config: EntityViewConfig;
  rows: ViewRow[];
  month: string;
  onMonth: (month: string) => void;
}) {
  const key = config.calendarKey!;
  const anchor = /^\d{4}-\d{2}$/.test(month) ? parseISO(`${month}-01`) : new Date();
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(anchor)),
    end: endOfWeek(endOfMonth(anchor)),
  });
  const byDay = new Map<string, ViewRow[]>();
  for (const row of rows) {
    const raw = row.values[key];
    if (typeof raw !== "string") continue;
    const day = raw.length > 10 ? format(new Date(raw), "yyyy-MM-dd") : raw;
    byDay.set(day, [...(byDay.get(day) ?? []), row]);
  }
  const badgeField = config.fields.find((f) => f.key === config.boardKey);

  return (
    <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
      <div className="flex items-center justify-between border-b border-[color:var(--line)] px-4 py-2">
        <button type="button" className="px-2 text-sm" onClick={() => onMonth(format(addMonths(anchor, -1), "yyyy-MM"))} aria-label="Previous month">
          ←
        </button>
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">{format(anchor, "MMMM yyyy")}</h3>
          <button type="button" className="text-xs text-[color:var(--accent)]" onClick={() => onMonth("")}>
            Today
          </button>
        </div>
        <button type="button" className="px-2 text-sm" onClick={() => onMonth(format(addMonths(anchor, 1), "yyyy-MM"))} aria-label="Next month">
          →
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-[color:var(--line)] text-center text-xs text-[color:var(--muted)]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const id = format(day, "yyyy-MM-dd");
          const items = byDay.get(id) ?? [];
          return (
            <div
              key={id}
              className={`min-h-24 border-b border-r border-[color:var(--line)] p-1 text-xs ${
                isSameMonth(day, anchor) ? "" : "bg-[color:var(--background)] text-[color:var(--muted)]"
              }`}
            >
              <div className={`mb-1 text-right ${isToday(day) ? "font-bold text-[color:var(--accent)]" : ""}`}>
                {format(day, "d")}
              </div>
              <ul className="space-y-1">
                {items.slice(0, 4).map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`${config.basePath}/${row.id}`}
                      className="block truncate rounded bg-[color:var(--panel-soft)] px-1.5 py-0.5 hover:bg-[color:var(--accent)] hover:text-white"
                      title={`${cellText(row.values[config.titleKey])}${badgeField ? ` · ${labelize(cellText(row.values[badgeField.key]))}` : ""}`}
                    >
                      {cellText(row.values[config.titleKey])}
                    </Link>
                  </li>
                ))}
                {items.length > 4 ? <li className="px-1.5 text-[color:var(--muted)]">+{items.length - 4} more</li> : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
