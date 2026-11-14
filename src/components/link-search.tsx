"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import type { EntityType } from "@/db/schema";
import { linkRecordAction, type LinkTarget } from "@/lib/actions/links";
import { searchRecords, type SearchHit } from "@/lib/actions/views";
import { labelize } from "@/lib/constants";

const GROUPS: { type: EntityType; label: string }[] = [
  { type: "event", label: "Events" },
  { type: "task", label: "Tasks" },
  { type: "contact", label: "Contacts" },
  { type: "organization", label: "Organizations" },
];
const NOUN: Record<EntityType, string> = {
  event: "event",
  task: "task",
  contact: "contact",
  organization: "organization",
};

/** Best guess at what a new name is, so that option is listed first. */
function guessType(text: string): EntityType {
  if (/@|^(mr|ms|mrs|dr)\.? /i.test(text)) return "contact";
  if (/\b(inc|llc|ltd|co|corp|club|agency|theat(er|re)|lounge|bar|venue|hall|records|group)\b\.?/i.test(text)) {
    return "organization";
  }
  if (/^(call|email|send|follow|book|confirm|pay|invoice|review)\b/i.test(text)) return "task";
  return "contact";
}

type Option =
  | { kind: "hit"; hit: SearchHit }
  | { kind: "create"; type: EntityType };

export function LinkSearch({
  fromType,
  fromId,
  linked,
  roles,
}: {
  fromType: EntityType;
  fromId: number;
  /** "type:id" keys already linked (hidden from results). */
  linked: string[];
  roles: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [role, setRole] = useState("related");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const result = await searchRecords(q);
      if (!stale) {
        setHits(result);
        setSearched(q);
      }
    }, 180);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const options = useMemo<Option[]>(() => {
    if (q.length < 2 || searched !== q) return [];
    const skip = new Set([...linked, `${fromType}:${fromId}`]);
    const visible = hits.filter((hit) => !skip.has(`${hit.type}:${hit.id}`));
    const grouped = GROUPS.flatMap((g) => visible.filter((h) => h.type === g.type)).map(
      (hit): Option => ({ kind: "hit", hit }),
    );
    // Offer creation unless a record with exactly this name already exists.
    const exact = hits.some((hit) => hit.label.trim().toLowerCase() === q.toLowerCase());
    if (exact) return grouped;
    const first = guessType(q);
    const types = [first, ...GROUPS.map((g) => g.type).filter((t) => t !== first)];
    return [...grouped, ...types.map((type): Option => ({ kind: "create", type }))];
  }, [hits, searched, q, linked, fromType, fromId]);

  const loading = q.length >= 2 && searched !== q;

  function choose(option: Option) {
    const target: LinkTarget =
      option.kind === "hit"
        ? { type: option.hit.type, id: option.hit.id }
        : { type: option.type, create: q };
    const label = option.kind === "hit" ? option.hit.label : q;
    setMessage(null);
    startTransition(async () => {
      const result = await linkRecordAction(fromType, fromId, target, { role, notes });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setMessage({
        tone: "ok",
        text: result.created
          ? `Created ${NOUN[target.type]} “${label}” and linked it.`
          : `Linked “${label}”.`,
      });
      setQuery("");
      setNotes("");
      setHits([]);
      setSearched("");
      setOpen(false);
    });
  }

  const showList = open && q.length >= 2;
  // Section header shown above an option, if it starts a new group.
  const headers = options.map((option, index) => {
    const prev = options[index - 1];
    if (option.kind === "hit") {
      return prev?.kind === "hit" && prev.hit.type === option.hit.type
        ? null
        : (GROUPS.find((g) => g.type === option.hit.type)?.label ?? null);
    }
    if (index === 0) return "No match — create new";
    return prev.kind === "hit" ? "Create new" : null;
  });

  return (
    <div className="max-w-3xl space-y-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
      <div ref={rootRef} className="relative">
        <label htmlFor={`${listId}-input`} className="mb-1.5 block text-sm font-medium">
          Link a record
        </label>
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? `${listId}-opt-${active}` : undefined}
          value={query}
          disabled={pending}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
            setMessage(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, options.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (event.key === "Enter" && showList && options[active]) {
              event.preventDefault();
              choose(options[active]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search events, tasks, contacts or organizations — or type a new name"
          className="w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none ring-[color:var(--accent)] focus:ring-2"
        />
        {showList ? (
          <ul
            id={`${listId}-list`}
            role="listbox"
            aria-label="Matching records"
            className="absolute z-40 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-[color:var(--line)] bg-white py-1 text-sm shadow-lg"
          >
            {loading && options.length === 0 ? (
              <li className="px-3 py-2 text-[color:var(--muted)]">Searching…</li>
            ) : null}
            {options.map((option, index) => {
              const header = headers[index];
              return (
                <li key={option.kind === "hit" ? `${option.hit.type}:${option.hit.id}` : `new:${option.type}`} role="presentation">
                  {header ? (
                    <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                      {header}
                    </div>
                  ) : null}
                  <div
                    id={`${listId}-opt-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(option);
                    }}
                    className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 ${
                      index === active ? "bg-[color:var(--panel-soft)]" : ""
                    }`}
                  >
                    {option.kind === "hit" ? (
                      <>
                        <span>{option.hit.label}</span>
                        <span className="text-xs text-[color:var(--muted)]">{labelize(option.hit.type)}</span>
                      </>
                    ) : (
                      <span className="text-[color:var(--accent)]">
                        + New {NOUN[option.type]} “{q}”
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-[color:var(--muted)]">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-md border border-[color:var(--line)] bg-white px-2 py-1"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {labelize(r)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 items-center gap-2">
          <span className="text-[color:var(--muted)]">Note</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            maxLength={500}
            className="min-w-40 flex-1 rounded-md border border-[color:var(--line)] bg-white px-2 py-1"
          />
        </label>
      </div>
      {pending ? <p className="text-sm text-[color:var(--muted)]">Linking…</p> : null}
      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`text-sm ${message.tone === "error" ? "text-[color:var(--danger)]" : "text-[color:var(--muted)]"}`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
