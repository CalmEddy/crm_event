// Execute automation actions against a triggering record.
import { and, eq } from "drizzle-orm";
import {
  contacts,
  eventContacts,
  events,
  getDb,
  noteLinks,
  notes,
  organizations,
  recordOwners,
  tasks,
  type EntityType,
} from "@/db";
import {
  listEventAssigneeIds,
  listTaskAssigneeIds,
  replaceEventAssignees,
  replaceTaskAssignees,
  copyEventAssigneesToTasks,
} from "@/lib/assignees";
import {
  fieldByKey,
  parseCustomFieldId,
} from "@/lib/automations/fields";
import type { AutomationAction } from "@/lib/automations/rule-schema";
import {
  isDryRun,
  type ActionResult,
  type RecordMutation,
} from "@/lib/automations/context";
import { snapshotWithCustom } from "@/lib/automations/snapshot";
import { TASK_KINDS, TASK_STATUSES } from "@/lib/constants";
import {
  listCustomFields,
  writeCustomValues,
} from "@/lib/custom-fields";
import { entityHref } from "@/lib/entities";
import { dueOnFromEventDate } from "@/lib/offsets";
import { notifyUsers } from "@/lib/notifications/notify";
import { changeRecordTags, findOrCreateTag } from "@/lib/tags";
import { applyTaskGroupToEventCore } from "@/lib/task-groups-apply";
import { getCurrentUserId } from "@/lib/current-user";
import { isCustomKey } from "@/lib/views/fields";

const TABLES = {
  task: tasks,
  event: events,
  contact: contacts,
  organization: organizations,
} as const;

export function interpolate(
  template: string,
  mutation: RecordMutation,
): string {
  const row = mutation.after ?? mutation.before ?? {};
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => {
    const value = row[key];
    if (value == null) return "";
    if (value instanceof Date) return value.toISOString();
    return String(value);
  });
}

async function resolveEventId(mutation: RecordMutation): Promise<number | null> {
  if (mutation.entity === "event") return mutation.id;
  if (mutation.entity === "task") {
    const row = mutation.after ?? mutation.before;
    const eventId = row?.eventId;
    return typeof eventId === "number" ? eventId : null;
  }
  return null;
}

async function listOwnerIds(entity: EntityType, id: number): Promise<number[]> {
  const db = await getDb({ system: true });
  const rows = await db
    .select({ userId: recordOwners.userId })
    .from(recordOwners)
    .where(and(eq(recordOwners.entity, entity), eq(recordOwners.entityId, id)));
  return rows.map((r) => r.userId);
}

async function listAssigneeIds(entity: EntityType, id: number): Promise<number[]> {
  if (entity === "event") return listEventAssigneeIds(id);
  if (entity === "task") return listTaskAssigneeIds(id);
  return listOwnerIds(entity, id);
}

async function followUpUpdated(
  entity: EntityType,
  id: number,
  before: Record<string, unknown> | null,
): Promise<RecordMutation> {
  const after = await snapshotWithCustom(entity, id);
  return { entity, id, kind: "updated", before, after };
}

async function followUpCreated(
  entity: EntityType,
  id: number,
): Promise<RecordMutation> {
  const after = await snapshotWithCustom(entity, id);
  return { entity, id, kind: "created", before: null, after };
}

export async function executeAction(
  action: AutomationAction,
  mutation: RecordMutation,
): Promise<ActionResult> {
  switch (action.type) {
    case "update_record":
      return updateRecord(action.fields, mutation);
    case "create_task":
      return createTask(action, mutation);
    case "create_contact":
      return createContact(action, mutation);
    case "link_event_role":
      return linkEventRole(action, mutation);
    case "set_owners":
      return setOwners(action, mutation);
    case "apply_task_group":
      return applyTaskGroup(action, mutation);
    case "assign_users":
      return assignUsers(action, mutation);
    case "add_tag":
      return addTag(action, mutation);
    case "add_note":
      return addNote(action.body, mutation);
    case "notify":
      return sendNotify(action, mutation);
    default:
      return { detail: "Unknown action" };
  }
}

