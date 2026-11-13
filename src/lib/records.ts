// Server-side helpers for inline edits, quick-add, and bulk actions from DataView.
// Not a "use server" module: these are called only from authenticated actions.
import { and, eq, inArray, notInArray } from "drizzle-orm";
import {
  contacts,
  eventAssignees,
  events,
  getDb,
  organizations,
  recordOwners,
  taskAssignees,
  tasks,
  users,
  type EntityType,
} from "@/db";
import { listEventAssigneeIds, listTaskAssigneeIds } from "@/lib/assignees";
import {
  EVENT_STATUSES,
  ORGANIZATION_TYPES,
  TASK_KINDS,
  TASK_STATUSES,
} from "@/lib/constants";
import { logAssignees, logCreated, logDeleted, logUpdated, snapshot } from "@/lib/activity";
import { EMAIL_RE, normalizeWebsite } from "@/lib/contact-info";
import { getCurrentUserId } from "@/lib/current-user";
import { deletePolymorphicRefsForEntity } from "@/lib/entities";
import {
  eventAssignedMessage,
  eventChangedMessage,
  eventDeletedMessage,
  taskAssignedMessage,
  taskChangedMessage,
  taskDeletedMessage,
} from "@/lib/notifications/messages";
import { notifyUsers } from "@/lib/notifications/notify";

export class FieldError extends Error {}

type Parser = (raw: string | null) => unknown;

const required = (label: string): Parser => (raw) => {
  const value = (raw ?? "").trim();
  if (!value) throw new FieldError(`${label} is required`);
  return value;
};
const optional: Parser = (raw) => (raw ?? "").trim() || null;
const oneOf = (values: readonly string[]): Parser => (raw) => {
  if (!raw || !values.includes(raw)) throw new FieldError("Invalid value");
  return raw;
};
const dateOnly: Parser = (raw) => {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new FieldError("Enter a valid date");
  return raw;
};
const instant: Parser = (raw) => {
  const date = raw ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) throw new FieldError("Enter a valid date and time");
  return date;
};
const ref: Parser = (raw) => {
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new FieldError("Invalid selection");
  return id;
};

const email: Parser = (raw) => {
  const value = optional(raw) as string | null;
  if (value && !EMAIL_RE.test(value)) throw new FieldError("Enter a valid email address");
  return value;
};
const website: Parser = (raw) => {
  try {
    return normalizeWebsite(optional(raw) as string | null);
  } catch {
    throw new FieldError("Enter a valid website");
  }
};

/** Field key (as in VIEW_CONFIGS) -> DB column property + parser. */
export const WRITABLE: Record<EntityType, Record<string, { column: string; parse: Parser }>> = {
  task: {
    title: { column: "title", parse: required("Title") },
    dueOn: { column: "dueOn", parse: dateOnly },
    status: { column: "status", parse: oneOf(TASK_STATUSES) },
    kind: { column: "kind", parse: oneOf(TASK_KINDS) },
    event: { column: "eventId", parse: ref },
    contact: { column: "contactId", parse: ref },
  },
  event: {
    title: { column: "title", parse: required("Title") },
    startsAt: { column: "startsAt", parse: instant },
    venue: { column: "venue", parse: optional },
    location: { column: "location", parse: optional },
    status: { column: "status", parse: oneOf(EVENT_STATUSES) },
  },
  contact: {
    name: { column: "name", parse: required("Name") },
    role: { column: "role", parse: optional },
    email: { column: "email", parse: email },
    phone: { column: "phone", parse: optional },
    mobile: { column: "mobile", parse: optional },
    website: { column: "website", parse: website },
    address: { column: "address", parse: optional },
    city: { column: "city", parse: optional },
    region: { column: "region", parse: optional },
    postalCode: { column: "postalCode", parse: optional },
    country: { column: "country", parse: optional },
    organization: { column: "organizationId", parse: ref },
  },
  organization: {
    name: { column: "name", parse: required("Name") },
    type: { column: "type", parse: oneOf(ORGANIZATION_TYPES) },
    city: { column: "city", parse: optional },
    address: { column: "address", parse: optional },
    email: { column: "email", parse: email },
    phone: { column: "phone", parse: optional },
    website: { column: "website", parse: website },
    region: { column: "region", parse: optional },
    postalCode: { column: "postalCode", parse: optional },
    country: { column: "country", parse: optional },
  },
};

