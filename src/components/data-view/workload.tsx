"use client";

import { useContext, useState } from "react";
import { addDays, formatISO } from "date-fns";
import type { EntityViewConfig, Ref, ViewRow } from "@/lib/views/fields";
import { cellText } from "@/lib/views/query";
import { AssignContext } from "./assignees";
import { CardBody } from "./views";

const UNASSIGNED = 0;

/** Board with one column per person: drag a card to reassign it. */
export function WorkloadView({
  config,
  rows,
  usersKey,
  onOpen,
}: {
  config: EntityViewConfig;
  rows: ViewRow[];
  usersKey: string;
  onOpen?: (id: number) => void;
}) {
  const api = useContext(AssignContext);
  const [dragOver, setDragOver] = useState<number | null>(null);
  if (!api) return null;

  const columns: Ref[] = [{ id: UNASSIGNED, label: "Unassigned" }, ...api.users];
  const today = formatISO(new Date(), { representation: "date" });
  const weekEnd = formatISO(addDays(new Date(), 7), { representation: "date" });
  const dateKey = config.calendarKey;
  const statusKey = config.boardKey;
  const isOpen = (row: ViewRow) => {
    const status = statusKey ? cellText(row.values[statusKey]) : "";
    return !["done", "skipped", "completed", "canceled"].includes(status);
  };

  const assigneesOf = (row: ViewRow) => (row.values[usersKey] as Ref[] | undefined) ?? [];

  function move(rowId: number, from: number, to: number) {
    if (from === to || !api) return;
    const target = api.users.find((user) => user.id === to);
    api.change([rowId], target ? [target] : [], from === UNASSIGNED ? [] : [from], false);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((column) => {
        const columnRows = rows.filter((row) => {
          const ids = assigneesOf(row).map((user) => user.id);
          return column.id === UNASSIGNED ? ids.length === 0 : ids.includes(column.id);
        });
        const open = columnRows.filter(isOpen);
        const dueSoon = dateKey
          ? open.filter((row) => {
              const day = cellText(row.values[dateKey]).slice(0, 10);
              return day && day <= weekEnd;
            })
          : [];
        const overdue = dateKey
          ? open.filter((row) => {
              const day = cellText(row.values[dateKey]).slice(0, 10);
              return day && day < today;
            })
          : [];
        return (
          <section
            key={column.id}
            aria-label={column.label}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(column.id);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(event) => {
              setDragOver(null);
              const [rowId, from] = event.dataTransfer.getData("text/plain").split(":").map(Number);
              if (rowId) move(rowId, from, column.id);
            }}
            className={`flex w-72 shrink-0 flex-col rounded-xl border bg-[color:var(--panel-soft)] p-2 ${
              dragOver === column.id ? "border-[color:var(--accent)]" : "border-[color:var(--line)]"
            }`}
          >
            <header className="px-1.5 pb-2">
              <h3 className="flex items-center justify-between text-sm font-semibold">
                {column.label}
                {column.id === api.currentUserId ? (
                  <span className="text-xs font-normal text-[color:var(--muted)]">you</span>
                ) : null}
              </h3>
              <p className="text-xs text-[color:var(--muted)]">
                {open.length} open
                {dateKey ? ` · ${dueSoon.length} due this week` : ""}
                {overdue.length ? (
                  <span className="text-[color:var(--danger)]"> · {overdue.length} overdue</span>
                ) : null}
              </p>
            </header>
            <ul className="flex min-h-16 flex-col gap-2">
              {columnRows.map((row) => (
                <li
                  key={row.id}
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData("text/plain", `${row.id}:${column.id}`)
                  }
                  className="cursor-grab rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] p-3 shadow-sm active:cursor-grabbing"
                >
                  <CardBody config={config} row={row} onOpen={onOpen} />
                  <label className="mt-2 flex items-center gap-1 text-xs text-[color:var(--muted)]">
                    <span className="sr-only">Reassign</span>
                    <select
                      aria-label={`Reassign ${cellText(row.values[config.titleKey])}`}
                      className="rounded border border-[color:var(--line)] bg-white px-1 py-0.5 text-xs"
                      value={column.id}
                      onChange={(event) => move(row.id, column.id, Number(event.target.value))}
                    >
                      {columns.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.id === column.id ? option.label : `→ ${option.label}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
