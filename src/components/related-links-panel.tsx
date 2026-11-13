import Link from "next/link";
import { LinkSearch } from "@/components/link-search";
import { Section, SubmitButton } from "@/components/ui";
import { removeEntityLink } from "@/lib/actions/links";
import {
  ENTITY_LINK_ROLES,
  entityTypeLabel,
  type EntityOptionMap,
  type RelatedLinkView,
} from "@/lib/entities";
import { labelize } from "@/lib/constants";
import type { EntityType } from "@/db";

export function RelatedLinksPanel({
  entityType,
  entityId,
  links,
}: {
  entityType: EntityType;
  entityId: number;
  links: RelatedLinkView[];
  /** Unused since linking moved to the type-ahead box; kept for callers. */
  options?: EntityOptionMap;
}) {
  return (
    <Section title="Related records">
      {links.length === 0 ? (
        <p className="mb-4 text-sm text-[color:var(--muted)]">
          No CRM links yet. Connect events, people, orgs, and tasks.
        </p>
      ) : (
        <ul className="mb-4 divide-y divide-[color:var(--line)] overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
          {links.map((link) => (
            <li
              key={link.linkId}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-sm">
                <div className="font-medium">
                  <Link
                    href={link.other.href}
                    className="text-[color:var(--accent)]"
                  >
                    {link.other.label}
                  </Link>
                </div>
                <div className="text-[color:var(--muted)]">
                  {entityTypeLabel(link.other.type)} · {labelize(link.role)}
                  {link.notes ? ` · ${link.notes}` : ""}
                </div>
              </div>
              <form
                action={removeEntityLink.bind(
                  null,
                  link.linkId,
                  entityType,
                  entityId,
                )}
              >
                <SubmitButton variant="secondary">Unlink</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      <LinkSearch
        fromType={entityType}
        fromId={entityId}
        linked={links.map((link) => `${link.other.type}:${link.other.id}`)}
        roles={ENTITY_LINK_ROLES}
      />
    </Section>
  );
}