export function parsePatch(entity: EntityType, input: Record<string, string | null>) {
  const patch: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    const spec = WRITABLE[entity][key];
    if (!spec) throw new FieldError(`"${key}" can't be edited here`);
    patch[spec.column] = spec.parse(raw);
  }
  return patch;
}

const TABLES = { task: tasks, event: events, contact: contacts, organization: organizations };

export async function updateRecords(
  entity: EntityType,
  ids: number[],
  patch: Record<string, unknown>,
) {
  if (ids.length === 0) return;
  const db = await getDb();
  const table = TABLES[entity];
  const before = new Map<number, Awaited<ReturnType<typeof snapshot>>>();
  for (const id of ids) before.set(id, await snapshot(entity, id));
  await db
    .update(table)
    .set({ ...patch, updatedAt: new Date() } as never)
    .where(inArray(table.id, ids));
  for (const id of ids) {
    await logUpdated(entity, id, before.get(id) ?? null);
    await notifyRecordChange(entity, id, "updated");
  }
}

export async function insertRecord(entity: EntityType, values: Record<string, unknown>) {
  const db = await getDb();
  const table = TABLES[entity];
  const rows = (await db.insert(table).values(values as never).returning()) as { id: number }[];
  await logCreated(entity, rows[0].id);
  return rows[0].id;
}

export async function deleteRecords(entity: EntityType, ids: number[]) {
  const db = await getDb();
  const table = TABLES[entity];
  for (const id of ids) {
    // Notify before the row (and its assignee links) disappear.
    await notifyRecordChange(entity, id, "deleted");
    await logDeleted(entity, id, await snapshot(entity, id));
    await deletePolymorphicRefsForEntity({ type: entity, id });
    await db.delete(table).where(eq(table.id, id));
  }
}

/** Same emails the full edit forms send, so inline edits don't go silent. */
async function notifyRecordChange(
  entity: EntityType,
  id: number,
  action: "updated" | "deleted",
) {
  if (entity !== "task" && entity !== "event") return;
  const db = await getDb();
  const actorUserId = await getCurrentUserId();
  const stamp = Date.now();

  if (entity === "task") {
    const [row] = await db
      .select({ task: tasks, eventTitle: events.title })
      .from(tasks)
      .leftJoin(events, eq(tasks.eventId, events.id))
      .where(eq(tasks.id, id));
    if (!row) return;
    const userIds = await listTaskAssigneeIds(id);
    const summary = { ...row.task, eventTitle: row.eventTitle };
    const message =
      action === "deleted" ? taskDeletedMessage(summary) : taskChangedMessage(summary, action);
    await notifyUsers({
      kind: "record_change",
      entityType: "task",
      entityId: id,
      userIds,
      subject: message.subject,
      body: message.body,
      dedupeKeyPrefix: `record_change:task:${id}:${action}:${stamp}`,
      actorUserId,
    });
    return;
  }

  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event) return;
  const userIds = await listEventAssigneeIds(id);
  const message =
    action === "deleted" ? eventDeletedMessage(event) : eventChangedMessage(event, action);
  await notifyUsers({
    kind: "record_change",
    entityType: "event",
    entityId: id,
    userIds,
    subject: message.subject,
    body: message.body,
    dedupeKeyPrefix: `record_change:event:${id}:${action}:${stamp}`,
    actorUserId,
  });
}

export type AssigneeChange = {
  add: number[];
  remove: number[];
  /** Events only: apply the same change to the event's open tasks. */
  cascadeToTasks?: boolean;
};

/**
 * Add/remove assignees on tasks or events without replacing the whole list.
 * Newly added users get the same "assigned" email the edit forms send.
 * Returns how many open tasks were also updated when cascading from events.
 */
