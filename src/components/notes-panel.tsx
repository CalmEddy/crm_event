import Link from "next/link";
import {
  Field,
  Section,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import { createNoteForEntity, deleteNote } from "@/lib/actions/notes";
import {
  ENTITY_TYPES,
  entityTypeLabel,
  type EntityOptionMap,
  type NoteWithLinks,
} from "@/lib/entities";
import { formatDateTime } from "@/lib/format";
import type { EntityType } from "@/db";

export function NotesPanel({
  entityType,
  entityId,
  notes,
  options,
}: {
  entityType: EntityType;
  entityId: number;
  notes: NoteWithLinks[];
  options: EntityOptionMap;
}) {
  const returnTo =
    entityType === "contact"
      ? `/contacts/${entityId}`
      : entityType === "organization"
        ? `/organizations/${entityId}`
        : entityType === "event"
          ? `/events/${entityId}`
          : `/tasks/${entityId}`;

  const alsoOptions = ENTITY_TYPES.flatMap((type) =>
    options[type]
      .filter((row) => !(type === entityType && row.id === entityId))
      .map((row) => ({
        value: `${type}:${row.id}`,
        label: `${entityTypeLabel(type)}: ${row.label}`,
      })),
  );

  return (
    <Section title="Notes">
      {notes.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">No notes yet.</p>
      ) : (
        <ul className="mb-4 space-y-3">
          {notes.map(({ note, links }) => (
            <li
              key={note.id}
              className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4"
            >
              <p className="whitespace-pre-wrap text-sm text-[color:var(--ink)]">
                {note.body}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
                <span>{formatDateTime(note.createdAt)}</span>
                {links.map((link) => (
                  <Link
                    key={`${link.type}-${link.id}`}
                    href={link.href}
                    className="rounded-md bg-[color:var(--panel-soft)] px-2 py-0.5 text-[color:var(--accent)]"
                  >
                    {entityTypeLabel(link.type)}: {link.label}
                  </Link>
                ))}
                <form
                  action={deleteNote.bind(null, note.id, returnTo)}
                  className="ml-auto"
                >
                  <SubmitButton variant="secondary">Delete</SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        action={createNoteForEntity.bind(null, entityType, entityId)}
        className="max-w-2xl space-y-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4"
      >
        <Field label="Add note">
          <textarea
            className={inputClassName}
            name="body"
            rows={3}
            required
            placeholder="Call notes, logistics, promises…"
          />
        </Field>
        <Field label="Also attach to (optional)">
          <select className={inputClassName} name="alsoEntity" defaultValue="">
            <option value="">Just this record</option>
            {alsoOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <SubmitButton>Save note</SubmitButton>
      </form>
    </Section>
  );
}
