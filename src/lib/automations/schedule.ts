// Cron evaluation for schedule and date_offset triggers.
import { and, eq, gte, lt } from "drizzle-orm";
import {
  automations,
  automationFireLog,
  automationRuns,
  contacts,
  customValues,
  events,
  getDb,
  organizations,
  tasks,
  type Automation,
  type EntityType,
} from "@/db";
import {
  evaluateConditionGroups,
} from "@/lib/automations/conditions";
import {
  canEnterAutomation,
  runInAutomationContext,
  type RecordMutation,
} from "@/lib/automations/context";
import { cronMatches, wallClockInTimezone } from "@/lib/automations/cron";
import { executeAction } from "@/lib/automations/execute";
import { fieldByKey, parseCustomFieldId } from "@/lib/automations/fields";
import {
  normalizeConditionGroups,
  parseActions,
  parseTrigger,
  type AutomationTrigger,
} from "@/lib/automations/rule-schema";
import { dispatchRecordMutation } from "@/lib/automations/runner";
import { listCustomFields, loadCustomValues } from "@/lib/custom-fields";
import { isCustomKey } from "@/lib/views/fields";

const TABLES = {
  task: tasks,
  event: events,
  contact: contacts,
  organization: organizations,
} as const;

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function alreadyFired(automationId: number, fireKey: string) {
  const db = await getDb({ system: true });
  const [row] = await db
    .select()
    .from(automationFireLog)
    .where(
      and(
        eq(automationFireLog.automationId, automationId),
        eq(automationFireLog.fireKey, fireKey),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function markFired(automationId: number, fireKey: string) {
  const db = await getDb({ system: true });
  try {
    await db.insert(automationFireLog).values({ automationId, fireKey });
  } catch {
    // Unique conflict
  }
}

async function runActions(
  automation: Automation,
  mutation: RecordMutation,
  fireKey: string,
) {
  if (!canEnterAutomation(automation.id)) return { status: "skipped" as const };
  if (await alreadyFired(automation.id, fireKey)) {
    return { status: "skipped" as const };
  }

  let actions;
  try {
    actions = parseActions(automation.actions);
  } catch (err) {
    return {
      status: "error" as const,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const db = await getDb({ system: true });
  const [run] = await db
    .insert(automationRuns)
    .values({
      automationId: automation.id,
      status: "running",
      triggerEntity: mutation.entity,
      triggerRecordId: mutation.id,
    })
    .returning();

  await markFired(automation.id, fireKey);

  return runInAutomationContext(automation.id, async () => {
    const details: string[] = [];
    const followUps: RecordMutation[] = [];
    try {
      for (const action of actions) {
        const result = await executeAction(action, mutation);
        details.push(result.detail);
        if (result.followUps) followUps.push(...result.followUps);
      }
      await db
        .update(automationRuns)
        .set({
          status: "ok",
          detail: details.join("; "),
          finishedAt: new Date(),
        })
        .where(eq(automationRuns.id, run.id));
      for (const follow of followUps) {
        await dispatchRecordMutation(follow);
      }
      return { status: "ok" as const };
    } catch (err) {
      await db
        .update(automationRuns)
        .set({
          status: "error",
          detail: details.join("; "),
          error: err instanceof Error ? err.message : String(err),
          finishedAt: new Date(),
        })
        .where(eq(automationRuns.id, run.id));
      return { status: "error" as const };
    }
  });
}

async function loadRows(entity: EntityType): Promise<Record<string, unknown>[]> {
  const db = await getDb({ system: true });
  const table = TABLES[entity];
  const rows = await db.select().from(table);
  return rows as unknown as Record<string, unknown>[];
}

function scheduleDue(
  trigger: Extract<AutomationTrigger, { type: "schedule" }>,
  wall: Date,
) {
  if (trigger.cadence === "hourly") return true;
  if (trigger.cadence === "cron") {
    return trigger.cron ? cronMatches(trigger.cron, wall) : false;
  }
  const hour = trigger.hour ?? 9;
  return wall.getHours() === hour;
}

async function processSchedule(
  automation: Automation,
  trigger: Extract<AutomationTrigger, { type: "schedule" }>,
  now: Date,
) {
  const wall = wallClockInTimezone(now, automation.timezone ?? "local");
  if (!scheduleDue(trigger, wall)) return { matched: 0, ran: 0 };
  const fireBucket =
    trigger.cadence === "hourly"
      ? `${ymd(wall)}T${String(wall.getHours()).padStart(2, "0")}`
      : trigger.cadence === "cron"
        ? `${ymd(wall)}T${String(wall.getHours()).padStart(2, "0")}${String(wall.getMinutes()).padStart(2, "0")}`
        : ymd(wall);

  const groups = normalizeConditionGroups(automation.conditions);
  const rows = await loadRows(trigger.entity);
  let matched = 0;
  let ran = 0;

  for (const row of rows) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    if (!(await evaluateConditionGroups(trigger.entity, groups, null, row, id))) {
      continue;
    }
    matched += 1;
    const fireKey = `schedule:${fireBucket}:record:${id}`;
    const result = await runActions(
      automation,
      {
        entity: trigger.entity,
        id,
        kind: "updated",
        before: row,
        after: row,
      },
      fireKey,
    );
    if (result.status === "ok") ran += 1;
  }
  return { matched, ran };
}

async function processDateOffset(
  automation: Automation,
  trigger: Extract<AutomationTrigger, { type: "date_offset" }>,
  now: Date,
) {
  const customDefs = await listCustomFields(trigger.entity);
  const def = fieldByKey(trigger.entity, trigger.field, customDefs);
  if (!def) return { matched: 0, ran: 0 };

  const wall = wallClockInTimezone(now, automation.timezone ?? "local");
  const targetDay = addDays(startOfLocalDay(wall), -trigger.offsetDays);
  const targetYmd = ymd(targetDay);
  const nextYmd = ymd(addDays(targetDay, 1));
  const groups = normalizeConditionGroups(automation.conditions);

  const db = await getDb({ system: true });
  let rows: Record<string, unknown>[] = [];

  if (isCustomKey(trigger.field)) {
    const fieldId = parseCustomFieldId(trigger.field);
    if (!fieldId || def.type !== "date") return { matched: 0, ran: 0 };
    const valueRows = await db
      .select({ entityId: customValues.entityId, value: customValues.value })
      .from(customValues)
      .where(
        and(
          eq(customValues.fieldId, fieldId),
          eq(customValues.entity, trigger.entity),
          eq(customValues.value, targetYmd),
        ),
      );
    const table = TABLES[trigger.entity];
    for (const hit of valueRows) {
      const [row] = await db.select().from(table).where(eq(table.id, hit.entityId));
      if (!row) continue;
      const cf = (await loadCustomValues(trigger.entity, [hit.entityId])).get(hit.entityId) ?? {};
      rows.push({ ...(row as Record<string, unknown>), ...cf });
    }
  } else {
    const table = TABLES[trigger.entity];
    const column = (table as unknown as Record<string, unknown>)[def.column];
    if (!column) return { matched: 0, ran: 0 };

    if (def.type === "date") {
      rows = (await db
        .select()
        .from(table)
        .where(eq(column as never, targetYmd))) as unknown as Record<string, unknown>[];
    } else {
      const start = new Date(`${targetYmd}T00:00:00`);
      const end = new Date(`${nextYmd}T00:00:00`);
      rows = (await db
        .select()
        .from(table)
        .where(and(gte(column as never, start), lt(column as never, end)))) as unknown as Record<
        string,
        unknown
      >[];
    }
  }

  let matched = 0;
  let ran = 0;
  for (const row of rows) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    if (!(await evaluateConditionGroups(trigger.entity, groups, null, row, id))) {
      continue;
    }
    matched += 1;
    const fireKey = `date_offset:${targetYmd}:record:${id}`;
    const result = await runActions(
      automation,
      {
        entity: trigger.entity,
        id,
        kind: "updated",
        before: row,
        after: row,
      },
      fireKey,
    );
    if (result.status === "ok") ran += 1;
  }
  return { matched, ran };
}

export async function runScheduledAutomations(now = new Date()) {
  const db = await getDb({ system: true });
  const list = await db
    .select()
    .from(automations)
    .where(eq(automations.enabled, true))
    .orderBy(automations.priority, automations.id);

  let schedules = 0;
  let dateOffsets = 0;
  let ran = 0;
  let errors = 0;

  for (const automation of list) {
    let trigger: AutomationTrigger;
    try {
      trigger = parseTrigger(automation.trigger);
    } catch {
      errors += 1;
      continue;
    }

    try {
      if (trigger.type === "schedule") {
        schedules += 1;
        const result = await processSchedule(automation, trigger, now);
        ran += result.ran;
      } else if (trigger.type === "date_offset") {
        dateOffsets += 1;
        const result = await processDateOffset(automation, trigger, now);
        ran += result.ran;
      }
    } catch (err) {
      console.error(`[automations] schedule failed for ${automation.id}:`, err);
      errors += 1;
    }
  }

  return { schedules, dateOffsets, ran, errors };
}
