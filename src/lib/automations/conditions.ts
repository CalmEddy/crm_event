import { and, eq } from "drizzle-orm";
import {
  getDb,
  recordOwners,
  recordTags,
  type EntityType,
} from "@/db";
import { fieldByKey } from "@/lib/automations/fields";
import type {
  AutomationCondition,
  AutomationConditionGroup,
} from "@/lib/automations/rule-schema";
import { listEventAssigneeIds, listTaskAssigneeIds } from "@/lib/assignees";

function normalize(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

function resolveColumn(entity: EntityType, fieldKey: string): string {
  return fieldByKey(entity, fieldKey)?.column ?? fieldKey;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function listAssigneeIds(entity: EntityType, id: number): Promise<number[]> {
  if (entity === "event") return listEventAssigneeIds(id);
  if (entity === "task") return listTaskAssigneeIds(id);
  return listOwnerIds(entity, id);
}

async function listOwnerIds(entity: EntityType, id: number): Promise<number[]> {
  const db = await getDb({ system: true });
  const rows = await db
    .select({ userId: recordOwners.userId })
    .from(recordOwners)
    .where(and(eq(recordOwners.entity, entity), eq(recordOwners.entityId, id)));
  return rows.map((r) => r.userId);
}

async function recordHasTag(
  entity: EntityType,
  entityId: number,
  tagId: number,
): Promise<boolean> {
  const db = await getDb({ system: true });
  const [row] = await db
    .select({ tagId: recordTags.tagId })
    .from(recordTags)
    .where(
      and(
        eq(recordTags.entity, entity),
        eq(recordTags.entityId, entityId),
        eq(recordTags.tagId, tagId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function evaluateCondition(
  entity: EntityType,
  recordId: number,
  condition: AutomationCondition,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Promise<boolean> {
  const column = resolveColumn(entity, condition.field ?? "");
  const beforeVal = before ? before[column] : undefined;
  const afterVal = after ? after[column] : undefined;
  const current = after ?? before;

  switch (condition.op) {
    case "eq":
      return normalize(current?.[column]) === normalize(condition.value ?? "");
    case "neq":
      return normalize(current?.[column]) !== normalize(condition.value ?? "");
    case "in": {
      const allowed = condition.values ?? (condition.value ? [condition.value] : []);
      return allowed.map(normalize).includes(normalize(current?.[column]));
    }
    case "changed":
      return normalize(beforeVal) !== normalize(afterVal);
    case "changed_to":
      return (
        normalize(beforeVal) !== normalize(afterVal) &&
        normalize(afterVal) === normalize(condition.value ?? "")
      );
    case "changed_from":
      return (
        normalize(beforeVal) !== normalize(afterVal) &&
        normalize(beforeVal) === normalize(condition.value ?? "")
      );
    case "is_empty":
      return isEmpty(current?.[column]);
    case "is_not_empty":
      return !isEmpty(current?.[column]);
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const left = asNumber(current?.[column]);
      const right = asNumber(condition.value);
      if (left == null || right == null) return false;
      if (condition.op === "gt") return left > right;
      if (condition.op === "gte") return left >= right;
      if (condition.op === "lt") return left < right;
      return left <= right;
    }
    case "has_tag": {
      const tagId = condition.id ?? Number(condition.value);
      if (!Number.isFinite(tagId) || tagId <= 0) return false;
      return recordHasTag(entity, recordId, tagId);
    }
    case "assigned_to": {
      const userId = condition.id ?? Number(condition.value);
      if (!Number.isFinite(userId) || userId <= 0) return false;
      const ids = await listAssigneeIds(entity, recordId);
      return ids.includes(userId);
    }
    case "owned_by": {
      const userId = condition.id ?? Number(condition.value);
      if (!Number.isFinite(userId) || userId <= 0) return false;
      const ids = await listOwnerIds(entity, recordId);
      return ids.includes(userId);
    }
    default:
      return false;
  }
}

/** Legacy flat AND evaluation. */
export async function evaluateConditions(
  entity: EntityType,
  conditions: AutomationCondition[],
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  recordId?: number,
): Promise<boolean> {
  if (conditions.length === 0) return true;
  const row = after ?? before;
  if (!row && conditions.some((c) => !String(c.op).startsWith("changed") && c.op !== "has_tag" && c.op !== "assigned_to" && c.op !== "owned_by")) {
    return false;
  }
  const id = recordId ?? Number(row?.id ?? before?.id ?? 0);
  for (const condition of conditions) {
    if (!(await evaluateCondition(entity, id, condition, before, after))) return false;
  }
  return true;
}

/** OR of AND-groups. Empty groups list = pass. */
export async function evaluateConditionGroups(
  entity: EntityType,
  groups: AutomationConditionGroup[],
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  recordId: number,
): Promise<boolean> {
  if (groups.length === 0) return true;
  for (const group of groups) {
    if (await evaluateConditions(entity, group.conditions, before, after, recordId)) {
      return true;
    }
  }
  return false;
}

export function fieldChangedMatch(
  entity: EntityType,
  fieldKey: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  from?: string,
  to?: string,
): boolean {
  const column = resolveColumn(entity, fieldKey);
  const beforeVal = before?.[column];
  const afterVal = after?.[column];
  if (normalize(beforeVal) === normalize(afterVal)) return false;
  if (from != null && from !== "" && normalize(beforeVal) !== normalize(from)) return false;
  if (to != null && to !== "" && normalize(afterVal) !== normalize(to)) return false;
  return true;
}

export function changedColumns(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (key === "id" || key === "createdAt" || key === "updatedAt") continue;
    if (normalize(before[key]) !== normalize(after[key])) changed.push(key);
  }
  return changed;
}
