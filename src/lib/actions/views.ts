"use server";

import { and, asc, eq, ilike } from "drizzle-orm";
import { refresh, revalidatePath } from "next/cache";
import { formatISO } from "date-fns";
import { z } from "zod";
import {
  contacts,
  events,
  getDb,
  organizations,
  savedViews,
  tasks,
  type EntityType,
} from "@/db";
import { requireSignedIn } from "@/lib/auth";
import { getCurrentUserId } from "@/lib/current-user";
import { entityHref, isEntityType, revalidateEntityPaths } from "@/lib/entities";
import {
  FieldError,
  changeAssignees,
  deleteRecords,
  insertRecord,
  parsePatch,
  updateRecords,
} from "@/lib/records";
import { VIEW_CONFIGS, isEditableField } from "@/lib/views/fields";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_BULK = 200;

function cleanIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(
    0,
    MAX_BULK,
  );
}

function isConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && code.startsWith("23")) return true;
  return isConstraintError((error as { cause?: unknown }).cause);
}

function fail(error: unknown): ActionResult {
  if (error instanceof FieldError) return { ok: false, error: error.message };
  if (isConstraintError(error)) {
    return { ok: false, error: "That change conflicts with existing data." };
  }
  throw error;
}

function done(entity: EntityType, ids: number[]): ActionResult {
  revalidateEntityPaths(ids.map((id) => ({ type: entity, id })));
  refresh();
  return { ok: true };
}

/** Update one or more fields on one or more records (inline edit, drawer, bulk). */
export async function updateRecordsAction(
  entity: string,
  ids: number[],
  input: Record<string, string | null>,
): Promise<ActionResult> {
  await requireSignedIn();
  if (!isEntityType(entity)) return { ok: false, error: "Unknown record type." };
  const cleaned = cleanIds(ids);
  if (cleaned.length === 0) return { ok: false, error: "Nothing selected." };
  if (Object.keys(input).some((key) => !isEditableField(entity, key))) {
    return { ok: false, error: "That field can't be edited here." };
  }
  try {
    await updateRecords(entity, cleaned, parsePatch(entity, input));
  } catch (error) {
    return fail(error);
  }
  return done(entity, cleaned);
}

/** Kept for board drag: single enum field on one record. */
export async function updateField(
  entity: string,
  id: number,
  key: string,
  value: string,
): Promise<ActionResult> {
  return updateRecordsAction(entity, [id], { [key]: value });
}

/**
 * Create a record from the quick-add row. `defaults` come from the current
 * filter (e.g. status or event) and go through the same parsers as edits.
 */
export async function quickCreate(
  entity: string,
  title: string,
  defaults: Record<string, string>,
): Promise<ActionResult & { id?: number }> {
  await requireSignedIn();
  if (!isEntityType(entity)) return { ok: false, error: "Unknown record type." };
  const config = VIEW_CONFIGS[entity];
  const base: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(defaults)) {
    if (isEditableField(entity, key) && key !== config.titleKey) base[key] = value;
  }
  base[config.titleKey] = title;
  if (entity === "task" && !base.dueOn) {
    base.dueOn = formatISO(new Date(), { representation: "date" });
  }
  if (entity === "event" && !base.startsAt) {
    const start = new Date();
    start.setDate(start.getDate() + 7);
    start.setHours(20, 0, 0, 0);
    base.startsAt = start.toISOString();
  }
  try {
    const id = await insertRecord(entity, parsePatch(entity, base));
    revalidateEntityPaths([{ type: entity, id }]);
    refresh();
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteRecordsAction(
  entity: string,
  ids: number[],
): Promise<ActionResult> {
  await requireSignedIn();
  if (!isEntityType(entity)) return { ok: false, error: "Unknown record type." };
  const cleaned = cleanIds(ids);
  if (cleaned.length === 0) return { ok: false, error: "Nothing selected." };
  await deleteRecords(entity, cleaned);
  return done(entity, cleaned);
}

/** Add/remove assignees on tasks or events (row picker, bulk bar, workload board). */
export async function changeAssigneesAction(
  entity: string,
  ids: number[],
  change: { add: number[]; remove: number[]; cascadeToTasks?: boolean },
): Promise<ActionResult & { cascaded?: number }> {
  await requireSignedIn();
  if (entity !== "task" && entity !== "event") {
    return { ok: false, error: "Only tasks and events have assignees." };
  }
  const cleaned = cleanIds(ids);
  if (cleaned.length === 0) return { ok: false, error: "Nothing selected." };
  const { cascaded } = await changeAssignees(entity, cleaned, {
    add: cleanIds(change.add),
    remove: cleanIds(change.remove),
    cascadeToTasks: entity === "event" && Boolean(change.cascadeToTasks),
  });
  revalidateEntityPaths(cleaned.map((id) => ({ type: entity, id })));
  if (cascaded) revalidatePath("/tasks");
  refresh();
  return { ok: true, cascaded };
}

export type SearchHit = { type: EntityType; id: number; label: string; href: string };

/** Command palette search across the four record types. */
export async function searchRecords(query: string): Promise<SearchHit[]> {
  await requireSignedIn();
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const db = await getDb();
  const [eventRows, taskRows, contactRows, orgRows] = await Promise.all([
    db.select({ id: events.id, label: events.title }).from(events).where(ilike(events.title, pattern)).orderBy(asc(events.startsAt)).limit(6),
    db.select({ id: tasks.id, label: tasks.title }).from(tasks).where(ilike(tasks.title, pattern)).orderBy(asc(tasks.dueOn)).limit(6),
    db.select({ id: contacts.id, label: contacts.name }).from(contacts).where(ilike(contacts.name, pattern)).orderBy(asc(contacts.name)).limit(6),
    db.select({ id: organizations.id, label: organizations.name }).from(organizations).where(ilike(organizations.name, pattern)).orderBy(asc(organizations.name)).limit(6),
  ]);
  const tag = (type: EntityType) => (row: { id: number; label: string }) => ({
    type,
    id: row.id,
    label: row.label,
    href: entityHref(type, row.id),
  });
  return [
    ...eventRows.map(tag("event")),
    ...taskRows.map(tag("task")),
    ...contactRows.map(tag("contact")),
    ...orgRows.map(tag("organization")),
  ];
}

const saveViewSchema = z.object({
  entity: z.string().refine(isEntityType),
  name: z.string().trim().min(1, "Name is required").max(60),
  query: z.string().max(2000),
  shared: z.boolean(),
});

export async function saveView(input: {
  entity: string;
  name: string;
  query: string;
  shared: boolean;
}): Promise<ActionResult & { id?: number }> {
  await requireSignedIn();
  const parsed = saveViewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid view" };
  }
  const userId = await getCurrentUserId();
  if (userId == null) {
    return { ok: false, error: "Your account isn't linked to a staff user." };
  }
  const query = new URLSearchParams(parsed.data.query);
  for (const transient of ["sv", "open"]) query.delete(transient);
  const db = await getDb();
  const [row] = await db
    .insert(savedViews)
    .values({
      userId,
      entity: parsed.data.entity as EntityType,
      name: parsed.data.name,
      query: query.toString(),
      shared: parsed.data.shared,
    })
    .returning();
  refresh();
  return { ok: true, id: row.id };
}

export async function deleteView(id: number): Promise<ActionResult> {
  await requireSignedIn();
  const userId = await getCurrentUserId();
  if (userId == null) return { ok: false, error: "Not allowed." };
  const db = await getDb();
  await db
    .delete(savedViews)
    .where(and(eq(savedViews.id, id), eq(savedViews.userId, userId)));
  refresh();
  return { ok: true };
}
