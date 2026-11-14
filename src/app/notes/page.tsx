import { asc, desc } from "drizzle-orm";
import { connection } from "next/server";
import {
  EmptyState,
  Field,
  PageHeader,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import { getDb, noteLinks, notes } from "@/db";
import { createStandaloneNote } from "@/lib/actions/notes";
import { NoteItem } from "@/components/note-item";
import {
  ENTITY_TYPES,
  entityHref,
  entityTypeLabel,
  loadEntityOptions,
  resolveEntityLabel,
} from "@/lib/entities";

export default async function NotesPage() {
  await connection();
  const db = await getDb();
  const noteRows = await db
    .select()
    .from(notes)
    .orderBy(desc(notes.createdAt));
  const linkRows = await db.select().from(noteLinks).orderBy(asc(noteLinks.id));
  const options = await loadEntityOptions();

  const allOptions = ENTITY_TYPES.flatMap((type) =>
    options[type].map((row) => ({
      value: `${type}:${row.id}`,
      label: `${entityTypeLabel(type)}: ${row.label}`,
    })),
  );

  const enriched = [];
  for (const note of noteRows) {
    const links = [];
    for (const link of linkRows.filter((row) => row.noteId === note.id)) {
      links.push({
        type: link.entityType,
        id: link.entityId,
        label: await resolveEntityLabel({
          type: link.entityType,
          id: link.entityId,
        }),
        href: entityHref(link.entityType, link.entityId),
      });
    }
    enriched.push({ note, links });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notes"
        description="Attachable notes across contacts, organizations, events, and tasks."
      />

      <form
        action={createStandaloneNote}
        className="max-w-2xl space-y-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4"
      >
        <Field label="Note">
          <textarea
            className={inputClassName}
            name="body"
            rows={3}
            required
            placeholder="What happened?"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Attach to">
            <select className={inputClassName} name="entity" required defaultValue="">
              <option value="">Select record…</option>
              {allOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Also attach to">
            <select className={inputClassName} name="alsoEntity" defaultValue="">
              <option value="">Optional</option>
              {allOptions.map((option) => (
                <option key={`also-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <SubmitButton>Create note</SubmitButton>
      </form>

      {enriched.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Create a note and attach it to any CRM record."
        />
      ) : (
        <ul className="space-y-3">
          {enriched.map((item) => (
            <NoteItem key={item.note.id} {...item} returnTo="/notes" />
          ))}
        </ul>
      )}
    </div>
  );
}
