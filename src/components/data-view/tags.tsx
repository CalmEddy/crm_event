"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { TAG_COLORS, tagChipClass, type TagOption } from "@/lib/tag-colors";
import type { Ref } from "@/lib/views/fields";

export type TagApi = {
  tags: TagOption[];
  change: (ids: number[], add: TagOption[], remove: number[]) => void;
  /** Create (or find) a tag by name; resolves to null on error. */
  create: (name: string) => Promise<TagOption | null>;
};

export const TagContext = createContext<TagApi | null>(null);

export function TagChips({ value, colors }: { value: Ref[]; colors?: Map<number, string> }) {
  if (value.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {value.map((tag) => (
        <span
          key={tag.id}
          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tagChipClass(colors?.get(tag.id))}`}
        >
          {tag.label}
        </span>
      ))}
    </span>
  );
}

/** Tag chips that open the picker; changes save immediately. */
export function TagCell({ rowId, value }: { rowId: number; value: Ref[] }) {
  const api = useContext(TagContext);
  if (!api) return <TagChips value={value} />;
  return <TagPicker api={api} ids={[rowId]} value={value} />;
}

export function TagPicker({
  api,
  ids,
  value,
  label,
}: {
  api: TagApi;
  ids: number[];
  value: Ref[];
  /** Custom trigger text (bulk bar); defaults to the chips. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const bulk = Boolean(label);
  const colors = new Map(api.tags.map((tag) => [tag.id, tag.color]));

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
    const onScroll = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const applied = new Set(value.map((tag) => tag.id));
  const q = query.trim().toLowerCase();
  const matches = api.tags.filter((tag) => !q || tag.label.toLowerCase().includes(q));
  const exact = api.tags.find((tag) => tag.label.toLowerCase() === q);

  const toggle = (tag: TagOption, on: boolean) => api.change(ids, on ? [tag] : [], on ? [] : [tag.id]);

  async function createAndApply() {
    if (!q || busy) return;
    setBusy(true);
    const tag = await api.create(query);
    setBusy(false);
    if (tag) {
      toggle(tag, true);
      setQuery("");
    }
  }

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
            const top = rect.bottom + 320 > window.innerHeight ? Math.max(8, rect.top - 324) : rect.bottom + 4;
            setPos({ top, left });
          }
          setOpen((v) => !v);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label ?? `Tags: ${value.map((t) => t.label).join(", ") || "none"}. Change`}
        className={
          bulk
            ? "rounded-md border border-[color:var(--line)] bg-white px-3 py-1 text-sm"
            : "-mx-1 flex min-h-7 items-center rounded px-1 py-0.5 text-left hover:bg-[color:var(--panel-soft)]"
        }
      >
        {bulk ? label : value.length ? (
          <TagChips value={value} colors={colors} />
        ) : (
          <span className="text-xs text-[color:var(--muted)]">+ Tag</span>
        )}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Choose tags"
          style={pos ?? undefined}
          className="fixed z-50 w-64 rounded-lg border border-[color:var(--line)] bg-white p-2 text-sm shadow-lg"
        >
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              // Enter: toggle the exact/single match, otherwise create the tag.
              const target = exact ?? (matches.length === 1 ? matches[0] : null);
              if (target) {
                toggle(target, bulk || !applied.has(target.id));
                setQuery("");
              } else void createAndApply();
            }}
            placeholder="Find or create a tag…"
            aria-label="Find or create a tag"
            maxLength={30}
            className="mb-1 w-full rounded border border-[color:var(--line)] px-2 py-1"
          />
          <ul className="max-h-56 overflow-y-auto">
            {matches.map((tag) =>
              bulk ? (
                <li key={tag.id} className="flex items-center justify-between gap-2 px-1.5 py-1">
                  <TagChips value={[tag]} colors={colors} />
                  <span className="flex gap-1">
                    <button type="button" onClick={() => toggle(tag, true)} className="rounded border border-[color:var(--line)] px-1.5 text-xs hover:bg-[color:var(--panel-soft)]">
                      Add
                    </button>
                    <button type="button" onClick={() => toggle(tag, false)} className="rounded border border-[color:var(--line)] px-1.5 text-xs hover:bg-[color:var(--panel-soft)]">
                      Remove
                    </button>
                  </span>
                </li>
              ) : (
                <li key={tag.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-[color:var(--panel-soft)]">
                    <input
                      type="checkbox"
                      checked={applied.has(tag.id)}
                      onChange={(event) => toggle(tag, event.target.checked)}
                    />
                    <TagChips value={[tag]} colors={colors} />
                  </label>
                </li>
              ),
            )}
            {q && !exact ? (
              <li>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createAndApply()}
                  className="w-full rounded px-1.5 py-1 text-left text-[color:var(--accent)] hover:bg-[color:var(--panel-soft)]"
                >
                  {busy ? "Creating…" : `+ Create “${query.trim()}”`}
                </button>
              </li>
            ) : null}
            {!q && api.tags.length === 0 ? (
              <li className="px-1.5 py-1 text-[color:var(--muted)]">Type a name to create your first tag.</li>
            ) : null}
          </ul>
          <a href="/settings/tags" className="mt-1 block border-t border-[color:var(--line)] px-1.5 pt-2 text-xs text-[color:var(--muted)] hover:text-[color:var(--accent)]">
            Manage tags
          </a>
        </div>
      ) : null}
    </div>
  );
}

export const TAG_COLOR_KEYS = Object.keys(TAG_COLORS) as (keyof typeof TAG_COLORS)[];
