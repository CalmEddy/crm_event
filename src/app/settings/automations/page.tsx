import { asc, desc } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import {
  ButtonLink,
  EmptyState,
  PageHeader,
  Section,
} from "@/components/ui";
import { automations, getDb } from "@/db";
import { ensureSeedData } from "@/db/seed";
import {
  listPendingApprovals,
  listRecentAutomationRuns,
  resolveApprovalAction,
  setAutomationEnabled,
} from "@/lib/actions/automations";
import { summarizeTrigger } from "@/lib/automations/rule-schema";
import { recordHref } from "@/lib/entities";
import { formatDateTime } from "@/lib/format";
import { AutomationToggle } from "./automation-toggle";
import { ApprovalButtons } from "./approval-buttons";
import { RunsFilter } from "./runs-filter";

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<{ automationId?: string; status?: string }>;
}) {
  await connection();
  await ensureSeedData();
  const params = await searchParams;
  const automationId = params.automationId ? Number(params.automationId) : undefined;
  const status = params.status?.trim() || undefined;

  const db = await getDb();
  const [rows, runs, approvals] = await Promise.all([
    db.select().from(automations).orderBy(asc(automations.priority), desc(automations.updatedAt)),
    listRecentAutomationRuns({
      limit: 40,
      automationId: Number.isFinite(automationId) ? automationId : undefined,
      status,
    }),
    listPendingApprovals(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Automations"
        description="Team-wide rules that create, update, and notify when records change — or on a schedule."
        actions={<ButtonLink href="/settings/automations/new">New automation</ButtonLink>}
      />

      {approvals.length > 0 ? (
        <Section title="Pending approvals">
          <ul className="divide-y divide-[color:var(--line)] rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
            {approvals.map((item) => {
              const href = recordHref(item.triggerEntity, item.triggerRecordId);
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-[color:var(--ink)]">
                      {item.automationName ?? `#${item.automationId}`}
                    </p>
                    <p className="text-[color:var(--muted)]">
                      {item.triggerEntity}{" "}
                      {href ? (
                        <Link href={href} className="text-[color:var(--accent)] hover:underline">
                          #{item.triggerRecordId}
                        </Link>
                      ) : (
                        `#${item.triggerRecordId}`
                      )}
                      {" · "}
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <ApprovalButtons
                    id={item.id}
                    action={resolveApprovalAction}
                  />
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No automations yet"
          description="Create a rule such as “when event status changes to booked, apply the Standard booking task group”."
          action={<ButtonLink href="/settings/automations/new">New automation</ButtonLink>}
        />
      ) : (
        <Section title="Rules">
          <div className="overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[color:var(--line)] bg-[color:var(--panel-soft)] text-[color:var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Enabled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/settings/automations/${row.id}`}
                        className="font-medium text-[color:var(--accent)] hover:underline"
                      >
                        {row.name}
                      </Link>
                      {row.requireApproval ? (
                        <span className="ml-2 text-xs text-[color:var(--muted)]">approval</span>
                      ) : null}
                      {row.description ? (
                        <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                          {row.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">
                      {summarizeTrigger(row.trigger)}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted)]">{row.priority}</td>
                    <td className="px-4 py-3">
                      <AutomationToggle
                        id={row.id}
                        enabled={row.enabled}
                        action={setAutomationEnabled}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section
        title="Recent runs"
        actions={
          <RunsFilter
            automations={rows.map((r) => ({ id: r.id, name: r.name }))}
            automationId={Number.isFinite(automationId) ? automationId : undefined}
            status={status}
          />
        }
      >
        {runs.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No runs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[color:var(--line)] bg-[color:var(--panel-soft)] text-[color:var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Automation</th>
                  <th className="px-4 py-3 font-medium">Record</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {runs.map((run) => {
                  const href = recordHref(run.triggerEntity, run.triggerRecordId);
                  return (
                    <tr key={run.id}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDateTime(run.startedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/settings/automations/${run.automationId}`}
                          className="text-[color:var(--accent)] hover:underline"
                        >
                          {run.automationName ?? `#${run.automationId}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {href ? (
                          <Link href={href} className="text-[color:var(--accent)] hover:underline">
                            {run.triggerEntity} #{run.triggerRecordId}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{run.status}</span>
                        {run.skipReason ? (
                          <p className="text-xs text-[color:var(--muted)]">{run.skipReason}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">
                        {run.error || run.detail || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
