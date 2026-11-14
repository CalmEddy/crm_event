"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, noteLinks, notes, type EntityType } from "@/db";
import { requireSignedIn } from "@/lib/auth";
import {
  entityHref,
  isEntityType,
  revalidateEntityPaths,
  type EntityRef,
} from "@/lib/entities";

function parseEntityRef(
  typeRaw: string,
  idRaw: string,
): EntityRef | null {
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
  return parseEntityRef(typeRaw, idRaw);
}

function collectTargets(primary: EntityRef, formData: FormData): EntityRef[] {
  const targets: EntityRef[] = [primary];
  const seen = new Set<string>([`${primary.type}:${primary.id}`]);

  for (const key of ["alsoEntity", "entity", "alsoEntity2"]) {
    const extra = parseCompositeRef(String(formData.get(key) ?? ""));
    if (!extra) continue;
    const token = `${extra.type}:${extra.id}`;
    if (seen.has(token)) continue;
    seen.add(token);
    targets.push(extra);
  }

  return targets;
}

export async function createNoteForEntity(
  entityType: EntityType,
  entityId: number,
  formData: FormData,
) {
  await requireSignedIn();
  const primary = parseEntityRef(entityType, String(entityId));
  if (!primary) throw new Error("Invalid entity");

  const body = String(formData.get("body") ?? "").trim();
  if (!body) throw new Error("Note body is required");

  const targets = collectTargets(primary, formData);
  const db = await getDb();
  const [note] = await db.insert(notes).values({ body }).returning();
  await db.insert(noteLinks).values(
    targets.map((ref) => ({
      noteId: note.id,
      entityType: ref.type,
      entityId: ref.id,
    })),
  );

  revalidateEntityPaths(targets);
  redirect(entityHref(primary.type, primary.id));
}

export async function createStandaloneNote(formData: FormData) {
  await requireSignedIn();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) throw new Error("Note body is required");

  const primary = parseCompositeRef(String(formData.get("entity") ?? ""));
  if (!primary) throw new Error("Attach the note to at least one record");

  const targets = collectTargets(primary, formData);
  const db = await getDb();
  const [note] = await db.insert(notes).values({ body }).returning();
  await db.insert(noteLinks).values(
    targets.map((ref) => ({
      noteId: note.id,
      entityType: ref.type,
      entityId: ref.id,
    })),
  );

  revalidateEntityPaths(targets);
  redirect("/notes");
}

export async function deleteNote(noteId: number, returnTo: string) {
  await requireSignedIn();
  const db = await getDb();
  const links = await db
    .select()
    .from(noteLinks)
    .where(eq(noteLinks.noteId, noteId));

  await db.delete(notes).where(eq(notes.id, noteId));

  revalidateEntityPaths(
    links.map((link) => ({ type: link.entityType, id: link.entityId })),
  );
  redirect(returnTo || "/notes");
}

/** Only return to pages on this site (record pages or the notes list). */
function safeReturn(returnTo: string) {
  return /^\/(notes|(contacts|organizations|events|tasks)\/\d+)$/.test(returnTo) ? returnTo : "/notes";
}

async function noteRefs(noteId: number): Promise<EntityRef[]> {
  const db = await getDb();
  const links = await db.select().from(noteLinks).where(eq(noteLinks.noteId, noteId));
  return links.map((link) => ({ type: link.entityType, id: link.entityId }));
}

export async function updateNote(noteId: number, returnTo: string, formData: FormData) {
  await requireSignedIn();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) throw new Error("Note body is required");
  const db = await getDb();
  await db.update(notes).set({ body, updatedAt: new Date() }).where(eq(notes.id, noteId));
  revalidateEntityPaths(await noteRefs(noteId));
  revalidatePath("/notes");
  redirect(safeReturn(returnTo));
}

/**
 * Detach a note from one record. A note must stay attached to at least one
 * record, so the last link can't be removed (delete the note instead).
 */
export async function unlinkNote(
  noteId: number,
  entityType: EntityType,
  entityId: number,
  returnTo: string,
) {
  await requireSignedIn();
  const refs = await noteRefs(noteId);
  const others = refs.filter((ref) => !(ref.type === entityType && ref.id === entityId));
  if (others.length === 0) {
    throw new Error("A note needs at least one linked record. Delete the note instead.");
  }
  const db = await getDb();
  await db
    .delete(noteLinks)
    .where(
      and(
        eq(noteLinks.noteId, noteId),
        eq(noteLinks.entityType, entityType),
        eq(noteLinks.entityId, entityId),
      ),
    );
  revalidateEntityPaths(refs);
  revalidatePath("/notes");
  redirect(safeReturn(returnTo));
}
