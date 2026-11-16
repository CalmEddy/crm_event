"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  automations,
  automationApprovals,
  automationRuns,
  getDb,
  taskGroups,
  tags,
  users,
  type EntityType,
} from "@/db";
import { requireSignedIn } from "@/lib/auth";
import {
  automationDefinitionSchema,
  triggerEntity,
} from "@/lib/automations/rule-schema";
import { getCurrentUserId } from "@/lib/current-user";
import { isEntityType } from "@/lib/entities";

export type AutomationActionResult =
  | { ok: true; id?: number }
  | { ok: false; error: string };

type Option = { id: number; name: string };

function revalidateAutomations(id?: number) {
  revalidatePath("/settings/automations");
  if (id) revalidatePath(`/settings/automations/${id}`);
}

function definitionValues(data: ReturnType<typeof automationDefinitionSchema.parse>) {
  return {
    name: data.name,
    description: data.description ?? null,
    enabled: data.enabled,
    priority: data.priority,
    requireApproval: data.requireApproval,
    rateLimitPerHour: data.rateLimitPerHour ?? null,
    timezone: data.timezone,
    entity: triggerEntity(data.trigger),
    trigger: data.trigger,
    conditions: data.conditions,
    actions: data.actions,
  };
}

export async function createAutomation(
  input: unknown,
): Promise<AutomationActionResult> {
  await requireSignedIn();
  const parsed = automationDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid automation" };
  }
  const db = await getDb();
  const [row] = await db
    .insert(automations)
    .values(definitionValues(parsed.data))
    .returning();
  revalidateAutomations(row.id);
  return { ok: true, id: row.id };
}

export async function updateAutomation(
  id: number,
  input: unknown,
): Promise<AutomationActionResult> {
  await requireSignedIn();
  const parsed = automationDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid automation" };
  }
  const db = await getDb();
  await db
    .update(automations)
    .set({ ...definitionValues(parsed.data), updatedAt: new Date() })
    .where(eq(automations.id, id));
  revalidateAutomations(id);
  return { ok: true, id };
}

export async function setAutomationEnabled(
  id: number,
  enabled: boolean,
): Promise<AutomationActionResult> {
  await requireSignedIn();
  const db = await getDb();
  await db
    .update(automations)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(automations.id, id));
  revalidateAutomations(id);
  return { ok: true, id };
}

export async function deleteAutomation(id: number): Promise<AutomationActionResult> {
  await requireSignedIn();
  const db = await getDb();
  await db.delete(automations).where(eq(automations.id, id));
  revalidateAutomations();
  redirect("/settings/automations");
}

export async function loadAutomationEditorOptions() {
  await requireSignedIn();
  const db = await getDb();
  const { listCustomFields } = await import("@/lib/custom-fields");
  const { AUTOMATION_ENTITIES } = await import("@/lib/automations/rule-schema");
  const [groupRows, tagRows, userRows, ...customLists] = await Promise.all([
    db.select({ id: taskGroups.id, name: taskGroups.name }).from(taskGroups),
    db.select({ id: tags.id, name: tags.name }).from(tags),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.active, true)),
    ...AUTOMATION_ENTITIES.map((entity) => listCustomFields(entity)),
  ]);
  const customFields = Object.fromEntries(
    AUTOMATION_ENTITIES.map((entity, index) => [entity, customLists[index]]),
  ) as Record<(typeof AUTOMATION_ENTITIES)[number], Awaited<ReturnType<typeof listCustomFields>>>;
  return { taskGroups: groupRows, tags: tagRows, users: userRows, customFields };
}

export async function createAutomationTag(
  name: string,
): Promise<{ ok: true; tag: Option } | { ok: false; error: string }> {
  await requireSignedIn();
  try {
    const { findOrCreateTag } = await import("@/lib/tags");
    const tag = await findOrCreateTag(name);
    revalidateAutomations();
    return { ok: true, tag: { id: tag.id, name: tag.label } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not create tag",
    };
  }
}

export async function createAutomationTaskGroup(
  name: string,
): Promise<{ ok: true; group: Option } | { ok: false; error: string }> {
  await requireSignedIn();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required" };
  const db = await getDb();
  const [row] = await db
    .insert(taskGroups)
    .values({ name: trimmed, description: null })
    .returning();
  revalidateAutomations();
  revalidatePath("/task-groups");
  return { ok: true, group: { id: row.id, name: row.name } };
}

export async function listRecentAutomationRuns(options?: {
  limit?: number;
  automationId?: number;
  status?: string;
}) {
  await requireSignedIn();
  const db = await getDb();
  const limit = options?.limit ?? 40;
  const filters = [];
  if (options?.automationId) {
    filters.push(eq(automationRuns.automationId, options.automationId));
  }
  if (options?.status) {
    filters.push(eq(automationRuns.status, options.status));
  }
  return db
    .select({
      id: automationRuns.id,
      automationId: automationRuns.automationId,
      status: automationRuns.status,
      triggerEntity: automationRuns.triggerEntity,
      triggerRecordId: automationRuns.triggerRecordId,
      detail: automationRuns.detail,
      error: automationRuns.error,
      skipReason: automationRuns.skipReason,
      dryRun: automationRuns.dryRun,
      startedAt: automationRuns.startedAt,
      automationName: automations.name,
    })
    .from(automationRuns)
    .leftJoin(automations, eq(automationRuns.automationId, automations.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(automationRuns.startedAt))
    .limit(limit);
}

export async function testAutomationAction(
  automationId: number,
  entity: string,
  recordId: number,
  dryRun = true,
): Promise<
  | { ok: true; status: string; detail: string; skipReason: string | null }
  | { ok: false; error: string }
> {
  await requireSignedIn();
  if (!isEntityType(entity)) return { ok: false, error: "Invalid entity" };
  if (!Number.isFinite(recordId) || recordId <= 0) {
    return { ok: false, error: "Enter a valid record id" };
  }
  try {
    const { testAutomationAgainstRecord } = await import("@/lib/automations/runner");
    const run = await testAutomationAgainstRecord({
      automationId,
      entity: entity as EntityType,
      recordId,
      dryRun,
    });
    revalidateAutomations(automationId);
    return {
      ok: true,
      status: run?.status ?? "unknown",
      detail: run?.detail ?? "",
      skipReason: run?.skipReason ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Test failed",
    };
  }
}

export async function listPendingApprovals() {
  await requireSignedIn();
  const db = await getDb();
  return db
    .select({
      id: automationApprovals.id,
      automationId: automationApprovals.automationId,
      automationName: automations.name,
      triggerEntity: automationApprovals.triggerEntity,
      triggerRecordId: automationApprovals.triggerRecordId,
      detail: automationApprovals.detail,
      createdAt: automationApprovals.createdAt,
    })
    .from(automationApprovals)
    .leftJoin(automations, eq(automationApprovals.automationId, automations.id))
    .where(eq(automationApprovals.status, "pending"))
    .orderBy(desc(automationApprovals.createdAt));
}

export async function resolveApprovalAction(
  approvalId: number,
  decision: "approved" | "rejected",
): Promise<AutomationActionResult> {
  await requireSignedIn();
  try {
    const { resolveAutomationApproval } = await import("@/lib/automations/runner");
    const userId = await getCurrentUserId();
    await resolveAutomationApproval(approvalId, decision, userId);
    revalidateAutomations();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not resolve approval",
    };
  }
}
