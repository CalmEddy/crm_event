import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  automations,
  automationApprovals,
  automationRuns,
  getDb,
  type Automation,
  type EntityType,
} from "@/db";
import {
  changedColumns,
  evaluateConditionGroups,
  fieldChangedMatch,
} from "@/lib/automations/conditions";
import {
  canEnterAutomation,
  isDryRun,
  runInAutomationContext,
  type RecordMutation,
} from "@/lib/automations/context";
import { executeAction } from "@/lib/automations/execute";
import {
  normalizeConditionGroups,
  parseActions,
  parseTrigger,
  triggerEntity,
  type AutomationTrigger,
} from "@/lib/automations/rule-schema";

function triggerMatches(trigger: AutomationTrigger, mutation: RecordMutation): boolean {
  if (trigger.entity !== mutation.entity) return false;

  switch (trigger.type) {
    case "record_created":
      return mutation.kind === "created";
    case "record_deleted":
      return mutation.kind === "deleted";
    case "record_updated": {
      if (mutation.kind !== "updated") return false;
      if (!trigger.fields || trigger.fields.length === 0) return true;
      const changed = changedColumns(mutation.before, mutation.after);
      return trigger.fields.some(
        (f) => changed.includes(f) || changed.includes(f.replace(/^cf_/, "cf_")),
      );
    }
    case "field_changed":
      if (mutation.kind !== "updated" && mutation.kind !== "created") return false;
      return fieldChangedMatch(
        mutation.entity,
        trigger.field,
        mutation.before,
        mutation.after,
        mutation.kind === "created" ? undefined : trigger.from,
        trigger.to,
      );
    case "schedule":
    case "date_offset":
      return false;
    default:
      return false;
  }
}

async function loadEnabledAutomations(): Promise<Automation[]> {
  const db = await getDb({ system: true });
  return db
    .select()
    .from(automations)
    .where(eq(automations.enabled, true))
    .orderBy(automations.priority, automations.id);
}

async function startRun(
  automationId: number,
  mutation: RecordMutation,
  options?: { dryRun?: boolean; status?: string },
) {
  const db = await getDb({ system: true });
  const [row] = await db
    .insert(automationRuns)
    .values({
      automationId,
      status: options?.status ?? (options?.dryRun ? "dry_run" : "running"),
      triggerEntity: mutation.entity,
      triggerRecordId: mutation.id,
      detail: "",
      dryRun: Boolean(options?.dryRun),
    })
    .returning();
  return row.id;
}

async function finishRun(
  runId: number,
  status: string,
  detail: string,
  extra?: { error?: string; skipReason?: string },
) {
  const db = await getDb({ system: true });
  await db
    .update(automationRuns)
    .set({
      status,
      detail,
      error: extra?.error ?? null,
      skipReason: extra?.skipReason ?? null,
      finishedAt: new Date(),
    })
    .where(eq(automationRuns.id, runId));
}

async function rateLimited(automation: Automation): Promise<boolean> {
  const limit = automation.rateLimitPerHour;
  if (limit == null || limit <= 0) return false;
  const db = await getDb({ system: true });
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.automationId, automation.id),
        eq(automationRuns.status, "ok"),
        gte(automationRuns.startedAt, since),
      ),
    );
  return Number(row?.n ?? 0) >= limit;
}

