// Server-side helpers for inline edits, quick-add, and bulk actions from DataView.
// Not a "use server" module: these are called only from authenticated actions.
import { eq, inArray } from "drizzle-orm";
import {
  contacts,
  events,
  getDb,
  organizations,
  tasks,
  type EntityType,
} from "@/db";
import { listEventAssigneeIds, listTaskAssigneeIds } from "@/lib/assignees";
import {
  EVENT_STATUSES,
  ORGANIZATION_TYPES,
  TASK_KINDS,
  TASK_STATUSES,
} from "@/lib/constants";
import { getCurrentUserId } from "@/lib/current-user";
import { deletePolymorphicRefsForEntity } from "@/lib/entities";
import {
  eventChangedMessage,
  eventDeletedMessage,
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
    email: { column: "email", parse: optional },
    phone: { column: "phone", parse: optional },
    organization: { column: "organizationId", parse: ref },
  },
  organization: {
    name: { column: "name", parse: required("Name") },
    type: { column: "type", parse: oneOf(ORGANIZATION_TYPES) },
    city: { column: "city", parse: optional },
    address: { column: "address", parse: optional },
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
  await db
    .update(table)
    .set({ ...patch, updatedAt: new Date() } as never)
    .where(inArray(table.id, ids));
  for (const id of ids) await notifyRecordChange(entity, id, "updated");
}

export async function insertRecord(entity: EntityType, values: Record<string, unknown>) {
  const db = await getDb();
  const table = TABLES[entity];
  const rows = (await db.insert(table).values(values as never).returning()) as { id: number }[];
  return rows[0].id;
}

export async function deleteRecords(entity: EntityType, ids: number[]) {
  const db = await getDb();
  const table = TABLES[entity];
  for (const id of ids) {
    // Notify before the row (and its assignee links) disappear.
    await notifyRecordChange(entity, id, "deleted");
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
