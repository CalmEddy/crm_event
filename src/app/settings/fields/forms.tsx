"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { inputClassName } from "@/components/ui";
import { createCustomField, type FieldFormState } from "@/lib/actions/custom-fields";
import { CUSTOM_FIELD_TYPES } from "@/lib/custom-fields-shared";

export function NewFieldForm({ entity }: { entity: string }) {
  const [state, action, pending] = useActionState<FieldFormState, FormData>(createCustomField, {});
  const [type, setType] = useState("text");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-start gap-2 border-t border-[color:var(--line)] pt-4">
      <input type="hidden" name="entity" value={entity} />
      <input name="label" required placeholder="New field name" aria-label="New field name" className={`${inputClassName} max-w-56`} />
      <select
        name="type"
        aria-label="Field type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        className={`${inputClassName} max-w-40`}
      >
        {Object.entries(CUSTOM_FIELD_TYPES).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {type === "select" ? (
        <textarea
          name="options"
          rows={3}
          placeholder={"Choices, one per line"}
          aria-label="Dropdown choices, one per line"
          className={`${inputClassName} max-w-56`}
        />
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[color:var(--accent)] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        Add field
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-sm text-[color:var(--danger)]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function DeleteFieldButton({ action, label }: { action: () => Promise<void>; label: string }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm(`Delete "${label}" and every value stored in it? This can't be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <button type="submit" className="text-sm text-[color:var(--danger)]">
        Delete
      </button>
    </form>
  );
}
