"use client";

import { useTransition } from "react";

export function ApprovalButtons({
  id,
  action,
}: {
  id: number;
  action: (
    id: number,
    decision: "approved" | "rejected",
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        className="rounded-md bg-[color:var(--accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        onClick={() =>
          startTransition(async () => {
            await action(id, "approved");
          })
        }
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        className="rounded-md border border-[color:var(--line)] px-3 py-1.5 text-xs disabled:opacity-60"
        onClick={() =>
          startTransition(async () => {
            await action(id, "rejected");
          })
        }
      >
        Reject
      </button>
    </div>
  );
}
