"use server";

import { eq, sql, and, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb, tags } from "@/db";
import { requireSignedIn } from "@/lib/auth";
import { isEntityType, revalidateEntityPaths } from "@/lib/entities";
import { FieldError } from "@/lib/records";
import { isTagColor, type TagOption } from "@/lib/tag-colors";
import { changeRecordTags, cleanTagName, findOrCreateTag } from "@/lib/tags";

type Result = { ok: true } | { ok: false; error: string };

const ids = (list: unknown) =>
  Array.isArray(list)
    ? [...new Set(list.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200)
    : [];

/** Add/remove tags on one or more records (cell picker, bulk bar, detail page). */
export async function changeTagsAction(
  entity: string,
  recordIds: number[],
  change: { add: number[]; remove: number[] },
): Promise<Result> {
  await requireSignedIn();
  if (!isEntityType(entity)) return { ok: false, error: "Unknown record type." };
  const cleaned = ids(recordIds);
  if (cleaned.length === 0) return { ok: false, error: "Nothing selected." };
  await changeRecordTags(entity, cleaned, { add: ids(change.add), remove: ids(change.remove) });
  revalidateEntityPaths(cleaned.map((id) => ({ type: entity, id })));
  refresh();
  return { ok: true };
}

/** Create a tag (or return the existing one with that name) from the picker. */
export async function createTagAction(
  name: string,
): Promise<{ ok: true; tag: TagOption } | { ok: false; error: string }> {
  await requireSignedIn();
  try {
    return { ok: true, tag: await findOrCreateTag(name) };
  } catch (error) {
    if (error instanceof FieldError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function updateTagAction(
  id: number,
  input: { name?: string; color?: string },
): Promise<Result> {
  await requireSignedIn();
  const patch: { name?: string; color?: string } = {};
  try {
    if (input.name != null) patch.name = cleanTagName(input.name);
  } catch (error) {
    if (error instanceof FieldError) return { ok: false, error: error.message };
    throw error;
  }
  if (input.color != null) {
    if (!isTagColor(input.color)) return { ok: false, error: "Unknown color." };
    patch.color = input.color;
  }
  const db = await getDb();
  if (patch.name) {
    const [clash] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(sql`lower(${tags.name}) = lower(${patch.name})`, ne(tags.id, id)))
      .limit(1);
    if (clash) return { ok: false, error: `There is already a "${patch.name}" tag.` };
  }
  if (Object.keys(patch).length) await db.update(tags).set(patch).where(eq(tags.id, id));
  refresh();
  return { ok: true };
}

export async function deleteTagAction(id: number): Promise<Result> {
  await requireSignedIn();
  const db = await getDb();
  // record_tags rows go with it (ON DELETE CASCADE).
  await db.delete(tags).where(eq(tags.id, id));
  refresh();
  return { ok: true };
}
