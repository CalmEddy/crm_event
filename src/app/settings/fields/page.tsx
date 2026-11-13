import { connection } from "next/server";
import { PageHeader, Section, inputClassName } from "@/components/ui";
import type { EntityType } from "@/db";
import { ensureSeedData } from "@/db/seed";
import { deleteCustomField, updateCustomFieldOptions } from "@/lib/actions/custom-fields";
import { listCustomFields } from "@/lib/custom-fields";
import { CUSTOM_FIELD_TYPES } from "@/lib/custom-fields-shared";
import { VIEW_CONFIGS } from "@/lib/views/fields";
import { DeleteFieldButton, NewFieldForm } from "./forms";

const ENTITIES: EntityType[] = ["event", "task", "contact", "organization"];

export default async function CustomFieldsPage() {
  await connection();
  await ensureSeedData();
  const lists = await Promise.all(ENTITIES.map((entity) => listCustomFields(entity)));

  return (
    <div className="space-y-10">
      <PageHeader
        title="Custom fields"
        description="Add your own fields to events, tasks, contacts and organizations. They appear as columns, filters, board options and CSV columns."
      />
      {ENTITIES.map((entity, index) => {
        const config = VIEW_CONFIGS[entity];
        const fields = lists[index];
        return (
          <Section key={entity} title={config.pluralLabel}>
            <div className="space-y-4 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
              {fields.length === 0 ? (
                <p className="text-sm text-[color:var(--muted)]">No custom fields yet.</p>
              ) : (
                <ul className="divide-y divide-[color:var(--line)]">
                  {fields.map((field) => (
                    <li key={field.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <form
                        action={updateCustomFieldOptions.bind(null, field.id)}
                        className="flex flex-1 flex-wrap items-start gap-2"
                      >
                        <input
                          name="label"
                          defaultValue={field.label}
                          aria-label="Field name"
                          className={`${inputClassName} max-w-56`}
                        />
                        <span className="self-center rounded-md bg-[color:var(--panel-soft)] px-2 py-0.5 text-xs">
                          {CUSTOM_FIELD_TYPES[field.type]}
                        </span>
                        {field.type === "select" ? (
                          <textarea
                            name="options"
                            defaultValue={field.options.join("\n")}
                            aria-label={`${field.label} choices, one per line`}
                            rows={Math.min(5, field.options.length)}
                            className={`${inputClassName} max-w-56`}
                          />
                        ) : null}
                        <button type="submit" className="self-center text-sm text-[color:var(--accent)]">
                          Save
                        </button>
                      </form>
                      <DeleteFieldButton action={deleteCustomField.bind(null, field.id)} label={field.label} />
                    </li>
                  ))}
                </ul>
              )}
              <NewFieldForm entity={entity} />
            </div>
          </Section>
        );
      })}
    </div>
  );
}
