// Server-side tag storage. Not a "use server" module.
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, recordTags, tags, type EntityType } from "@/db";
import { logActivity, snapshot, titleOf } from "@/lib/activity";
import { FieldError } from "@/lib/records";
import { isTagColor, type TagOption } from "@/lib/tag-colors";
import type { Ref } from "@/lib/views/fields";

export async function listTags(): Promise<TagOption[]> {
  const db = await getDb();
  const rows = await db.select().from(tags).orderBy(asc(sql`lower(${tags.name})`));
  return rows.map((row) => ({ id: row.id, label: row.name, color: row.color }));
}

/** Tag usage counts by id, for the management page. */
export async function tagUsage(): Promise<Map<number, number>> {
  const db = await getDb();
  const rows = await db
    .select({ id: recordTags.tagId, n: sql<number>`count(*)::int` })
    .from(recordTags)
    .groupBy(recordTags.tagId);
  return new Map(rows.map((row) => [row.id, Number(row.n)]));
}

/** entityId -> tags */
export async function loadRecordTags(entity: EntityType, ids?: number[]): Promise<Map<number, Ref[]>> {
  const db = await getDb();
  const where = ids
    ? and(eq(recordTags.entity, entity), inArray(recordTags.entityId, ids.length ? ids : [0]))
    : eq(recordTags.entity, entity);
  const rows = await db
    .select({ entityId: recordTags.entityId, id: tags.id, label: tags.name })
    .from(recordTags)
    .innerJoin(tags, eq(tags.id, recordTags.tagId))
    .where(where)
    .orderBy(asc(sql`lower(${tags.name})`));
  const map = new Map<number, Ref[]>();
  for (const row of rows) {
    const list = map.get(row.entityId) ?? [];
    list.push({ id: row.id, label: row.label });
    map.set(row.entityId, list);
  }
  return map;
}

export function cleanTagName(raw: string) {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw new FieldError("Tag name is required");
  if (name.length > 30) throw new FieldError("Keep tag names under 30 characters");
  return name;
}

/** Find a tag by name (case-insensitive) or create it. */
export async function findOrCreateTag(rawName: string, color = "slate"): Promise<TagOption> {
  const name = cleanTagName(rawName);
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(tags)
    .where(sql`lower(${tags.name}) = lower(${name})`)
    .limit(1);
  if (existing) return { id: existing.id, label: existing.name, color: existing.color };
  const [row] = await db
    .insert(tags)
    .values({ name, color: isTagColor(color) ? color : "slate" })
    .returning();
  return { id: row.id, label: row.name, color: row.color };
}

/** Add/remove tags on records, logging each record's change. */
export async function changeRecordTags(
  entity: EntityType,
  ids: number[],
  change: { add: number[]; remove: number[] },
) {
  if (ids.length === 0 || (change.add.length === 0 && change.remove.length === 0)) return;
  const db = await getDb();
  const known = await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(inArray(tags.id, [...change.add, ...change.remove]));
  const names = new Map(known.map((t) => [t.id, t.name]));
  const add = change.add.filter((id) => names.has(id));
  const remove = change.remove.filter((id) => names.has(id));
  const before = await loadRecordTags(entity, ids);
  for (const id of ids) {
    const had = new Set((before.get(id) ?? []).map((t) => t.id));
    const added = add.filter((t) => !had.has(t));
    const removed = remove.filter((t) => had.has(t));
    if (removed.length) {
      await db
        .delete(recordTags)
        .where(
          and(eq(recordTags.entity, entity), eq(recordTags.entityId, id), inArray(recordTags.tagId, removed)),
        );
    }
    if (added.length) {
      await db
        .insert(recordTags)
        .values(added.map((tagId) => ({ tagId, entity, entityId: id })))
        .onConflictDoNothing();
    }
    if (added.length || removed.length) {
      const parts = [
        added.length ? `Tags added: ${added.map((t) => names.get(t)).join(", ")}` : "",
        removed.length ? `Tags removed: ${removed.map((t) => names.get(t)).join(", ")}` : "",
      ].filter(Boolean);
      await logActivity([
        {
          entity,
          entityId: id,
          action: "updated",
          label: titleOf(entity, await snapshot(entity, id)),
          detail: parts.join("; "),
        },
      ]);
    }
  }
}
