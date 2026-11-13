"use client";

import { useOptimistic, useState, useTransition } from "react";
import { EditableCell } from "@/components/data-view/editors";
import { updateRecordsAction } from "@/lib/actions/views";
import type { FieldDef } from "@/lib/views/fields";

export function CustomFieldsEditor({
  entity,
  id,
  fields,
  values,
}: {
  entity: string;
  id: number;
  fields: FieldDef[];
  values: Record<string, string>;
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    values,
    (current, patch: Record<string, string>) => ({ ...current, ...patch }),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className="grid grid-cols-[9rem_1fr] items-center gap-2">
            <dt className="text-[color:var(--muted)]">{field.label}</dt>
            <dd>
              <EditableCell
                field={field}
                value={optimistic[field.key] ?? null}
                options={[]}
                onSave={(input) => {
                  setError(null);
                  startTransition(async () => {
                    setOptimistic({ [field.key]: input });
                    const result = await updateRecordsAction(entity, [id], { [field.key]: input || null });
                    if (!result.ok) setError(result.error);
                  });
                }}
              />
            </dd>
          </div>
        ))}
      </dl>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
