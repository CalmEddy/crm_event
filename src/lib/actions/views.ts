"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { events, getDb, organizations, savedViews, tasks } from "@/db";
import { requireSignedIn } from "@/lib/auth";
import { getCurrentUserId } from "@/lib/current-user";
import { isEntityType, revalidateEntityPaths } from "@/lib/entities";
import { updateTaskStatus } from "@/lib/actions/tasks";
import { fieldByKey, isEditableField, VIEW_CONFIGS } from "@/lib/views/fields";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Generic single-field update used by board drag (and later, inline editing). */
export async function updateField(
  entity: string,
  id: number,
  key: string,
  value: string,
): Promise<ActionResult> {
  await requireSignedIn();
  if (!isEntityType(entity) || !isEditableField(entity, key)) {
    return { ok: false, error: "That field can't be edited here." };
  }
  const field = fieldByKey(VIEW_CONFIGS[entity], key)!;
  if (!field.options?.some((option) => option.value === value)) {
    return { ok: false, error: "Invalid value." };
  }
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Invalid record." };
  }

  const db = await getDb();
  const now = new Date();

  if (entity === "task" && key === "status") {
    // Reuse the existing path so assignees get change notifications.
    const formData = new FormData();
    formData.set("status", value);
    await updateTaskStatus(id, formData);
  } else if (entity === "task" && key === "kind") {
    await db
      .update(tasks)
      .set({ kind: value as typeof tasks.$inferInsert.kind, updatedAt: now })
      .where(eq(tasks.id, id));
  } else if (entity === "event" && key === "status") {
    await db
      .update(events)
      .set({ status: value as typeof events.$inferInsert.status, updatedAt: now })
      .where(eq(events.id, id));
  } else if (entity === "organization" && key === "type") {
    await db
      .update(organizations)
      .set({ type: value as typeof organizations.$inferInsert.type, updatedAt: now })
      .where(eq(organizations.id, id));
  } else {
    return { ok: false, error: "That field can't be edited here." };
  }

  revalidateEntityPaths([{ type: entity, id }]);
  refresh();
  return { ok: true };
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
  query.delete("sv");
  const db = await getDb();
  const [row] = await db
    .insert(savedViews)
    .values({
      userId,
      entity: parsed.data.entity as (typeof savedViews.$inferInsert)["entity"],
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
