"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { EntityType } from "@/db/schema";
import { AssigneePicker, type AssignApi } from "@/components/data-view/assignees";
import { TagPicker, type TagApi } from "@/components/data-view/tags";
import { changeTagsAction, createTagAction } from "@/lib/actions/tags";
import { changeAssigneesAction } from "@/lib/actions/views";
import type { TagOption } from "@/lib/tag-colors";
import type { Ref } from "@/lib/views/fields";

type Lists = { tags: Ref[]; owners: Ref[] };
type Change = { key: keyof Lists; add: Ref[]; remove: number[] };

export function RecordMetaEditor({
  entity,
  id,
  tags,
  allTags,
  people,
  peopleLabel,
  users,
  currentUserId,
}: {
  entity: EntityType;
  id: number;
  tags: Ref[];
  allTags: TagOption[];
  people: Ref[];
  /** "Assignees" (events, tasks) or "Owners" (contacts, organizations). */
  peopleLabel: string;
  users: Ref[];
  currentUserId: number | null;
}) {
  const [state, apply] = useOptimistic<Lists, Change>(
    { tags, owners: people },
    (current, { key, add, remove }) => {
      const drop = new Set([...remove, ...add.map((r) => r.id)]);
      return { ...current, [key]: [...current[key].filter((r) => !drop.has(r.id)), ...add] };
    },
  );
  const [created, setCreated] = useState<TagOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const tagApi: TagApi = {
    tags: [...allTags, ...created.filter((c) => !allTags.some((t) => t.id === c.id))],
    change: (ids, add, remove) =>
      startTransition(async () => {
        setError(null);
        apply({ key: "tags", add, remove });
        const result = await changeTagsAction(entity, ids, { add: add.map((t) => t.id), remove });
        if (!result.ok) setError(result.error);
      }),
    create: async (name) => {
      const result = await createTagAction(name);
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      setCreated((list) => [...list, result.tag]);
      return result.tag;
    },
  };

  const ownerApi: AssignApi = {
    entity,
    noun: peopleLabel,
    users,
    currentUserId,
    change: (ids, add, remove) =>
      startTransition(async () => {
        setError(null);
        apply({ key: "owners", add, remove });
        const result = await changeAssigneesAction(entity, ids, { add: add.map((u) => u.id), remove });
        if (!result.ok) setError(result.error);
      }),
  };

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] px-5 py-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-[color:var(--muted)]">Tags</span>
        <TagPicker api={tagApi} ids={[id]} value={state.tags} />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[color:var(--muted)]">{peopleLabel}</span>
        <AssigneePicker api={ownerApi} ids={[id]} value={state.owners} />
      </div>
      {error ? (
        <p role="alert" className="w-full text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
