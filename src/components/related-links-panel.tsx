import Link from "next/link";
import {
  Field,
  Section,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import { createEntityLink, removeEntityLink } from "@/lib/actions/links";
import {
  ENTITY_LINK_ROLES,
  ENTITY_TYPES,
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
  options,
}: {
  entityType: EntityType;
  entityId: number;
  links: RelatedLinkView[];
  options: EntityOptionMap;
}) {
  const linkTargets = ENTITY_TYPES.flatMap((type) =>
    options[type]
      .filter((row) => !(type === entityType && row.id === entityId))
      .map((row) => ({
        type,
        id: row.id,
        label: `${entityTypeLabel(type)}: ${row.label}`,
      })),
  );

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

      <form
        action={createEntityLink.bind(null, entityType, entityId)}
        className="grid max-w-3xl gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4 sm:grid-cols-2"
      >
        <Field label="Link to">
          <select className={inputClassName} name="toRef" required defaultValue="">
            <option value="">Select record…</option>
            {linkTargets.map((target) => (
              <option
                key={`${target.type}-${target.id}`}
                value={`${target.type}:${target.id}`}
              >
                {target.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role">
          <select className={inputClassName} name="role" defaultValue="related">
            {ENTITY_LINK_ROLES.map((role) => (
              <option key={role} value={role}>
                {labelize(role)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Link notes">
          <input className={inputClassName} name="notes" placeholder="Optional" />
        </Field>
        <div className="flex items-end">
          <SubmitButton>Add link</SubmitButton>
        </div>
      </form>
    </Section>
  );
}
