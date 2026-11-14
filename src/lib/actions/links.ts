"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { quickCreate } from "@/lib/actions/views";
import { entityLinks, getDb, type EntityType } from "@/db";
import { requireSignedIn } from "@/lib/auth";
import {
  ENTITY_LINK_ROLES,
  entityHref,
  isEntityType,
  normalizeEntityPair,
  revalidateEntityPaths,
  type EntityRef,
} from "@/lib/entities";

function parseRef(typeRaw: string, idRaw: string): EntityRef | null {
  if (!isEntityType(typeRaw)) return null;
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) return null;
  return { type: typeRaw, id };
}

function parseCompositeRef(raw: string): EntityRef | null {
  const value = raw.trim();
  if (!value) return null;
  const [typeRaw, idRaw] = value.split(":");
  if (!typeRaw || !idRaw) return null;
  return parseRef(typeRaw, idRaw);
}

export async function createEntityLink(
  fromType: EntityType,
  fromId: number,
  formData: FormData,
) {
  await requireSignedIn();
  const from = parseRef(fromType, String(fromId));
  if (!from) throw new Error("Invalid source record");

  const to =
    parseCompositeRef(String(formData.get("toRef") ?? "")) ??
    parseRef(
      String(formData.get("toType") ?? "").trim(),
      String(formData.get("toId") ?? "").trim(),
    );
  if (!to) throw new Error("Pick a record to link");

  if (from.type === to.type && from.id === to.id) {
    throw new Error("Cannot link a record to itself");
  }

  const roleRaw = String(formData.get("role") ?? "related").trim() || "related";
  const role = (ENTITY_LINK_ROLES as readonly string[]).includes(roleRaw)
    ? roleRaw
    : roleRaw;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const [left, right] = normalizeEntityPair(from, to);
  const db = await getDb();

  const existing = await db
    .select({ id: entityLinks.id })
    .from(entityLinks)
    .where(
      and(
        eq(entityLinks.leftType, left.type),
        eq(entityLinks.leftId, left.id),
        eq(entityLinks.rightType, right.type),
        eq(entityLinks.rightId, right.id),
        eq(entityLinks.role, role),
      ),
    );

  if (existing.length === 0) {
    await db.insert(entityLinks).values({
      leftType: left.type,
      leftId: left.id,
      rightType: right.type,
      rightId: right.id,
      role,
      notes,
    });
  }

  revalidateEntityPaths([from, to]);
  redirect(entityHref(from.type, from.id));
}

export async function removeEntityLink(
  linkId: number,
  returnType: EntityType,
  returnId: number,
) {
  await requireSignedIn();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(entityLinks)
    .where(eq(entityLinks.id, linkId));

  if (row) {
    await db.delete(entityLinks).where(eq(entityLinks.id, linkId));
    revalidateEntityPaths([
      { type: row.leftType, id: row.leftId },
      { type: row.rightType, id: row.rightId },
    ]);
  } else {
    revalidateEntityPaths([{ type: returnType, id: returnId }]);
  }

  redirect(entityHref(returnType, returnId));
}

export type LinkTarget =
  | { type: EntityType; id: number }
  | { type: EntityType; create: string };

/**
 * Type-ahead linking: link to an existing record, or create a new one (with
 * the same defaults as quick-add) and link it, without leaving the page.
 */
export async function linkRecordAction(
  fromType: EntityType,
  fromId: number,
  target: LinkTarget,
  input: { role?: string; notes?: string } = {},
): Promise<{ ok: true; href: string; created: boolean } | { ok: false; error: string }> {
  await requireSignedIn();
  const from = parseRef(fromType, String(fromId));
  if (!from) return { ok: false, error: "Invalid source record." };
  if (!isEntityType(target.type)) return { ok: false, error: "Unknown record type." };

  let to: EntityRef;
  let created = false;
  if ("create" in target) {
    const title = String(target.create ?? "").trim().slice(0, 200);
    if (!title) return { ok: false, error: "Type a name first." };
    const result = await quickCreate(target.type, title, {});
    if (!result.ok || !result.id) return { ok: false, error: result.ok ? "Couldn't create it." : result.error };
    to = { type: target.type, id: result.id };
    created = true;
  } else {
    const parsed = parseRef(target.type, String(target.id));
    if (!parsed) return { ok: false, error: "Pick a record to link." };
    to = parsed;
  }
  if (from.type === to.type && from.id === to.id) {
    return { ok: false, error: "A record can't be linked to itself." };
  }

  const role = (ENTITY_LINK_ROLES as readonly string[]).includes(input.role ?? "")
    ? (input.role as string)
    : "related";
  const notes = String(input.notes ?? "").trim().slice(0, 500) || null;
  const [left, right] = normalizeEntityPair(from, to);
  const db = await getDb();
  await db
    .insert(entityLinks)
    .values({ leftType: left.type, leftId: left.id, rightType: right.type, rightId: right.id, role, notes })
    .onConflictDoNothing();
  revalidateEntityPaths([from, to]);
  refresh();
  return { ok: true, href: entityHref(to.type, to.id), created };
}
