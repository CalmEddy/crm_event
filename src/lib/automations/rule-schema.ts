// Zod schemas for automation trigger / condition / action JSON. Safe for client imports.
import { z } from "zod";

export const AUTOMATION_ENTITIES = [
  "contact",
  "organization",
  "event",
  "task",
] as const;

const entitySchema = z.enum(AUTOMATION_ENTITIES);

export const CONDITION_OPS = [
  "eq",
  "neq",
  "in",
  "changed",
  "changed_to",
  "changed_from",
  "is_empty",
  "is_not_empty",
  "gt",
  "gte",
  "lt",
  "lte",
  "has_tag",
  "assigned_to",
  "owned_by",
] as const;

export const conditionSchema = z.object({
  field: z.string().optional(),
  op: z.enum(CONDITION_OPS),
  value: z.string().optional(),
  values: z.array(z.string()).optional(),
  /** For has_tag / assigned_to / owned_by */
  id: z.number().int().positive().optional(),
});

export type AutomationCondition = z.infer<typeof conditionSchema>;

/** AND group of leaf conditions; groups are OR'd together. Legacy flat arrays = one AND group. */
export const conditionGroupSchema = z.object({
  conditions: z.array(conditionSchema).min(1),
});

export type AutomationConditionGroup = z.infer<typeof conditionGroupSchema>;

const recordTriggerBase = z.object({
  entity: entitySchema,
});

export const triggerSchema = z.discriminatedUnion("type", [
  recordTriggerBase.extend({
    type: z.literal("record_created"),
  }),
  recordTriggerBase.extend({
    type: z.literal("record_updated"),
    fields: z.array(z.string()).optional(),
  }),
  recordTriggerBase.extend({
    type: z.literal("record_deleted"),
  }),
  recordTriggerBase.extend({
    type: z.literal("field_changed"),
    field: z.string().min(1),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  z.object({
    type: z.literal("schedule"),
    cadence: z.enum(["hourly", "daily", "cron"]),
    hour: z.number().int().min(0).max(23).optional(),
    /** 5-field cron when cadence is cron: minute hour dom month dow */
    cron: z.string().trim().min(1).max(64).optional(),
    entity: entitySchema,
  }),
  z.object({
    type: z.literal("date_offset"),
    entity: entitySchema,
    field: z.string().min(1),
    offsetDays: z.number().int(),
  }),
]);

export type AutomationTrigger = z.infer<typeof triggerSchema>;

const patchFields = z.record(z.string(), z.string());

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("update_record"),
    fields: patchFields,
  }),
  z.object({
    type: z.literal("create_task"),
    title: z.string().min(1),
    kind: z.string().default("other"),
    status: z.string().default("todo"),
    dueOffsetDays: z.number().int().optional(),
    copyAssignees: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("create_contact"),
    name: z.string().min(1),
    email: z.string().optional(),
    role: z.string().optional(),
    linkToEventAs: z.string().optional(),
  }),
  z.object({
    type: z.literal("link_event_role"),
    contactId: z.number().int().positive().optional(),
    /** Resolve contact from triggering contact record when set. */
    useTriggerContact: z.boolean().optional(),
    role: z.string().min(1).default("contact"),
  }),
  z.object({
    type: z.literal("set_owners"),
    userIds: z.array(z.number().int().positive()).min(1),
    mode: z.enum(["add", "replace"]).default("add"),
  }),
  z.object({
    type: z.literal("apply_task_group"),
    taskGroupId: z.number().int().positive(),
    mode: z.enum(["block", "add_missing"]).default("add_missing"),
  }),
  z.object({
    type: z.literal("assign_users"),
    userIds: z.array(z.number().int().positive()).min(1),
    mode: z.enum(["add", "replace"]).default("add"),
  }),
  z
    .object({
      type: z.literal("add_tag"),
      tagId: z.number().int().positive().optional(),
      tagName: z.string().trim().min(1).max(30).optional(),
    })
    .refine((value) => Boolean(value.tagId) || Boolean(value.tagName), {
      message: "Pick a tag or enter a new tag name",
    }),
  z.object({
    type: z.literal("add_note"),
    body: z.string().min(1),
  }),
  z.object({
    type: z.literal("notify"),
    audience: z.enum(["specific", "assignees", "owners"]).default("assignees"),
    userIds: z.array(z.number().int().positive()).optional(),
    subject: z.string().min(1),
    body: z.string().min(1),
  }),
]);