async function runOne(
  automation: Automation,
  mutation: RecordMutation,
  options?: { dryRun?: boolean; force?: boolean },
) {
  const dryRun = Boolean(options?.dryRun);

  if (!options?.force && !canEnterAutomation(automation.id)) {
    const runId = await startRun(automation.id, mutation, { dryRun, status: "skipped" });
    await finishRun(runId, "skipped", "", {
      skipReason: "reentrancy_or_depth",
    });
    return;
  }

  let trigger: AutomationTrigger;
  let groups;
  let actions;
  try {
    trigger = parseTrigger(automation.trigger);
    groups = normalizeConditionGroups(automation.conditions);
    actions = parseActions(automation.actions);
  } catch (err) {
    const runId = await startRun(automation.id, mutation, { dryRun });
    await finishRun(runId, "error", "Invalid automation definition", {
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (!options?.force && !triggerMatches(trigger, mutation)) return;

  const entity = triggerEntity(trigger);
  const okConditions = await evaluateConditionGroups(
    entity,
    groups,
    mutation.before,
    mutation.after,
    mutation.id,
  );
  if (!okConditions) {
    const runId = await startRun(automation.id, mutation, {
      dryRun,
      status: "skipped",
    });
    await finishRun(runId, "skipped", "", { skipReason: "conditions_not_met" });
    return;
  }

  if (!dryRun && (await rateLimited(automation))) {
    const runId = await startRun(automation.id, mutation, { status: "skipped" });
    await finishRun(runId, "skipped", "", { skipReason: "rate_limited" });
    return;
  }

  if (!dryRun && automation.requireApproval) {
    const db = await getDb({ system: true });
    const runId = await startRun(automation.id, mutation, {
      status: "pending_approval",
    });
    await db.insert(automationApprovals).values({
      automationId: automation.id,
      triggerEntity: mutation.entity,
      triggerRecordId: mutation.id,
      actions: automation.actions,
      status: "pending",
      detail: `Awaiting approval for ${mutation.entity} #${mutation.id}`,
    });
    await finishRun(runId, "pending_approval", "Queued for approval");
    return;
  }

  const runId = await startRun(automation.id, mutation, { dryRun });

  await runInAutomationContext(
    automation.id,
    async () => {
      const details: string[] = [];
      const followUpQueue: RecordMutation[] = [];
      try {
        for (const action of actions) {
          const result = await executeAction(action, mutation);
          details.push(result.detail);
          if (result.followUps?.length) followUpQueue.push(...result.followUps);
        }
        await finishRun(
          runId,
          dryRun || isDryRun() ? "dry_run" : "ok",
          details.join("; "),
        );
        if (!dryRun) {
          for (const follow of followUpQueue) {
            await dispatchRecordMutation(follow);
          }
        }
      } catch (err) {
        await finishRun(runId, "error", details.join("; "), {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    { dryRun },
  );
}

/**
 * Evaluate enabled record-triggered automations for a mutation.
 * Errors are logged per-run and never thrown to the caller.
 */
export async function dispatchRecordMutation(mutation: RecordMutation) {
  try {
    const list = await loadEnabledAutomations();
    for (const automation of list) {
      try {
        await runOne(automation, mutation);
      } catch (err) {
        console.error(
          `[automations] failed for automation ${automation.id}:`,
          err,
        );
      }
    }
  } catch (err) {
    console.error("[automations] dispatch failed:", err);
  }
}

/** Test one automation against a record (dry-run by default). */
export async function testAutomationAgainstRecord(options: {
  automationId: number;
  entity: EntityType;
  recordId: number;
  dryRun?: boolean;
}) {
  const db = await getDb({ system: true });
  const [automation] = await db
    .select()
    .from(automations)
    .where(eq(automations.id, options.automationId));
  if (!automation) throw new Error("Automation not found");

  const { snapshotWithCustom } = await import("@/lib/automations/snapshot");
  const after = await snapshotWithCustom(options.entity, options.recordId);
  if (!after) throw new Error("Record not found");

  const mutation: RecordMutation = {
    entity: options.entity,
    id: options.recordId,
    kind: "updated",
    before: after,
    after,
  };

  await runOne(automation, mutation, {
    dryRun: options.dryRun !== false,
    force: true,
  });

  const [run] = await db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.automationId, options.automationId))
    .orderBy(desc(automationRuns.startedAt))
    .limit(1);
  return run;
}

/** Execute a pending approval (runs actions for real). */
export async function resolveAutomationApproval(
  approvalId: number,
  decision: "approved" | "rejected",
  resolvedBy: number | null,
) {
  const db = await getDb({ system: true });
  const [approval] = await db
    .select()
    .from(automationApprovals)
    .where(eq(automationApprovals.id, approvalId));
  if (!approval || approval.status !== "pending") {
    throw new Error("Approval not found or already resolved");
  }

  await db
    .update(automationApprovals)
    .set({
      status: decision,
      resolvedAt: new Date(),
      resolvedBy,
    })
    .where(eq(automationApprovals.id, approvalId));

  if (decision === "rejected") {
    return { ok: true as const, ran: false };
  }

  const [automation] = await db
    .select()
    .from(automations)
    .where(eq(automations.id, approval.automationId));
  if (!automation) throw new Error("Automation missing");

  const { snapshotWithCustom } = await import("@/lib/automations/snapshot");
  const after = await snapshotWithCustom(
    approval.triggerEntity,
    approval.triggerRecordId,
  );
  if (!after) throw new Error("Record missing");

  // Temporarily clear requireApproval so runOne executes.
  const unlocked = { ...automation, requireApproval: false };
  await runOne(
    unlocked,
    {
      entity: approval.triggerEntity,
      id: approval.triggerRecordId,
      kind: "updated",
      before: after,
      after,
    },
    { force: true },
  );
  return { ok: true as const, ran: true };
}

export async function listAutomationsForEntity(entity: EntityType) {
  const db = await getDb({ system: true });
  const rows = await db.select().from(automations);
  return rows.filter((row) => {
    try {
      return triggerEntity(parseTrigger(row.trigger)) === entity;
    } catch {
      return row.entity === entity;
    }
  });
}
