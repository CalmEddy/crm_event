"use client";

import { useTransition } from "react";

export function AutomationToggle({
  id,
  enabled,
  action,
}: {
  id: number;
  enabled: boolean;
  action: (id: number, enabled: boolean) => Promise<{ ok: boolean }>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await action(id, !enabled);
        })
      }
      className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
        enabled
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-[color:var(--line)] bg-[color:var(--panel-soft)] text-[color:var(--muted)]"
      }`}
    >
      {enabled ? "On" : "Off"}
    </button>
  );
}
