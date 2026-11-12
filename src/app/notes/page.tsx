import Link from "next/link";
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
import { createStandaloneNote, deleteNote } from "@/lib/actions/notes";
import {
  ENTITY_TYPES,
  entityHref,
  entityTypeLabel,
  loadEntityOptions,
  resolveEntityLabel,
} from "@/lib/entities";
import { formatDateTime } from "@/lib/format";

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
          {enriched.map(({ note, links }) => (
            <li
              key={note.id}
              className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4"
            >
              <p className="whitespace-pre-wrap text-sm">{note.body}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
                <span>{formatDateTime(note.createdAt)}</span>
                {links.map((link) => (
                  <Link
                    key={`${note.id}-${link.type}-${link.id}`}
                    href={link.href}
                    className="rounded-md bg-[color:var(--panel-soft)] px-2 py-0.5 text-[color:var(--accent)]"
                  >
                    {entityTypeLabel(link.type)}: {link.label}
                  </Link>
                ))}
                <form
                  action={deleteNote.bind(null, note.id, "/notes")}
                  className="ml-auto"
                >
                  <SubmitButton variant="secondary">Delete</SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
