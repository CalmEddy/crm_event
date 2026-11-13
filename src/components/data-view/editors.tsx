"use client";

import { useEffect, useRef, useState } from "react";
import { toDateTimeLocalValue } from "@/lib/format";
import type { CellValue, FieldDef, Ref } from "@/lib/views/fields";
import { Cell } from "./views";

/** Convert a cell value into the string an <input>/<select> expects. */
export function toInputValue(field: FieldDef, value: CellValue | undefined): string {
  if (value == null) return "";
  if (field.type === "relation") return Array.isArray(value) || typeof value === "string" ? "" : String(value.id);
  if (typeof value !== "string") return "";
  if (field.type === "datetime") return toDateTimeLocalValue(value);
  if (field.type === "date") return value.slice(0, 10);
  return value;
}

/** Convert an input string back to what the server action expects. */
export function toWireValue(field: FieldDef, input: string): string | null {
  if (field.type === "datetime") {
    if (!input) return null;
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? input : date.toISOString();
  }
  return input === "" ? null : input;
}

/** Optimistic cell value for an input string. */
export function toCellValue(field: FieldDef, input: string, options: Ref[]): CellValue {
  if (field.type === "relation") return options.find((o) => String(o.id) === input) ?? null;
  return toWireValue(field, input);
}

const editorClass =
  "w-full min-w-28 rounded border border-[color:var(--accent)] bg-white px-2 py-1 text-sm text-[color:var(--ink)] outline-none ring-2 ring-[color:var(--accent)]/30";

export function FieldInput({
  field,
  value,
  options,
  autoFocus,
  onChange,
  onCommit,
  onCancel,
  className = editorClass,
  id,
}: {
  field: FieldDef;
  value: string;
  options: Ref[];
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);
  useEffect(() => {
    if (autoFocus) {
      ref.current?.focus();
      if (ref.current && "select" in ref.current && field.type === "text") ref.current.select();
    }
  }, [autoFocus, field.type]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onCommit(event.currentTarget.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  if (field.type === "enum" || field.type === "relation") {
    const choices =
      field.type === "enum"
        ? (field.options ?? []).map((o) => ({ value: o.value, label: o.label }))
        : options.map((o) => ({ value: String(o.id), label: o.label }));
    return (
      <select
        id={id}
        ref={ref}
        aria-label={field.label}
        className={className}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          // Selecting is a complete edit: save immediately.
          onCommit(event.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={onCancel}
      >
        {field.type === "relation" ? <option value="">—</option> : null}
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      id={id}
      ref={ref}
      aria-label={field.label}
      className={className}
      type={field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : "text"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={(event) => onCommit(event.currentTarget.value)}
    />
  );
}

/**
 * Click (or focus + Enter) to edit in place. Enter/blur saves, Esc cancels.
 * Tab leaves the cell (saving) and lands on the next cell.
 */
export function EditableCell({
  field,
  value,
  options,
  onSave,
  display,
}: {
  field: FieldDef;
  value: CellValue | undefined;
  options: Ref[];
  onSave: (input: string) => void;
  display?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const initial = toInputValue(field, value);

  if (!field.editable) return <>{display ?? <Cell field={field} value={value} />}</>;

  if (editing) {
    return (
      <FieldInput
        field={field}
        value={draft}
        options={options}
        autoFocus
        onChange={setDraft}
        onCommit={(next) => {
          setEditing(false);
          if (next !== initial) onSave(next);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Edit ${field.label}`}
      title="Click to edit"
      className="-mx-1.5 -my-1 min-h-7 cursor-text rounded px-1.5 py-1 outline-none hover:bg-[color:var(--panel-soft)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
      onClick={(event) => {
        // Let links inside the display (relations) still navigate.
        if ((event.target as HTMLElement).closest("a")) return;
        setDraft(initial);
        setEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "F2") {
          event.preventDefault();
          setDraft(initial);
          setEditing(true);
        }
      }}
    >
      {display ?? <Cell field={field} value={value} />}
    </div>
  );
}
