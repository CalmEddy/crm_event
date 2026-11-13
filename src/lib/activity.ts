// Activity log: record who changed what, with a readable field-level diff.
// Not a "use server" module; called from authenticated actions only.
import { and, desc, eq, inArray } from "drizzle-orm";
import { format } from "date-fns";
import {
  activityLog,
  contacts,
  events,
  getDb,
  organizations,
  tasks,
  users,
  type EntityType,
} from "@/db";
import { getCurrentUserId } from "@/lib/current-user";
import { VIEW_CONFIGS } from "@/lib/views/fields";

const TABLES = { task: tasks, event: events, contact: contacts, organization: organizations };
const TITLE: Record<EntityType, "title" | "name"> = {
  task: "title",
  event: "title",
  contact: "name",
  organization: "name",
};
const REF_COLUMNS: Record<string, EntityType> = {
  eventId: "event",
  contactId: "contact",
  organizationId: "organization",
};
const IGNORED = new Set(["id", "createdAt", "updatedAt"]);
const COLUMN_LABELS: Record<string, string> = {
  eventId: "Event",
  contactId: "Contact",
  organizationId: "Organization",
  dueOn: "Due",
  startsAt: "Starts",
  endsAt: "Ends",
};

type Snapshot = Record<string, unknown> | null;

export async function snapshot(entity: EntityType, id: number): Promise<Snapshot> {
  const db = await getDb();
  const table = TABLES[entity];
  const [row] = await db.select().from(table).where(eq(table.id, id)).limit(1);
  return (row as Record<string, unknown> | undefined) ?? null;
}

function fieldLabel(entity: EntityType, column: string) {
  if (COLUMN_LABELS[column]) return COLUMN_LABELS[column];
  const field = VIEW_CONFIGS[entity].fields.find((f) => f.key === column);
  if (field) return field.label;
  const words = column.replace(/([A-Z])/g, " $1").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

async function refLabel(entity: EntityType, id: number) {
  const row = await snapshot(entity, id);
  return row ? String(row[TITLE[entity]] ?? `#${id}`) : `#${id}`;
}

async function show(column: string, value: unknown): Promise<string> {
  if (value == null || value === "") return "—";
  if (value instanceof Date) return format(value, "MMM d, yyyy h:mm a");
  if (REF_COLUMNS[column] && typeof value === "number") return refLabel(REF_COLUMNS[column], value);
  const text = String(value).replace(/\s+/g, " ");
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

function same(a: unknown, b: unknown) {
  if (a instanceof Date || b instanceof Date) {
    return new Date(a as Date).getTime() === new Date(b as Date).getTime();
  }
  return (a ?? null) === (b ?? null);
}

export async function logActivity(
  entries: { entity: EntityType; entityId: number; action: string; label: string; detail?: string }[],
) {
  if (entries.length === 0) return;
  const userId = await getCurrentUserId();
  const db = await getDb();
  await db.insert(activityLog).values(entries.map((e) => ({ ...e, detail: e.detail ?? "", userId })));
}

export function titleOf(entity: EntityType, row: Snapshot) {
  return row ? String(row[TITLE[entity]] ?? "") : "";
}

export async function logCreated(entity: EntityType, id: number) {
  await logActivity([{ entity, entityId: id, action: "created", label: titleOf(entity, await snapshot(entity, id)) }]);
}

export async function logDeleted(entity: EntityType, id: number, before: Snapshot) {
  await logActivity([{ entity, entityId: id, action: "deleted", label: titleOf(entity, before) }]);
}

/** Re-read the record and log the fields that differ from `before`. */
export async function logUpdated(entity: EntityType, id: number, before: Snapshot) {
  const after = await snapshot(entity, id);
  if (!before || !after) return;
  const changes: string[] = [];
  for (const column of Object.keys(after)) {
    if (IGNORED.has(column) || same(before[column], after[column])) continue;
    const label = fieldLabel(entity, column);
    if (column === "notes" || column === "description") {
      changes.push(`${label} edited`);
    } else {
      changes.push(`${label}: ${await show(column, before[column])} → ${await show(column, after[column])}`);
    }
  }
  if (changes.length === 0) return;
  await logActivity([
    { entity, entityId: id, action: "updated", label: titleOf(entity, after), detail: changes.join("; ") },
  ]);
}

export type ActivityItem = {
  id: number;
  entity: EntityType;
  entityId: number;
  action: string;
  label: string;
  detail: string;
  userName: string | null;
  createdAt: Date;
};

export async function listActivity(
  filter: { entity: EntityType; entityId: number } | null,
  limit = 30,
): Promise<ActivityItem[]> {
  const db = await getDb();
  const query = db
    .select({
      id: activityLog.id,
      entity: activityLog.entity,
      entityId: activityLog.entityId,
      action: activityLog.action,
      label: activityLog.label,
      detail: activityLog.detail,
      userName: users.name,
      createdAt: activityLog.createdAt,
    })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.userId));
  const rows = await (filter
    ? query.where(and(eq(activityLog.entity, filter.entity), eq(activityLog.entityId, filter.entityId)))
    : query
  )
    .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
    .limit(limit);
  return rows;
}

async function userNames(ids: number[]) {
  if (ids.length === 0) return "";
  const db = await getDb();
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids));
  return rows.map((row) => row.name).join(", ");
}

/** Log people added to / removed from a task or event. */
export async function logAssignees(
  entity: "task" | "event",
  id: number,
  added: number[],
  removed: number[] = [],
) {
  if (added.length === 0 && removed.length === 0) return;
  const label = titleOf(entity, await snapshot(entity, id));
  const entries = [];
  if (added.length) entries.push({ entity, entityId: id, action: "assigned", label, detail: await userNames(added) });
  if (removed.length) entries.push({ entity, entityId: id, action: "unassigned", label, detail: await userNames(removed) });
  await logActivity(entries);
}