async function updateRecord(
  fields: Record<string, string>,
  mutation: RecordMutation,
): Promise<ActionResult> {
  if (mutation.kind === "deleted") throw new Error("Cannot update a deleted record");
  const planned = Object.entries(fields)
    .map(([k, v]) => `${k}=${interpolate(v, mutation)}`)
    .join(", ");
  if (isDryRun()) {
    return { detail: `[dry-run] Would update ${planned}` };
  }

  const before = await snapshotWithCustom(mutation.entity, mutation.id);
  const customDefs = await listCustomFields(mutation.entity);
  const patch: Record<string, unknown> = {};
  const custom = new Map<number, string | null>();
  const updated: string[] = [];

  for (const [key, raw] of Object.entries(fields)) {
    const value = interpolate(raw, mutation);
    if (isCustomKey(key)) {
      const fieldId = parseCustomFieldId(key);
      if (!fieldId) throw new Error(`Invalid custom field "${key}"`);
      const def = fieldByKey(mutation.entity, key, customDefs);
      if (!def?.writable) throw new Error(`Field "${key}" is not writable`);
      let stored: string | null = value === "" ? null : value;
      if (stored && def.type === "checkbox") {
        const v = stored.toLowerCase();
        stored = ["yes", "y", "true", "1"].includes(v)
          ? "yes"
          : ["no", "n", "false", "0"].includes(v)
            ? "no"
            : stored;
      }
      if (stored && def.type === "number") {
        const n = Number(stored.replace(/,/g, ""));
        if (!Number.isFinite(n)) throw new Error(`Invalid number for ${key}`);
        stored = String(n);
      }
      custom.set(fieldId, stored);
      updated.push(key);
      continue;
    }
    const def = fieldByKey(mutation.entity, key, customDefs);
    if (!def?.writable) throw new Error(`Field "${key}" is not writable`);
    if (def.type === "datetime") {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw new Error(`Invalid datetime for ${key}`);
      patch[def.column] = date;
    } else if (def.type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid date for ${key}`);
      patch[def.column] = value;
    } else if (def.type === "number") {
      const n = Number(value.replace(/,/g, ""));
      if (!Number.isFinite(n)) throw new Error(`Invalid number for ${key}`);
      patch[def.column] = String(n);
    } else {
      patch[def.column] = value === "" ? null : value;
    }
    updated.push(key);
  }

  if (Object.keys(patch).length > 0) {
    const db = await getDb({ system: true });
    const table = TABLES[mutation.entity];
    await db
      .update(table)
      .set({ ...patch, updatedAt: new Date() } as never)
      .where(eq(table.id, mutation.id));
  }
  if (custom.size > 0) {
    await writeCustomValues(mutation.entity, [mutation.id], custom);
  }
  if (updated.length === 0) return { detail: "No fields to update" };
  return {
    detail: `Updated ${updated.join(", ")}`,
    followUps: [await followUpUpdated(mutation.entity, mutation.id, before)],
  };
}

async function createTask(
  action: Extract<AutomationAction, { type: "create_task" }>,
  mutation: RecordMutation,
): Promise<ActionResult> {
  const title = interpolate(action.title, mutation);
  if (isDryRun()) {
    return { detail: `[dry-run] Would create task "${title}"` };
  }
  const eventId = await resolveEventId(mutation);
  const kind = TASK_KINDS.includes(action.kind as (typeof TASK_KINDS)[number])
    ? action.kind
    : "other";
  const status = TASK_STATUSES.includes(action.status as (typeof TASK_STATUSES)[number])
    ? action.status
    : "todo";

  let dueOn: string | null = null;
  if (action.dueOffsetDays != null) {
    if (eventId) {
      const db = await getDb({ system: true });
      const [event] = await db.select().from(events).where(eq(events.id, eventId));
      if (event) dueOn = dueOnFromEventDate(event.startsAt, action.dueOffsetDays);
    } else if (mutation.entity === "task") {
      const base = String((mutation.after ?? mutation.before)?.dueOn ?? "");
      if (/^\d{4}-\d{2}-\d{2}$/.test(base)) {
        const d = new Date(`${base}T12:00:00`);
        d.setDate(d.getDate() + action.dueOffsetDays);
        dueOn = d.toISOString().slice(0, 10);
      }
    }
  }
  if (!dueOn) dueOn = new Date().toISOString().slice(0, 10);

  const db = await getDb({ system: true });
  const [row] = await db
    .insert(tasks)
    .values({
      title,
      kind: kind as (typeof TASK_KINDS)[number],
      status: status as (typeof TASK_STATUSES)[number],
      dueOn,
      eventId,
      contactId:
        mutation.entity === "contact"
          ? mutation.id
          : typeof (mutation.after ?? mutation.before)?.contactId === "number"
            ? ((mutation.after ?? mutation.before)?.contactId as number)
            : null,
    })
    .returning();

  if (action.copyAssignees && eventId) {
    await copyEventAssigneesToTasks(eventId, [row.id]);
  }

  return {
    detail: `Created task #${row.id} "${title}"`,
    followUps: [await followUpCreated("task", row.id)],
  };
}

async function createContact(
  action: Extract<AutomationAction, { type: "create_contact" }>,
  mutation: RecordMutation,
): Promise<ActionResult> {
  const name = interpolate(action.name, mutation);
  const email = action.email ? interpolate(action.email, mutation) : null;
  const role = action.role ? interpolate(action.role, mutation) : null;
  if (isDryRun()) {
    return { detail: `[dry-run] Would create contact "${name}"` };
  }
  const db = await getDb({ system: true });
  const [row] = await db
    .insert(contacts)
    .values({ name, email: email || null, role: role || null })
    .returning();

  const followUps: RecordMutation[] = [await followUpCreated("contact", row.id)];
  if (action.linkToEventAs) {
    const eventId = await resolveEventId(mutation);
    if (eventId) {
      await db.insert(eventContacts).values({
        eventId,
        contactId: row.id,
        role: action.linkToEventAs,
      });
      const before = await snapshotWithCustom("event", eventId);
      followUps.push(await followUpUpdated("event", eventId, before));
    }
  }
  return { detail: `Created contact #${row.id} "${name}"`, followUps };
}

async function linkEventRole(
  action: Extract<AutomationAction, { type: "link_event_role" }>,
  mutation: RecordMutation,
): Promise<ActionResult> {
  const eventId = await resolveEventId(mutation);
  if (!eventId) throw new Error("Link event role requires an event context");
  const contactId = action.useTriggerContact
    ? mutation.entity === "contact"
      ? mutation.id
      : Number((mutation.after ?? mutation.before)?.contactId)
    : action.contactId;
  if (!contactId || !Number.isFinite(contactId)) {
    throw new Error("Contact id required");
  }
  if (isDryRun()) {
    return {
      detail: `[dry-run] Would link contact #${contactId} as ${action.role} on event #${eventId}`,
    };
  }
  const before = await snapshotWithCustom("event", eventId);
  const db = await getDb({ system: true });
  await db.insert(eventContacts).values({
    eventId,
    contactId,
    role: action.role,
  });
  return {
    detail: `Linked contact #${contactId} as ${action.role}`,
    followUps: [await followUpUpdated("event", eventId, before)],
  };
}

async function setOwners(
  action: Extract<AutomationAction, { type: "set_owners" }>,
  mutation: RecordMutation,
): Promise<ActionResult> {
  if (mutation.kind === "deleted") throw new Error("Cannot set owners on a deleted record");
  if (mutation.entity !== "contact" && mutation.entity !== "organization") {
    throw new Error("set_owners only applies to contacts and organizations");
  }
  if (isDryRun()) {
    return { detail: `[dry-run] Would set owners [${action.userIds.join(",")}]` };
  }
  const before = await snapshotWithCustom(mutation.entity, mutation.id);
  const db = await getDb({ system: true });
  if (action.mode === "replace") {
    await db
      .delete(recordOwners)
      .where(
        and(
          eq(recordOwners.entity, mutation.entity),
          eq(recordOwners.entityId, mutation.id),
        ),
      );
  }
  const existing = await listOwnerIds(mutation.entity, mutation.id);
  const existingSet = new Set(existing);
  const toAdd = action.userIds.filter((id) => !existingSet.has(id));
  if (toAdd.length > 0) {
    await db.insert(recordOwners).values(
      toAdd.map((userId) => ({
        entity: mutation.entity,
        entityId: mutation.id,
        userId,
      })),
    );
  }
  return {
    detail: `Set owners (${action.mode})`,
    followUps: [await followUpUpdated(mutation.entity, mutation.id, before)],
  };
}

async function applyTaskGroup(
  action: Extract<AutomationAction, { type: "apply_task_group" }>,
  mutation: RecordMutation,
): Promise<ActionResult> {
  const eventId = await resolveEventId(mutation);
  if (!eventId) throw new Error("Apply task group requires an event context");
  if (isDryRun()) {
    return {
      detail: `[dry-run] Would apply task group #${action.taskGroupId} (${action.mode})`,
    };
  }
  const result = await applyTaskGroupToEventCore(
    eventId,
    action.taskGroupId,
    action.mode,
  );
  const followUps: RecordMutation[] = [];
  for (const taskId of result.createdTaskIds) {
    followUps.push(await followUpCreated("task", taskId));
  }
  if (result.createdTaskIds.length === 0) {
    return {
      detail: result.alreadyApplied
        ? "Task group already applied (nothing new)"
        : "Task group applied (no templates)",
    };
  }
  return {
    detail: `Applied task group #${action.taskGroupId}; created ${result.createdTaskIds.length} task(s)`,
    followUps,
  };
}

async function assignUsers(
  action: Extract<AutomationAction, { type: "assign_users" }>,
  mutation: RecordMutation,
): Promise<ActionResult> {
  if (mutation.kind === "deleted") throw new Error("Cannot assign on a deleted record");
  if (isDryRun()) {
    return { detail: `[dry-run] Would assign users [${action.userIds.join(",")}]` };
  }
  const before = await snapshotWithCustom(mutation.entity, mutation.id);
  const ids = action.userIds;
  if (mutation.entity === "event") {
    const current = action.mode === "replace" ? [] : await listEventAssigneeIds(mutation.id);
    const next = action.mode === "replace" ? ids : [...new Set([...current, ...ids])];
    await replaceEventAssignees(mutation.id, next);
  } else if (mutation.entity === "task") {
    const current = action.mode === "replace" ? [] : await listTaskAssigneeIds(mutation.id);
    const next = action.mode === "replace" ? ids : [...new Set([...current, ...ids])];
    await replaceTaskAssignees(mutation.id, next);
  } else {
    return setOwners(
      { type: "set_owners", userIds: ids, mode: action.mode },
      mutation,
    );
  }
  return {
    detail: `Assigned staff (${action.mode})`,
    followUps: [await followUpUpdated(mutation.entity, mutation.id, before)],
  };
}

async function addTag(
  action: Extract<AutomationAction, { type: "add_tag" }>,
  mutation: RecordMutation,
): Promise<ActionResult> {
  let tagId = action.tagId;
  const tagName = action.tagName?.trim();
  if (isDryRun()) {
    return {
      detail: `[dry-run] Would add tag ${tagId ? `#${tagId}` : `"${tagName}"`}`,
    };
  }
  if ((!tagId || tagId <= 0) && tagName) {
    const tag = await findOrCreateTag(tagName);
    tagId = tag.id;
  }
  if (!tagId || tagId <= 0) throw new Error("Pick or create a tag");
  const before = await snapshotWithCustom(mutation.entity, mutation.id);
  await changeRecordTags(mutation.entity, [mutation.id], {
    add: [tagId],
    remove: [],
  });
  return {
    detail: `Added tag #${tagId}`,
    followUps: [await followUpUpdated(mutation.entity, mutation.id, before)],
  };
}

async function addNote(bodyTemplate: string, mutation: RecordMutation): Promise<ActionResult> {
  if (mutation.kind === "deleted") throw new Error("Cannot add a note to a deleted record");
  const body = interpolate(bodyTemplate, mutation);
  if (isDryRun()) {
    return { detail: `[dry-run] Would add note: ${body.slice(0, 80)}` };
  }
  const db = await getDb({ system: true });
  const [note] = await db.insert(notes).values({ body }).returning();
  await db.insert(noteLinks).values({
    noteId: note.id,
    entityType: mutation.entity,
    entityId: mutation.id,
  });
  return { detail: `Added note #${note.id}` };
}

async function sendNotify(
  action: Extract<AutomationAction, { type: "notify" }>,
  mutation: RecordMutation,
): Promise<ActionResult> {
  const subject = interpolate(action.subject, mutation);
  const body = interpolate(action.body, mutation);
  if (isDryRun()) {
    return { detail: `[dry-run] Would notify (${action.audience}): ${subject}` };
  }
  let userIds: number[] = [];
  if (action.audience === "specific") {
    userIds = action.userIds ?? [];
  } else if (action.audience === "owners") {
    userIds = await listOwnerIds(mutation.entity, mutation.id);
    if (userIds.length === 0) {
      userIds = await listAssigneeIds(mutation.entity, mutation.id);
    }
  } else {
    userIds = await listAssigneeIds(mutation.entity, mutation.id);
  }

  const actorUserId = await getCurrentUserId();
  const result = await notifyUsers({
    kind: "automation",
    entityType: mutation.entity,
    entityId: mutation.id,
    userIds,
    subject,
    body,
    url: entityHref(mutation.entity, mutation.id),
    dedupeKeyPrefix: `automation:${mutation.entity}:${mutation.id}:${Date.now()}`,
    actorUserId,
  });
  return { detail: `Notified ${result.sent} (skipped ${result.skipped})` };
}
