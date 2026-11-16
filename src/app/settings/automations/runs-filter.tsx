"use client";

import { useRouter } from "next/navigation";
import { inputClassName } from "@/components/ui";

export function RunsFilter({
  automations,
  automationId,
  status,
}: {
  automations: { id: number; name: string }[];
  automationId?: number;
  status?: string;
}) {
  const router = useRouter();

  const push = (next: { automationId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (next.automationId) params.set("automationId", next.automationId);
    if (next.status) params.set("status", next.status);
    const q = params.toString();
    router.push(q ? `/settings/automations?${q}` : "/settings/automations");
  };

  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <select
        className={inputClassName}
        value={automationId ?? ""}
        onChange={(e) =>
          push({
            automationId: e.target.value || undefined,
            status,
          })
        }
      >
        <option value="">All automations</option>
        {automations.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <select
        className={inputClassName}
        value={status ?? ""}
        onChange={(e) =>
          push({
            automationId: automationId ? String(automationId) : undefined,
            status: e.target.value || undefined,
          })
        }
      >
        <option value="">All statuses</option>
        <option value="ok">ok</option>
        <option value="skipped">skipped</option>
        <option value="error">error</option>
        <option value="dry_run">dry_run</option>
        <option value="pending_approval">pending_approval</option>
      </select>
    </div>
  );
}
