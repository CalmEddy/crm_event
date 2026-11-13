"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import type { EntityType } from "@/db/schema";
import { deleteView, saveView, updateField } from "@/lib/actions/views";
import {
  VIEW_CONFIGS,

  type Ref,
  type ViewRow,
} from "@/lib/views/fields";
import {
  FILTER_PREFIX,
  ME,
  applyViewState,
  availableViews,
  parseViewState,
  type ViewType,
} from "@/lib/views/query";
import { BoardView, CalendarView, ListView, TableView } from "./views";

export type SavedViewItem = {
  id: number;
  name: string;
  query: string;
  shared: boolean;
  mine: boolean;
};

const VIEW_LABELS: Record<ViewType, string> = {
  table: "Table",
  list: "List",
  board: "Board",
  calendar: "Calendar",
};

const chip =
  "inline-flex items-center gap-1 rounded-md border border-[color:var(--line)] bg-white px-2.5 py-1.5 text-sm text-[color:var(--ink)] hover:bg-[color:var(--panel-soft)]";
const chipActive =
  "inline-flex items-center gap-1 rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-2.5 py-1.5 text-sm text-white";

export function DataView({
  entity,
  rows,
  savedViews,
  currentUserId,
  refOptions,
}: {
  entity: EntityType;
  rows: ViewRow[];
  savedViews: SavedViewItem[];
  currentUserId: number | null;
  /** Choices for users/relation filters, keyed by field. */
  refOptions: Record<string, Ref[]>;
}) {
  const config = VIEW_CONFIGS[entity];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(
    () => parseViewState(new URLSearchParams(searchParams.toString()), config),
    [searchParams, config],
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [optimisticRows, applyOptimistic] = useOptimistic(
    rows,
    (current, patch: { id: number; key: string; value: string }) =>
      current.map((row) =>
        row.id === patch.id
          ? { ...row, values: { ...row.values, [patch.key]: patch.value } }
          : row,
      ),
  );

  const visible = useMemo(
    () => applyViewState(optimisticRows, config, state, currentUserId),
    [optimisticRows, config, state, currentUserId],
  );

  function setParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("sv");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function setParam(name: string, value: string | null) {
    setParams((params) => {
      if (value) params.set(name, value);
      else params.delete(name);
    });
  }

  function setFilter(key: string, values: string[]) {
    setParam(FILTER_PREFIX + key, values.length ? values.join(",") : null);
  }

  function moveCard(id: number, key: string, value: string) {
    setError(null);
    startTransition(async () => {
      applyOptimistic({ id, key, value });
      const result = await updateField(entity, id, key, value);
      if (!result.ok) setError(result.error);
    });
  }

  const activeSavedId = searchParams.get("sv");
  const hasState = [...searchParams.keys()].some((key) => key !== "sv");
  const filterFields = config.fields.filter(
    (field) =>
      field.type === "enum" ||
      field.type === "users" ||
      field.type === "relation" ||
      field.type === "date" ||
      field.type === "datetime",
  );
  const mineField = config.fields.find((field) => field.type === "users");
  const mineActive = mineField
    ? (state.filters[mineField.key] ?? []).includes(ME)
    : false;

  return (
    <div className="space-y-4">
      {/* Saved view tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--line)] pb-3">
        <Link
          href={pathname}
          className={!hasState && !activeSavedId ? chipActive : chip}
        >
          All {config.pluralLabel.toLowerCase()}
        </Link>
        {savedViews.map((view) => {
          const active = activeSavedId === String(view.id);
          return (
            <span key={view.id} className="inline-flex items-center">
              <Link
                href={`${pathname}?${view.query ? `${view.query}&` : ""}sv=${view.id}`}
                className={active ? chipActive : chip}
                title={view.shared ? "Shared view" : "Private view"}
              >
                {view.name}
                {view.shared ? <span aria-hidden>·</span> : null}
              </Link>
              {view.mine && active ? (
                <button
                  type="button"
                  className="ml-1 rounded px-1.5 text-sm text-[color:var(--muted)] hover:text-[color:var(--danger)]"
                  aria-label={`Delete view ${view.name}`}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteView(view.id);
                      router.replace(pathname, { scroll: false });
                    })
                  }
                >
                  ×
                </button>
              ) : null}
            </span>
          );
        })}
        <SaveViewButton
          disabled={!hasState || Boolean(activeSavedId)}
          onSave={async (name, shared) => {
            const params = new URLSearchParams(searchParams.toString());
            const result = await saveView({
              entity,
              name,
              shared,
              query: params.toString(),
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            params.delete("sv");
            const query = params.toString();
            router.replace(`${pathname}?${query ? `${query}&` : ""}sv=${result.id}`, {
              scroll: false,
            });
          }}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="View type"
          className="inline-flex overflow-hidden rounded-md border border-[color:var(--line)]"
        >
          {availableViews(config).map((view) => (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={state.view === view}
              onClick={() => setParam("view", view === "table" ? null : view)}
              className={`px-3 py-1.5 text-sm ${
                state.view === view
                  ? "bg-[color:var(--accent)] text-white"
                  : "bg-white text-[color:var(--ink)] hover:bg-[color:var(--panel-soft)]"
              }`}
            >
              {VIEW_LABELS[view]}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder={`Search ${config.pluralLabel.toLowerCase()}…`}
          defaultValue={state.q}
          key={state.q}
          onKeyDown={(event) => {
            if (event.key === "Enter") setParam("q", event.currentTarget.value.trim() || null);
          }}
          onBlur={(event) => {
            const value = event.currentTarget.value.trim();
            if (value !== state.q) setParam("q", value || null);
          }}
          className="min-w-48 flex-1 rounded-md border border-[color:var(--line)] bg-white px-3 py-1.5 text-sm outline-none ring-[color:var(--accent)] focus:ring-2"
        />

        {mineField && currentUserId != null ? (
          <button
            type="button"
            className={mineActive ? chipActive : chip}
            onClick={() => {
              const current = state.filters[mineField.key] ?? [];
              setFilter(
                mineField.key,
                mineActive ? current.filter((v) => v !== ME) : [...current, ME],
              );
            }}
          >
            Assigned to me
          </button>
        ) : null}

        {state.view === "table" || state.view === "list" ? (
          <label className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)]">
            Group
            <select
              value={state.group}
              onChange={(event) => setParam("group", event.target.value || null)}
              className="rounded-md border border-[color:var(--line)] bg-white px-2 py-1.5 text-sm text-[color:var(--ink)]"
            >
              <option value="">None</option>
              {config.fields
                .filter((field) => field.key !== config.titleKey)
                .map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
            </select>
          </label>
        ) : null}

        {state.view === "board" ? (
          <label className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)]">
            Columns by
            <select
              value={state.board}
              onChange={(event) => setParam("board", event.target.value)}
              className="rounded-md border border-[color:var(--line)] bg-white px-2 py-1.5 text-sm text-[color:var(--ink)]"
            >
              {config.fields
                .filter((field) => field.type === "enum")
                .map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
            </select>
          </label>
        ) : null}

        {state.view === "table" ? (
          <ColumnsMenu
            fields={config.fields.map((f) => ({ key: f.key, label: f.label }))}
            selected={state.cols}
            titleKey={config.titleKey}
            onChange={(cols) => setParam("cols", cols.join(","))}
          />
        ) : null}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {filterFields.map((field) => (
          <FilterControl
            key={field.key}
            label={field.label}
            type={field.type}
            options={
              field.type === "enum"
                ? (field.options ?? []).map((o) => ({ value: o.value, label: o.label }))
                : [
                    ...(field.type === "users" && currentUserId != null
                      ? [{ value: ME, label: "Me" }]
                      : []),
                    { value: "none", label: field.type === "users" ? "Unassigned" : "None" },
                    ...(refOptions[field.key] ?? []).map((ref) => ({
                      value: String(ref.id),
                      label: ref.label,
                    })),
                  ]
            }
            selected={state.filters[field.key] ?? []}
            onChange={(values) => setFilter(field.key, values)}
          />
        ))}
        {Object.keys(state.filters).length > 0 || state.q ? (
          <button
            type="button"
            className="text-sm text-[color:var(--accent)] underline-offset-2 hover:underline"
            onClick={() =>
              setParams((params) => {
                params.delete("q");
                for (const key of [...params.keys()]) {
                  if (key.startsWith(FILTER_PREFIX)) params.delete(key);
                }
              })
            }
          >
            Clear filters
          </button>
        ) : null}
        <span className="ml-auto text-sm text-[color:var(--muted)]">
          {visible.length} of {rows.length}
        </span>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--line)] bg-[color:var(--panel)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
          No {config.pluralLabel.toLowerCase()} match this view.
        </div>
      ) : state.view === "list" ? (
        <ListView config={config} rows={visible} group={state.group} />
      ) : state.view === "board" ? (
        <BoardView
          config={config}
          rows={visible}
          boardKey={state.board}
          onMove={moveCard}
        />
      ) : state.view === "calendar" ? (
        <CalendarView
          config={config}
          rows={visible}
          month={state.month}
          onMonth={(month) => setParam("month", month)}
        />
      ) : (
        <TableView
          config={config}
          rows={visible}
          cols={state.cols}
          group={state.group}
          sortKey={state.sortKey}
          sortDir={state.sortDir}
          onSort={(key) => {
            const next =
              state.sortKey === key && state.sortDir === "asc" ? `-${key}` : key;
            setParam("sort", next === config.defaultSort ? null : next);
          }}
        />
      )}
    </div>
  );
}

function SaveViewButton({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: (name: string, shared: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="ml-auto text-sm text-[color:var(--accent)] disabled:cursor-not-allowed disabled:text-[color:var(--muted)] disabled:opacity-60"
        title={disabled ? "Change filters, sort, or view to save a new view" : undefined}
      >
        + Save view
      </button>
    );
  }
  return (
    <form
      className="ml-auto flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          await onSave(name, shared);
          setOpen(false);
          setName("");
        });
      }}
    >
      <input
        autoFocus
        required
        maxLength={60}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
        placeholder="View name"
        aria-label="View name"
        className="rounded-md border border-[color:var(--line)] bg-white px-2 py-1 text-sm"
      />
      <label className="inline-flex items-center gap-1 text-sm text-[color:var(--muted)]">
        <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
        Share with team
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[color:var(--accent)] px-2.5 py-1 text-sm text-white"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button type="button" className="text-sm text-[color:var(--muted)]" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}

function Popover({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="relative">
      <summary className={`${active ? chipActive : chip} cursor-pointer list-none`}>
        {label} <span aria-hidden>▾</span>
      </summary>
      <div className="absolute left-0 z-20 mt-1 max-h-72 min-w-52 overflow-auto rounded-md border border-[color:var(--line)] bg-white p-2 shadow-lg">
        {children}
      </div>
    </details>
  );
}

function FilterControl({
  label,
  type,
  options,
  selected,
  onChange,
}: {
  label: string;
  type: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  if (type === "date" || type === "datetime") {
    const [from = "", to = ""] = (selected[0] ?? "").split("..");
    const update = (nextFrom: string, nextTo: string) =>
      onChange(nextFrom || nextTo ? [`${nextFrom}..${nextTo}`] : []);
    const summary = from || to ? `${label}: ${from || "…"} – ${to || "…"}` : label;
    return (
      <Popover label={summary} active={Boolean(from || to)}>
        <div className="space-y-2 text-sm">
          <label className="block">
            From
            <input type="date" value={from} onChange={(e) => update(e.target.value, to)} className="mt-1 block w-full rounded border border-[color:var(--line)] px-2 py-1" />
          </label>
          <label className="block">
            To
            <input type="date" value={to} onChange={(e) => update(from, e.target.value)} className="mt-1 block w-full rounded border border-[color:var(--line)] px-2 py-1" />
          </label>
        </div>
      </Popover>
    );
  }
  const names = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
  const summary = names.length
    ? `${label}: ${names.length > 2 ? `${names.length} selected` : names.join(", ")}`
    : label;
  return (
    <Popover label={summary} active={names.length > 0}>
      <ul className="space-y-0.5 text-sm">
        {options.map((option) => (
          <li key={option.value}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-[color:var(--panel-soft)]">
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, option.value]
                      : selected.filter((v) => v !== option.value),
                  )
                }
              />
              {option.label}
            </label>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

function ColumnsMenu({
  fields,
  selected,
  titleKey,
  onChange,
}: {
  fields: { key: string; label: string }[];
  selected: string[];
  titleKey: string;
  onChange: (cols: string[]) => void;
}) {
  return (
    <Popover label="Columns" active={false}>
      <ul className="space-y-0.5 text-sm">
        {fields.map((field) => (
          <li key={field.key}>
            <label className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-[color:var(--panel-soft)]">
              <input
                type="checkbox"
                disabled={field.key === titleKey}
                checked={selected.includes(field.key)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? fields.map((f) => f.key).filter((k) => k === field.key || selected.includes(k))
                    : selected.filter((k) => k !== field.key);
                  onChange(next);
                }}
              />
              {field.label}
            </label>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

