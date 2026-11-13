import Link from "next/link";
import { Section } from "@/components/ui";
import type { EntityType } from "@/db";
import { listCustomFields, loadCustomValues } from "@/lib/custom-fields";
import { toFieldDef } from "@/lib/custom-fields-shared";
import { CustomFieldsEditor } from "./custom-fields-editor";

/** Custom field values on a record's detail page, edited in place. */
export async function CustomFieldsPanel({ entity, id }: { entity: EntityType; id: number }) {
  const fields = await listCustomFields(entity);
  if (fields.length === 0) return null;
  const values = (await loadCustomValues(entity, [id])).get(id) ?? {};
  return (
    <Section
      title="Custom fields"
      actions={
        <Link href="/settings/fields" className="text-sm text-[color:var(--accent)]">
          Manage
        </Link>
      }
    >
      <CustomFieldsEditor entity={entity} id={id} fields={fields.map(toFieldDef)} values={values} />
    </Section>
  );
}
