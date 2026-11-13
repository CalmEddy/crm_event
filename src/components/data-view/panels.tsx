"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { EntityViewConfig, FieldDef, Ref, ViewRow } from "@/lib/views/fields";
import { cellText } from "@/lib/views/query";
import { AssigneeCell } from "./assignees";
import { EditableCell, FieldInput } from "./editors";
import { TagCell } from "./tags";

/** Slide-over record editor: edit every field without leaving the list. */
export function RecordDrawer({
  config,
  row,
  options,
  onEdit,
  onClose,
}: {
  config: EntityViewConfig;
  row: ViewRow;
  options: (field: FieldDef) => Ref[];
  onEdit: (id: number, field: FieldDef, input: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !(event.target as HTMLElement).closest("input,select")) {
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const title = cellText(row.values[config.titleKey]) || `#${row.id}`;
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="presentation">
      <button
        type="button"
        aria-label="Close details"
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${config.label}: ${title}`}
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-[color:var(--line)] bg-[color:var(--panel)] shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--line)] px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--muted)]">{config.label}</p>
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-lg text-[color:var(--muted)] hover:bg-[color:var(--panel-soft)]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <dl className="divide-y divide-[color:var(--line)] px-5">
          {config.fields.map((field) => (
            <div key={field.key} className="grid grid-cols-[7rem_1fr] items-start gap-3 py-3 text-sm">
              <dt className="pt-1 text-[color:var(--muted)]">{field.label}</dt>
              <dd>
                {field.type === "users" ? (
                  <AssigneeCell rowId={row.id} value={(row.values[field.key] as Ref[]) ?? []} />
                ) : field.type === "tags" ? (
                  <TagCell rowId={row.id} value={(row.values[field.key] as Ref[]) ?? []} />
                ) : (
                <EditableCell
                  field={field}
                  value={row.values[field.key]}
                  options={options(field)}
                  onSave={(input) => onEdit(row.id, field, input)}
                />
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="px-5 pt-2 text-xs text-[color:var(--muted)]">
          Click a value to edit it. Enter saves, Esc cancels.
        </p>
        <div className="mt-auto border-t border-[color:var(--line)] px-5 py-4">
          <Link
            href={`${config.basePath}/${row.id}`}
            className="text-sm font-medium text-[color:var(--accent)] hover:underline"
          >
            Open full page (notes and links) →
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Title-only create row; extra defaults come from the active filters. */
export function QuickAdd({
  config,
  defaultsLabel,
  onCreate,
  inputRef,
}: {
  config: EntityViewConfig;
  defaultsLabel: string;
  onCreate: (title: string) => Promise<boolean>;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const title = value.trim();
        if (!title) return;
        startTransition(async () => {
          if (await onCreate(title)) setValue("");
        });
      }}
    >
      <span aria-hidden className="text-[color:var(--muted)]">+</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && event.currentTarget.blur()}
        placeholder={`Add a ${config.label.toLowerCase()}… press Enter to save (n)`}
        aria-label={`Quick add ${config.label.toLowerCase()}`}
        className="min-w-60 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-[color:var(--muted)]"
        disabled={pending}
      />
      {defaultsLabel ? (
        <span className="text-xs text-[color:var(--muted)]">with {defaultsLabel}</span>
      ) : null}
      {pending ? <span className="text-xs text-[color:var(--muted)]">Adding…</span> : null}
    </form>
  );
}


/** Shown while rows are selected: set a field on all of them, or delete. */
export function BulkBar({
  config,
  count,
  options,
  onApply,
  onDelete,
  onClear,
  assignSlot,
}: {
  assignSlot?: React.ReactNode;
  config: EntityViewConfig;
  count: number;
  options: (field: FieldDef) => Ref[];
  onApply: (field: FieldDef, input: string) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const bulkFields = config.fields.filter(
    (f) => f.editable && f.key !== config.titleKey && f.type !== "text",
  );
  const [key, setKey] = useState(bulkFields[0]?.key ?? "");
  const field = bulkFields.find((f) => f.key === key);
  const [value, setValue] = useState("");
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-4 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--accent)] bg-[color:var(--panel)] px-4 py-3 shadow-lg"
    >
      <strong className="text-sm">{count} selected</strong>
      {field ? (
        <>
          <span className="text-sm text-[color:var(--muted)]">Set</span>
          <select
            aria-label="Field to set"
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              setValue("");
            }}
            className="rounded-md border border-[color:var(--line)] bg-white px-2 py-1 text-sm"
          >
            {bulkFields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <span className="text-sm text-[color:var(--muted)]">to</span>
          <div className="w-48">
            <FieldInput
              key={field.key}
              field={field}
              value={value}
              options={options(field)}
              onChange={setValue}
              onCommit={setValue}
              onCancel={() => undefined}
              className="w-full rounded-md border border-[color:var(--line)] bg-white px-2 py-1 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => onApply(field, value)}
            disabled={field.type !== "relation" && !value}
            className="rounded-md bg-[color:var(--accent)] px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Apply
          </button>
        </>
      ) : null}
      {assignSlot}
      <span className="mx-1 h-5 w-px bg-[color:var(--line)]" aria-hidden />
      {confirming ? (
        <span className="inline-flex items-center gap-2 text-sm">
          Delete {count} {count === 1 ? config.label.toLowerCase() : config.pluralLabel.toLowerCase()}? This can&apos;t be undone.
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              onDelete();
            }}
            className="rounded-md bg-[color:var(--danger)] px-3 py-1 text-white"
          >
            Delete
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="text-[color:var(--muted)]">
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md border border-[color:var(--danger)] px-3 py-1 text-sm text-[color:var(--danger)]"
        >
          Delete…
        </button>
      )}
      <button type="button" onClick={onClear} className="ml-auto text-sm text-[color:var(--muted)] hover:underline">
        Clear selection
      </button>
    </div>
  );
}
