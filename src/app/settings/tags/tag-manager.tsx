"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { inputClassName } from "@/components/ui";
import { createTagAction, deleteTagAction, updateTagAction } from "@/lib/actions/tags";
import { TAG_COLORS, tagChipClass, type TagOption } from "@/lib/tag-colors";

type Row = TagOption & { uses: number };

export function TagManager({ tags }: { tags: Row[] }) {
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });

  return (
    <div className="space-y-4 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            const result = await createTagAction(name);
            if (result.ok) setName("");
            return result;
          });
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          required
          placeholder="New tag name"
          aria-label="New tag name"
          className={`${inputClassName} max-w-64`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[color:var(--accent)] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Add tag
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}
      {tags.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">No tags yet.</p>
      ) : (
        <ul className="divide-y divide-[color:var(--line)]">
          {tags.map((tag) => (
            <li key={tag.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tagChipClass(tag.color)}`}>
                {tag.label}
              </span>
              <input
                defaultValue={tag.label}
                key={tag.label}
                maxLength={30}
                aria-label={`Rename ${tag.label}`}
                className={`${inputClassName} max-w-48`}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== tag.label) run(() => updateTagAction(tag.id, { name: next }));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
              <select
                aria-label={`Color for ${tag.label}`}
                value={tag.color}
                onChange={(e) => run(() => updateTagAction(tag.id, { color: e.target.value }))}
                className={`${inputClassName} max-w-32`}
              >
                {Object.entries(TAG_COLORS).map(([key, def]) => (
                  <option key={key} value={key}>
                    {def.label}
                  </option>
                ))}
              </select>
              <span className="text-[color:var(--muted)]">
                {tag.uses === 1 ? "1 record" : `${tag.uses} records`}
              </span>
              <span className="ml-auto flex gap-3 text-xs">
                <Link href={`/contacts?f.tags=${tag.id}`} className="text-[color:var(--accent)]">Contacts</Link>
                <Link href={`/organizations?f.tags=${tag.id}`} className="text-[color:var(--accent)]">Orgs</Link>
                <Link href={`/events?f.tags=${tag.id}`} className="text-[color:var(--accent)]">Events</Link>
                <Link href={`/tasks?f.tags=${tag.id}`} className="text-[color:var(--accent)]">Tasks</Link>
                <button
                  type="button"
                  className="text-[color:var(--danger)]"
                  onClick={() => {
                    const where = tag.uses ? ` It will be removed from ${tag.uses} record${tag.uses === 1 ? "" : "s"}.` : "";
                    if (confirm(`Delete the "${tag.label}" tag?${where} This can't be undone.`)) {
                      run(() => deleteTagAction(tag.id));
                    }
                  }}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
