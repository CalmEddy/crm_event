import Link from "next/link";
import { AddDialog } from "@/components/add-dialog";
import { LinkSearch } from "@/components/link-search";
import { Section, SubmitButton } from "@/components/ui";
import { removeEntityLink } from "@/lib/actions/links";
import {
  ENTITY_LINK_ROLES,
  type EntityOptionMap,
  type RelatedLinkView,
} from "@/lib/entities";
import { labelize } from "@/lib/constants";
import type { EntityType } from "@/db";

/** A link that lives somewhere else (e.g. an event's people & orgs). */
export type ExtraRelatedLink = {
  key: string;
  type: EntityType;
  id: number;
  label: string;
  href: string;
  detail: string;
  remove: () => Promise<void>;
};

const GROUPS: { type: EntityType; label: string }[] = [
  { type: "contact", label: "People" },
  { type: "organization", label: "Organizations" },
  { type: "event", label: "Events" },
  { type: "task", label: "Tasks" },
];

type Row = {
  key: string;
  type: EntityType;
  id: number;
  label: string;
  href: string;
  detail: string;
  remove: () => Promise<void>;
};

export function RelatedLinksPanel({
  entityType,
  entityId,
  links,
  extraLinks = [],
}: {
  entityType: EntityType;
  entityId: number;
  links: RelatedLinkView[];
  extraLinks?: ExtraRelatedLink[];
  /** Unused since linking moved to the type-ahead box; kept for callers. */
  options?: EntityOptionMap;
}) {
  const rows: Row[] = [
    ...extraLinks,
    ...links.map((link) => ({
      key: `link-${link.linkId}`,
      type: link.other.type,
      id: link.other.id,
      label: link.other.label,
      href: link.other.href,
      detail: [labelize(link.role), link.notes].filter(Boolean).join(" · "),
      remove: removeEntityLink.bind(null, link.linkId, entityType, entityId),
    })),
  ];

  return (
    <Section
      title="Related records"
      actions={
        <AddDialog title="Link a related record" closeOnSubmit={false}>
          <LinkSearch
            fromType={entityType}
            fromId={entityId}
            linked={rows.map((row) => `${row.type}:${row.id}`)}
            roles={ENTITY_LINK_ROLES}
          />
        </AddDialog>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">
          No related records yet. Use + Add to link people, organizations, events or tasks.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {GROUPS.map((group) => {
            const items = rows
              .filter((row) => row.type === group.type)
              .sort((a, b) => a.label.localeCompare(b.label));
            if (items.length === 0) return null;
            return (
              <section
                key={group.type}
                aria-label={group.label}
                className="overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]"
              >
                <h3 className="border-b border-[color:var(--line)] bg-[color:var(--panel-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  {group.label} <span className="font-normal">({items.length})</span>
                </h3>
                <ul className="divide-y divide-[color:var(--line)]">
                  {items.map((row) => (
                    <li key={row.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <Link href={row.href} className="font-medium text-[color:var(--accent)]">
                          {row.label}
                        </Link>
                        {row.detail ? (
                          <div className="truncate text-[color:var(--muted)]">{row.detail}</div>
                        ) : null}
                      </div>
                      <form action={row.remove}>
                        <SubmitButton variant="secondary">Unlink</SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Section>
  );
}
