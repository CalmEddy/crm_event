import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  contacts,
  customValues,
  entityLinks,
  events,
  getDb,
  noteLinks,
  notes,
  organizations,
  tasks,
  type EntityType,
} from "@/db";
import { labelize } from "@/lib/constants";

export const ENTITY_TYPES = [
  "contact",
  "organization",
  "event",
  "task",
] as const satisfies readonly EntityType[];

export const ENTITY_LINK_ROLES = [
  "related",
  "about",
  "follows_up",
  "booked_with",
  "works_with",
  "other",
] as const;

export type EntityRef = { type: EntityType; id: number };

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

export function entityHref(type: EntityType, id: number) {
  switch (type) {
    case "contact":
      return `/contacts/${id}`;
    case "organization":
      return `/organizations/${id}`;
    case "event":
      return `/events/${id}`;
    case "task":
      return `/tasks/${id}`;
  }
}

export function entityTypeLabel(type: EntityType) {
  return labelize(type);
}

export function revalidateEntityPaths(refs: EntityRef[]) {
  revalidatePath("/notes");
  for (const ref of refs) {
    revalidatePath(entityHref(ref.type, ref.id));
    switch (ref.type) {
      case "contact":
        revalidatePath("/contacts");
        break;
      case "organization":
        revalidatePath("/organizations");
        break;
      case "event":
        revalidatePath("/events");
        revalidatePath("/");
        break;
      case "task":
        revalidatePath("/tasks");
        revalidatePath("/");
        break;
    }
  }
}

/** Store undirected links in a stable left/right order. */
export function normalizeEntityPair(
  a: EntityRef,
  b: EntityRef,
): [EntityRef, EntityRef] {
  if (a.type < b.type || (a.type === b.type && a.id <= b.id)) {
    return [a, b];
  }
  return [b, a];
}

export async function resolveEntityLabel(ref: EntityRef): Promise<string> {
  const db = await getDb();
  switch (ref.type) {
    case "contact": {
      const [row] = await db
        .select({ name: contacts.name })
        .from(contacts)
        .where(eq(contacts.id, ref.id));
      return row?.name ?? `Contact #${ref.id}`;
    }
    case "organization": {
      const [row] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, ref.id));
      return row?.name ?? `Organization #${ref.id}`;
    }
    case "event": {
      const [row] = await db
        .select({ title: events.title })
        .from(events)
        .where(eq(events.id, ref.id));
      return row?.title ?? `Event #${ref.id}`;
    }
    case "task": {
      const [row] = await db
        .select({ title: tasks.title })
        .from(tasks)
        .where(eq(tasks.id, ref.id));
      return row?.title ?? `Task #${ref.id}`;
    }
  }
}

export async function loadEntityOptions() {
  const db = await getDb();
  const [contactRows, orgRows, eventRows, taskRows] = await Promise.all([
    db
      .select({ id: contacts.id, label: contacts.name })
      .from(contacts)
      .orderBy(asc(contacts.name)),
    db
      .select({ id: organizations.id, label: organizations.name })
      .from(organizations)
      .orderBy(asc(organizations.name)),
    db
      .select({ id: events.id, label: events.title })
      .from(events)
      .orderBy(asc(events.startsAt)),
    db
      .select({ id: tasks.id, label: tasks.title })
      .from(tasks)
      .orderBy(asc(tasks.dueOn)),
  ]);

  return {
    contact: contactRows,
    organization: orgRows,
    event: eventRows,
    task: taskRows,
  };
}

export type EntityOptionMap = Awaited<ReturnType<typeof loadEntityOptions>>;

export type NoteWithLinks = {
  note: typeof notes.$inferSelect;
  links: Array<{
    type: EntityType;
    id: number;
    label: string;
    href: string;
  }>;
};

export async function loadNotesForEntity(
  ref: EntityRef,
): Promise<NoteWithLinks[]> {
  const db = await getDb();
  const attached = await db
    .select({ noteId: noteLinks.noteId })
    .from(noteLinks)
    .where(
      and(eq(noteLinks.entityType, ref.type), eq(noteLinks.entityId, ref.id)),
    );

  const noteIds = attached.map((row) => row.noteId);
  if (noteIds.length === 0) return [];

  const noteRows = await db
    .select()
    .from(notes)
    .where(inArray(notes.id, noteIds))
    .orderBy(desc(notes.createdAt));

  const allLinks = await db
    .select()
    .from(noteLinks)
    .where(inArray(noteLinks.noteId, noteIds));

  const labelCache = new Map<string, string>();
  async function labelFor(type: EntityType, id: number) {
    const key = `${type}:${id}`;
    if (!labelCache.has(key)) {
      labelCache.set(key, await resolveEntityLabel({ type, id }));
    }
    return labelCache.get(key)!;
  }

  const result: NoteWithLinks[] = [];
  for (const note of noteRows) {
    const links = [];
    for (const link of allLinks.filter((row) => row.noteId === note.id)) {
      links.push({
        type: link.entityType,
        id: link.entityId,
        label: await labelFor(link.entityType, link.entityId),
        href: entityHref(link.entityType, link.entityId),
      });
    }
    result.push({ note, links });
  }
  return result;
}

export type RelatedLinkView = {
  linkId: number;
  role: string;
  notes: string | null;
  other: {
    type: EntityType;
    id: number;
    label: string;
    href: string;
  };
};

export async function loadRelatedLinksForEntity(
  ref: EntityRef,
): Promise<RelatedLinkView[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(entityLinks)
    .where(
      or(
        and(eq(entityLinks.leftType, ref.type), eq(entityLinks.leftId, ref.id)),
        and(
          eq(entityLinks.rightType, ref.type),
          eq(entityLinks.rightId, ref.id),
        ),
      ),
    )
    .orderBy(asc(entityLinks.createdAt));

  const views: RelatedLinkView[] = [];
  for (const row of rows) {
    const other =
      row.leftType === ref.type && row.leftId === ref.id
        ? { type: row.rightType, id: row.rightId }
        : { type: row.leftType, id: row.leftId };
    views.push({
      linkId: row.id,
      role: row.role,
      notes: row.notes,
      other: {
        ...other,
        label: await resolveEntityLabel(other),
        href: entityHref(other.type, other.id),
      },
    });
  }
  return views;
}

export async function deletePolymorphicRefsForEntity(ref: EntityRef) {
  const db = await getDb();

  await db
    .delete(customValues)
    .where(and(eq(customValues.entity, ref.type), eq(customValues.entityId, ref.id)));

  const linkedNotes = await db
    .select({ noteId: noteLinks.noteId })
    .from(noteLinks)
    .where(
      and(eq(noteLinks.entityType, ref.type), eq(noteLinks.entityId, ref.id)),
    );

  await db
    .delete(noteLinks)
    .where(
      and(eq(noteLinks.entityType, ref.type), eq(noteLinks.entityId, ref.id)),
    );

  for (const { noteId } of linkedNotes) {
    const remaining = await db
      .select({ id: noteLinks.id })
      .from(noteLinks)
      .where(eq(noteLinks.noteId, noteId));
    if (remaining.length === 0) {
      await db.delete(notes).where(eq(notes.id, noteId));
    }
  }

  await db
    .delete(entityLinks)
    .where(
      or(
        and(eq(entityLinks.leftType, ref.type), eq(entityLinks.leftId, ref.id)),
        and(
          eq(entityLinks.rightType, ref.type),
          eq(entityLinks.rightId, ref.id),
        ),
      ),
    );
}