export async function changeAssignees(
  entity: EntityType,
  ids: number[],
  change: AssigneeChange,
): Promise<{ cascaded: number }> {
  const db = await getDb();
  const activeIds = new Set(
    (await db.select({ id: users.id }).from(users).where(eq(users.active, true))).map(
      (row) => row.id,
    ),
  );
  const add = [...new Set(change.add)].filter((id) => activeIds.has(id));
  const remove = [...new Set(change.remove)];
  if (ids.length === 0 || (add.length === 0 && remove.length === 0)) {
    return { cascaded: 0 };
  }

  if (entity === "contact" || entity === "organization") {
    // Owners: no emails, just the link and an activity entry.
    for (const id of ids) {
      const before = new Set(
        (
          await db
            .select({ userId: recordOwners.userId })
            .from(recordOwners)
            .where(and(eq(recordOwners.entity, entity), eq(recordOwners.entityId, id)))
        ).map((row) => row.userId),
      );
      const added = add.filter((userId) => !before.has(userId));
      const removed = remove.filter((userId) => before.has(userId));
      await logAssignees(entity, id, added, removed);
      if (removed.length) {
        await db
          .delete(recordOwners)
          .where(
            and(
              eq(recordOwners.entity, entity),
              eq(recordOwners.entityId, id),
              inArray(recordOwners.userId, removed),
            ),
          );
      }
      if (added.length) {
        await db
          .insert(recordOwners)
          .values(added.map((userId) => ({ entity, entityId: id, userId })))
          .onConflictDoNothing();
      }
    }
    return { cascaded: 0 };
  }

  let taskIds = entity === "task" ? ids : [];
  let cascaded = 0;
  if (entity === "event") {
    for (const eventId of ids) {
      const before = new Set(await listEventAssigneeIds(eventId));
      await logAssignees("event", eventId, add.filter((id) => !before.has(id)), remove.filter((id) => before.has(id)));
      if (remove.length) {
        await db
          .delete(eventAssignees)
          .where(and(eq(eventAssignees.eventId, eventId), inArray(eventAssignees.userId, remove)));
      }
      const added = add.filter((id) => !before.has(id));
      if (added.length) {
        await db
          .insert(eventAssignees)
          .values(added.map((userId) => ({ eventId, userId })))
          .onConflictDoNothing();
        await notifyAssigned("event", eventId, added);
      }
    }
    if (change.cascadeToTasks) {
      taskIds = (
        await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(inArray(tasks.eventId, ids), notInArray(tasks.status, ["done", "skipped"])))
      ).map((row) => row.id);
      cascaded = taskIds.length;
    }
  }

  for (const taskId of taskIds) {
    const before = new Set(await listTaskAssigneeIds(taskId));
    await logAssignees("task", taskId, add.filter((id) => !before.has(id)), remove.filter((id) => before.has(id)));
    if (remove.length) {
      await db
        .delete(taskAssignees)
        .where(and(eq(taskAssignees.taskId, taskId), inArray(taskAssignees.userId, remove)));
    }
    const added = add.filter((id) => !before.has(id));
    if (added.length) {
      await db
        .insert(taskAssignees)
        .values(added.map((userId) => ({ taskId, userId })))
        .onConflictDoNothing();
      await notifyAssigned("task", taskId, added);
    }
  }
  return { cascaded };
}

async function notifyAssigned(entity: "task" | "event", id: number, userIds: number[]) {
  const db = await getDb();
  const actorUserId = await getCurrentUserId();
  const stamp = Date.now();
  let message: { subject: string; body: string } | null = null;
  if (entity === "task") {
    const [row] = await db
      .select({ task: tasks, eventTitle: events.title })
      .from(tasks)
      .leftJoin(events, eq(tasks.eventId, events.id))
      .where(eq(tasks.id, id));
    if (row) message = taskAssignedMessage({ ...row.task, eventTitle: row.eventTitle });
  } else {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    if (event) message = eventAssignedMessage(event);
  }
  if (!message) return;
  await notifyUsers({
    kind: "assignment",
    entityType: entity,
    entityId: id,
    userIds,
    subject: message.subject,
    body: message.body,
    dedupeKeyPrefix: `assignment:${entity}:${id}:${stamp}`,
    actorUserId,
  });
}
