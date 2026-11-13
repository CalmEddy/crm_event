"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchRecords, type SearchHit } from "@/lib/actions/views";
import { labelize } from "@/lib/constants";

type Item = { id: string; label: string; hint: string; href: string };

const PAGES: Item[] = [
  { id: "p-dash", label: "Dashboard", hint: "Go to", href: "/" },
  { id: "p-events", label: "Events", hint: "Go to", href: "/events" },
  { id: "p-tasks", label: "Tasks", hint: "Go to", href: "/tasks" },
  { id: "p-my-tasks", label: "My tasks", hint: "Go to", href: "/tasks?f.assignees=me" },
  { id: "p-contacts", label: "Contacts", hint: "Go to", href: "/contacts" },
  { id: "p-orgs", label: "Organizations", hint: "Go to", href: "/organizations" },
  { id: "p-notes", label: "Notes", hint: "Go to", href: "/notes" },
  { id: "p-inbound", label: "Inbound", hint: "Go to", href: "/inbound" },
  { id: "p-groups", label: "Task groups", hint: "Go to", href: "/task-groups" },
  { id: "p-users", label: "Users", hint: "Go to", href: "/users" },
  { id: "n-task", label: "New task", hint: "Create", href: "/tasks/new" },
  { id: "n-event", label: "New event", hint: "Create", href: "/events/new" },
  { id: "n-contact", label: "New contact", hint: "Create", href: "/contacts/new" },
  { id: "n-org", label: "New organization", hint: "Create", href: "/organizations/new" },
];

/** Ctrl/⌘+K: jump to any page or record, or start a new one. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Mounting the panel only while open gives it fresh state each time.
  return open ? <PalettePanel onClose={() => setOpen(false)} /> : null;
}

function PalettePanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const setOpen = (value: boolean) => {
    if (!value) onClose();
  };
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await searchRecords(q).catch(() => []);
      if (!cancelled) setHits(results);
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const pages = q ? PAGES.filter((item) => item.label.toLowerCase().includes(q)) : PAGES;
    const records = (q.length >= 2 ? hits : []).map((hit) => ({
      id: `${hit.type}-${hit.id}`,
      label: hit.label,
      hint: labelize(hit.type),
      href: hit.href,
    }));
    return [...records, ...pages];
  }, [query, hits]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="presentation">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-black/30"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] shadow-2xl"
      >
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-results"
          aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            else if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((i) => Math.min(i + 1, items.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              go(items[active]);
            }
          }}
          placeholder="Search events, tasks, contacts… or jump to a page"
          className="w-full border-b border-[color:var(--line)] bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul id="command-results" role="listbox" className="max-h-80 overflow-y-auto py-1">
          {items.length === 0 ? (
            <li className="px-4 py-3 text-sm text-[color:var(--muted)]">No matches</li>
          ) : (
            items.map((item, index) => (
              <li
                key={item.id}
                id={`cmd-${item.id}`}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  go(item);
                }}
                className={`flex cursor-pointer items-center justify-between px-4 py-2 text-sm ${
                  index === active ? "bg-[color:var(--panel-soft)]" : ""
                }`}
              >
                <span>{item.label}</span>
                <span className="text-xs text-[color:var(--muted)]">{item.hint}</span>
              </li>
            ))
          )}
        </ul>
        <p className="border-t border-[color:var(--line)] px-4 py-2 text-xs text-[color:var(--muted)]">
          ↑↓ to move · Enter to open · Esc to close
        </p>
      </div>
    </div>
  );
}
