"use client";

import { useState, useTransition } from "react";
import { inputClassName } from "@/components/ui";
import { testAutomationAction } from "@/lib/actions/automations";
import { AUTOMATION_ENTITIES } from "@/lib/automations/rule-schema";
import { labelize } from "@/lib/constants";

export function TestPanel({
  automationId,
  defaultEntity,
}: {
  automationId: number;
  defaultEntity: string;
}) {
  const [entity, setEntity] = useState(defaultEntity || "event");
  const [recordId, setRecordId] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="space-y-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
      <h2 className="font-[family-name:var(--font-display)] text-lg">Test</h2>
      <p className="text-sm text-[color:var(--muted)]">
        Dry-run this rule against a record. Nothing is written; a dry_run row appears in Recent runs.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          className={inputClassName}
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
        >
          {AUTOMATION_ENTITIES.map((value) => (
            <option key={value} value={value}>
              {labelize(value)}
            </option>
          ))}
        </select>
        <input
          className={`${inputClassName} max-w-32`}
          type="number"
          min={1}
          placeholder="Record id"
          value={recordId}
          onChange={(e) => setRecordId(e.target.value)}
        />
        <button
          type="button"
          disabled={pending || !recordId}
          className="rounded-md bg-[color:var(--accent)] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={() =>
            startTransition(async () => {
              setResult(null);
              const res = await testAutomationAction(
                automationId,
                entity,
                Number(recordId),
                true,
              );
              if (!res.ok) {
                setResult(res.error);
                return;
              }
              setResult(
                `${res.status}${res.skipReason ? ` (${res.skipReason})` : ""}: ${res.detail || "—"}`,
              );
            })
          }
        >
          Dry-run
        </button>
      </div>
      {result ? (
        <p className="text-sm text-[color:var(--ink)]" role="status">
          {result}
        </p>
      ) : null}
    </section>
  );
}
