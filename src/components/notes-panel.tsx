import { AddDialog } from "@/components/add-dialog";
import {
  Field,
  Section,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import { createNoteForEntity } from "@/lib/actions/notes";
import { NoteItem } from "@/components/note-item";
import {
  ENTITY_TYPES,
  entityTypeLabel,
  type EntityOptionMap,
  type NoteWithLinks,
} from "@/lib/entities";
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
    <Section
      title="Notes"
      actions={
        <AddDialog title="Add note">
          <form
            action={createNoteForEntity.bind(null, entityType, entityId)}
            className="space-y-3"
          >
            <Field label="Note">
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
        </AddDialog>
      }
    >
      {notes.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((item) => (
            <NoteItem key={item.note.id} {...item} returnTo={returnTo} />
          ))}
        </ul>
      )}

    </Section>
  );
}
