"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
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
