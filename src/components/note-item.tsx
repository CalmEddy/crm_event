import Link from "next/link";
import { AddDialog } from "@/components/add-dialog";
import { Field, SubmitButton, inputClassName } from "@/components/ui";
import { deleteNote, unlinkNote, updateNote } from "@/lib/actions/notes";
import { entityTypeLabel, type NoteWithLinks } from "@/lib/entities";
import { formatDateTime } from "@/lib/format";

/**
 * One note: body, linked records (each can be unlinked while another link
 * remains), and Edit / Delete. `returnTo` is the page to come back to.
 */
export function NoteItem({ note, links, returnTo }: NoteWithLinks & { returnTo: string }) {
  const edited = note.updatedAt.getTime() - note.createdAt.getTime() > 1000;
  const canUnlink = links.length > 1;
  return (
    <li className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
      <p className="whitespace-pre-wrap text-sm text-[color:var(--ink)]">{note.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
        <span title={edited ? `Edited ${formatDateTime(note.updatedAt)}` : undefined}>
          {formatDateTime(note.createdAt)}
          {edited ? " · edited" : ""}
        </span>
        {links.map((link) => (
          <span
            key={`${link.type}-${link.id}`}
            className="inline-flex items-center rounded-md bg-[color:var(--panel-soft)]"
          >
            <Link href={link.href} className="px-2 py-0.5 text-[color:var(--accent)]">
              {entityTypeLabel(link.type)}: {link.label}
            </Link>
            {canUnlink ? (
              <form action={unlinkNote.bind(null, note.id, link.type, link.id, returnTo)}>
                <button
                  type="submit"
                  aria-label={`Unlink ${entityTypeLabel(link.type)} ${link.label} from this note`}
                  title="Unlink"
                  className="rounded-r-md px-1.5 py-0.5 text-[color:var(--muted)] hover:bg-[color:var(--line)] hover:text-[color:var(--danger)]"
                >
                  ✕
                </button>
              </form>
            ) : null}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <AddDialog label="Edit" title="Edit note">
            <form action={updateNote.bind(null, note.id, returnTo)} className="space-y-3">
              <Field label="Note">
                <textarea
                  className={inputClassName}
                  name="body"
                  rows={6}
                  required
                  defaultValue={note.body}
                />
              </Field>
              <SubmitButton>Save note</SubmitButton>
            </form>
          </AddDialog>
          <form action={deleteNote.bind(null, note.id, returnTo)}>
            <SubmitButton variant="secondary">Delete</SubmitButton>
          </form>
        </span>
      </div>
    </li>
  );
}
