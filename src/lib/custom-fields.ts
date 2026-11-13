// Server-side custom field storage. Not a "use server" module.
import { and, asc, eq, inArray } from "drizzle-orm";
import { customFields, customValues, getDb, type EntityType } from "@/db";
import { logActivity, snapshot, titleOf } from "@/lib/activity";
import {
  CUSTOM_FIELD_TYPES,
  splitOptions,
  toFieldDef,
  type CustomFieldDef,
  type CustomFieldType,
} from "@/lib/custom-fields-shared";
import { FieldError } from "@/lib/records";
import {
  CUSTOM_PREFIX,
  VIEW_CONFIGS,
  isCustomKey,
  withCustomFields,
  type EntityViewConfig,
} from "@/lib/views/fields";

export async function listCustomFields(entity: EntityType): Promise<CustomFieldDef[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(customFields)
    .where(eq(customFields.entity, entity))
    .orderBy(asc(customFields.position), asc(customFields.id));
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    type: (row.type in CUSTOM_FIELD_TYPES ? row.type : "text") as CustomFieldType,
    options: splitOptions(row.options),
  }));
}

export async function loadEntityConfig(entity: EntityType): Promise<EntityViewConfig> {
  const fields = await listCustomFields(entity);
  return withCustomFields(VIEW_CONFIGS[entity], fields.map(toFieldDef));
}

/** entityId -> { cf_<id>: value } */
export async function loadCustomValues(
  entity: EntityType,
  ids?: number[],
): Promise<Map<number, Record<string, string>>> {
  const db = await getDb();
  const where = ids
    ? and(eq(customValues.entity, entity), inArray(customValues.entityId, ids.length ? ids : [0]))
    : eq(customValues.entity, entity);
  const rows = await db.select().from(customValues).where(where);
  const map = new Map<number, Record<string, string>>();
  for (const row of rows) {
    const values = map.get(row.entityId) ?? {};
    values[`${CUSTOM_PREFIX}${row.fieldId}`] = row.value;
    map.set(row.entityId, values);
  }
  return map;
}

function parseValue(field: CustomFieldDef, raw: string | null): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  switch (field.type) {
    case "number": {
      const n = Number(value.replace(/,/g, ""));
      if (!Number.isFinite(n)) throw new FieldError(`${field.label} must be a number`);
      return String(n);
    }
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
        throw new FieldError(`${field.label} must be a date (YYYY-MM-DD)`);
      }
      return value;
    case "select":
      if (!field.options.includes(value)) {
        const match = field.options.find((o) => o.toLowerCase() === value.toLowerCase());
        if (!match) throw new FieldError(`${field.label} must be one of: ${field.options.join(", ")}`);
        return match;
      }
      return value;
    case "checkbox": {
      const v = value.toLowerCase();
      if (["yes", "y", "true", "1", "x"].includes(v)) return "yes";
      if (["no", "n", "false", "0"].includes(v)) return "no";
      throw new FieldError(`${field.label} must be yes or no`);
    }
    default:
      if (value.length > 1000) throw new FieldError(`${field.label} is too long`);
      return value;
  }
}

/** Split an edit into built-in and custom parts; validates custom values. */
export async function splitCustomInput(
  entity: EntityType,
  input: Record<string, string | null>,
): Promise<{ standard: Record<string, string | null>; custom: Map<number, string | null> }> {
  const standard: Record<string, string | null> = {};
  const custom = new Map<number, string | null>();
  const keys = Object.keys(input);
  if (!keys.some(isCustomKey)) return { standard: input, custom };
  const fields = new Map((await listCustomFields(entity)).map((f) => [`${CUSTOM_PREFIX}${f.id}`, f]));
  for (const key of keys) {
    if (!isCustomKey(key)) {
      standard[key] = input[key];
      continue;
    }
    const field = fields.get(key);
    if (!field) throw new FieldError("That field no longer exists");
    custom.set(field.id, parseValue(field, input[key]));
  }
  return { standard, custom };
}

export async function writeCustomValues(
  entity: EntityType,
  ids: number[],
  custom: Map<number, string | null>,
) {
  if (custom.size === 0 || ids.length === 0) return;
  const db = await getDb();
  const fields = new Map((await listCustomFields(entity)).map((f) => [f.id, f]));
  const before = await loadCustomValues(entity, ids);
  for (const id of ids) {
    const changes: string[] = [];
    for (const [fieldId, value] of custom) {
      const old = before.get(id)?.[`${CUSTOM_PREFIX}${fieldId}`] ?? null;
      if (old === value) continue;
      if (value == null) {
        await db
          .delete(customValues)
          .where(and(eq(customValues.fieldId, fieldId), eq(customValues.entityId, id)));
      } else {
        await db
          .insert(customValues)
          .values({ fieldId, entity, entityId: id, value })
          .onConflictDoUpdate({
            target: [customValues.fieldId, customValues.entityId],
            set: { value },
          });
      }
      changes.push(`${fields.get(fieldId)?.label ?? "Field"}: ${old ?? "—"} → ${value ?? "—"}`);
    }
    if (changes.length) {
      await logActivity([
        {
          entity,
          entityId: id,
          action: "updated",
          label: titleOf(entity, await snapshot(entity, id)),
          detail: changes.join("; "),
        },
      ]);
    }
  }
}

export async function deleteCustomValuesFor(entity: EntityType, id: number) {
  const db = await getDb();
  await db
    .delete(customValues)
    .where(and(eq(customValues.entity, entity), eq(customValues.entityId, id)));
}
