"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { EntityType } from "@/db/schema";
import type { Ref } from "@/lib/views/fields";
import { Avatars } from "./views";

export type AssignApi = {
  entity: EntityType;
  /** What the people are called here, e.g. "Assignees" or "Owners". */
  noun?: string;
  users: Ref[];
  currentUserId: number | null;
  change: (ids: number[], add: Ref[], remove: number[], cascadeToTasks: boolean) => void;
};

export const AssignContext = createContext<AssignApi | null>(null);

/** Avatars that open a picker; toggling a person saves immediately. */
export function AssigneeCell({ rowId, value }: { rowId: number; value: Ref[] }) {
  const api = useContext(AssignContext);
  if (!api) return <Avatars users={value} />;
  return <AssigneePicker api={api} ids={[rowId]} value={value} />;
}

export function AssigneePicker({
  api,
  ids,
  value,
  label,
}: {
  api: AssignApi;
  ids: number[];
  value: Ref[];
  /** Custom trigger text (bulk bar); defaults to the avatar stack. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [cascade, setCascade] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const bulk = Boolean(label);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    // Fixed-position popover: close rather than drift when the page scrolls.
    const onScroll = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const assigned = new Set(value.map((user) => user.id));
  const q = query.trim().toLowerCase();
  const people = api.users.filter((user) => !q || user.label.toLowerCase().includes(q));
  const me = api.users.find((user) => user.id === api.currentUserId);
  const cascadeNow = api.entity === "event" && cascade;

  const toggle = (user: Ref, on: boolean) =>
    api.change(ids, on ? [user] : [], on ? [] : [user.id], cascadeNow);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          const rect = triggerRef.current?.getBoundingClientRect();
          if (rect) {
            const width = 256;
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
            // Open upward when there is no room below (e.g. the bulk bar).
            const top = rect.bottom + 320 > window.innerHeight ? Math.max(8, rect.top - 324) : rect.bottom + 4;
            setPos({ top, left });
          }
          setOpen((v) => !v);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label ?? `${api.noun ?? "Assignees"}: ${value.map((u) => u.label).join(", ") || "none"}. Change`}
        className={
          bulk
            ? "rounded-md border border-[color:var(--line)] bg-white px-3 py-1 text-sm"
            : "-mx-1 flex min-h-7 items-center gap-1 rounded px-1 py-0.5 hover:bg-[color:var(--panel-soft)]"
        }
      >
        {bulk ? label : value.length ? <Avatars users={value} /> : (
          <span className="text-xs text-[color:var(--muted)]">+ Assign</span>
        )}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Choose assignees"
          style={pos ?? undefined}
          className="fixed z-50 w-64 rounded-lg border border-[color:var(--line)] bg-white p-2 text-sm shadow-lg"
        >
          {me && (bulk || !assigned.has(me.id)) ? (
            <button
              type="button"
              onClick={() => toggle(me, true)}
              className="mb-2 w-full rounded-md bg-[color:var(--accent)] px-2 py-1 text-white"
            >
              Assign to me
            </button>
          ) : null}
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Enter toggles the single match: type a name, press Enter.
              if (event.key === "Enter" && people.length === 1) {
                event.preventDefault();
                toggle(people[0], bulk || !assigned.has(people[0].id));
                setQuery("");
              }
            }}
            placeholder="Find a person…"
            aria-label="Find a person"
            className="mb-1 w-full rounded border border-[color:var(--line)] px-2 py-1"
          />
          <ul className="max-h-56 overflow-y-auto">
            {people.map((user) =>
              bulk ? (
                <li key={user.id} className="flex items-center justify-between gap-2 px-1.5 py-1">
                  <span>{user.label}</span>
                  <span className="flex gap-1">
                    <button type="button" onClick={() => toggle(user, true)} className="rounded border border-[color:var(--line)] px-1.5 text-xs hover:bg-[color:var(--panel-soft)]">
                      Add
                    </button>
                    <button type="button" onClick={() => toggle(user, false)} className="rounded border border-[color:var(--line)] px-1.5 text-xs hover:bg-[color:var(--panel-soft)]">
                      Remove
                    </button>
                  </span>
                </li>
              ) : (
                <li key={user.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-[color:var(--panel-soft)]">
                    <input
                      type="checkbox"
                      checked={assigned.has(user.id)}
                      onChange={(event) => toggle(user, event.target.checked)}
                    />
                    {user.label}
                    {user.id === api.currentUserId ? (
                      <span className="text-xs text-[color:var(--muted)]">(you)</span>
                    ) : null}
                  </label>
                </li>
              ),
            )}
            {people.length === 0 ? (
              <li className="px-1.5 py-1 text-[color:var(--muted)]">No one matches</li>
            ) : null}
          </ul>
          {api.entity === "event" ? (
            <label className="mt-2 flex items-start gap-2 border-t border-[color:var(--line)] pt-2 text-xs text-[color:var(--muted)]">
              <input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.target.checked)} />
              Also apply to this event&apos;s open tasks
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
