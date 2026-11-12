import { eq } from "drizzle-orm";
import {
  contacts,
  entityLinks,
  events,
  getDb,
  noteLinks,
  notes,
  organizations,
  tasks,
} from "../src/db";
import { normalizeEntityPair } from "../src/lib/entities";

async function main() {
  const db = await getDb();
  const [event] = await db.select().from(events).limit(1);
  const [contact] = await db.select().from(contacts).limit(1);
  const [org] = await db.select().from(organizations).limit(1);
  if (!event || !contact || !org) throw new Error("Seed data missing");

  const [note] = await db
    .insert(notes)
    .values({ body: "Smoke note: confirmed travel hold" })
    .returning();
  await db.insert(noteLinks).values([
    { noteId: note.id, entityType: "event", entityId: event.id },
    { noteId: note.id, entityType: "contact", entityId: contact.id },
  ]);

  const [left, right] = normalizeEntityPair(
    { type: "event", id: event.id },
    { type: "organization", id: org.id },
  );
  await db.insert(entityLinks).values({
    leftType: left.type,
    leftId: left.id,
    rightType: right.type,
    rightId: right.id,
    role: "booked_with",
    notes: "smoke link",
  });

  const [task] = await db
    .insert(tasks)
    .values({
      title: "Standalone smoke task",
      kind: "call",
      dueOn: "2026-12-01",
      status: "todo",
      contactId: contact.id,
    })
    .returning();

  const noteCount = await db
    .select()
    .from(noteLinks)
    .where(eq(noteLinks.noteId, note.id));
  const linkCount = await db.select().from(entityLinks);
  console.log(
    JSON.stringify(
      {
        noteId: note.id,
        noteLinks: noteCount.length,
        entityLinks: linkCount.length,
        taskId: task.id,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