export type AutomationAction = z.infer<typeof actionSchema>;

export const automationDefinitionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(10000).default(100),
  requireApproval: z.boolean().default(false),
  rateLimitPerHour: z.number().int().positive().nullable().optional(),
  timezone: z.string().trim().min(1).max(64).default("local"),
  entity: entitySchema.nullable().optional(),
  trigger: triggerSchema,
  /** Flat AND list (legacy) or OR-of-AND groups. */
  conditions: z
    .union([z.array(conditionSchema), z.array(conditionGroupSchema)])
    .default([]),
  actions: z.array(actionSchema).min(1),
});

export type AutomationDefinition = z.infer<typeof automationDefinitionSchema>;

export function parseTrigger(raw: unknown): AutomationTrigger {
  return triggerSchema.parse(raw);
}

/** Normalize legacy flat AND arrays into condition groups. */
export function normalizeConditionGroups(raw: unknown): AutomationConditionGroup[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const first = raw[0];
  if (first && typeof first === "object" && "conditions" in first) {
    return z.array(conditionGroupSchema).parse(raw);
  }
  const flat = z.array(conditionSchema).parse(raw);
  return flat.length ? [{ conditions: flat }] : [];
}

export function parseConditions(raw: unknown): AutomationCondition[] {
  // Back-compat for callers that expect a flat AND list.
  const groups = normalizeConditionGroups(raw);
  if (groups.length <= 1) return groups[0]?.conditions ?? [];
  // Multiple OR groups: flatten is wrong for evaluation — use normalizeConditionGroups.
  return groups.flatMap((g) => g.conditions);
}

export function parseActions(raw: unknown): AutomationAction[] {
  return z.array(actionSchema).min(1).parse(raw);
}

export function triggerEntity(
  trigger: AutomationTrigger,
): (typeof AUTOMATION_ENTITIES)[number] {
  return trigger.entity;
}

export const TRIGGER_TYPE_LABELS: Record<AutomationTrigger["type"], string> = {
  record_created: "Record created",
  record_updated: "Record updated",
  record_deleted: "Record deleted",
  field_changed: "Field changed",
  schedule: "On a schedule",
  date_offset: "Date offset",
};

export const ACTION_TYPE_LABELS: Record<AutomationAction["type"], string> = {
  update_record: "Update record",
  create_task: "Create task",
  create_contact: "Create contact",
  link_event_role: "Link contact to event",
  set_owners: "Set owners",
  apply_task_group: "Apply task group",
  assign_users: "Assign staff",
  add_tag: "Add tag",
  add_note: "Add note",
  notify: "Send notification",
};

export const CONDITION_OP_LABELS: Record<(typeof CONDITION_OPS)[number], string> = {
  eq: "equals",
  neq: "does not equal",
  in: "is one of",
  changed: "changed",
  changed_to: "changed to",
  changed_from: "changed from",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  gt: "greater than",
  gte: "greater or equal",
  lt: "less than",
  lte: "less or equal",
  has_tag: "has tag",
  assigned_to: "assigned to",
  owned_by: "owned by",
};

/** Summarize a stored trigger for list UIs. */
export function summarizeTrigger(raw: unknown): string {
  try {
    const trigger = parseTrigger(raw);
    const entity = triggerEntity(trigger);
    switch (trigger.type) {
      case "field_changed":
        return `${entity}.${trigger.field} changed${trigger.to ? ` to ${trigger.to}` : ""}`;
      case "record_created":
        return `${entity} created`;
      case "record_updated":
        return `${entity} updated`;
      case "record_deleted":
        return `${entity} deleted`;
      case "schedule":
        if (trigger.cadence === "cron") return `cron (${trigger.cron ?? "?"}) on ${entity}`;
        return `${trigger.cadence} on ${entity}`;
      case "date_offset": {
        const when =
          trigger.offsetDays === 0
            ? "on"
            : trigger.offsetDays < 0
              ? `${Math.abs(trigger.offsetDays)}d before`
              : `${trigger.offsetDays}d after`;
        return `${when} ${entity}.${trigger.field}`;
      }
      default:
        return "Trigger";
    }
  } catch {
    return "Invalid trigger";
  }
}
