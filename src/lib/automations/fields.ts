// Client-safe field catalog for automation conditions and update actions.
import type { EntityType } from "@/db/schema";
import {
  EVENT_STATUSES,
  ORGANIZATION_TYPES,
  TASK_KINDS,
  TASK_STATUSES,
  labelize,
} from "@/lib/constants";
import type { CustomFieldDef } from "@/lib/custom-fields-shared";
import { CUSTOM_PREFIX, isCustomKey } from "@/lib/views/fields";

export type AutomationFieldType =
  | "text"
  | "enum"
  | "date"
  | "datetime"
  | "number"
  | "checkbox";

export type AutomationFieldDef = {
  key: string;
  /** DB / snapshot column name (camelCase, matching Drizzle), or cf_<id> for custom. */
  column: string;
  label: string;
  type: AutomationFieldType;
  options?: readonly { value: string; label: string }[];
  /** Can be set by an update_record action. */
  writable?: boolean;
  /** Can be used as a date_offset trigger field. */
  dateOffset?: boolean;
  /** True when this is a custom_fields row. */
  custom?: boolean;
};

function opts(values: readonly string[]) {
  return values.map((value) => ({ value, label: labelize(value) }));
}

export const AUTOMATION_FIELDS: Record<EntityType, AutomationFieldDef[]> = {
  event: [
    { key: "title", column: "title", label: "Title", type: "text", writable: true },
    { key: "status", column: "status", label: "Status", type: "enum", options: opts(EVENT_STATUSES), writable: true },
    { key: "startsAt", column: "startsAt", label: "Starts", type: "datetime", writable: true, dateOffset: true },
    { key: "venue", column: "venue", label: "Venue", type: "text", writable: true },
    { key: "location", column: "location", label: "Location", type: "text", writable: true },
    { key: "notes", column: "notes", label: "Notes", type: "text", writable: true },
  ],
  task: [
    { key: "title", column: "title", label: "Title", type: "text", writable: true },
    { key: "status", column: "status", label: "Status", type: "enum", options: opts(TASK_STATUSES), writable: true },
    { key: "kind", column: "kind", label: "Kind", type: "enum", options: opts(TASK_KINDS), writable: true },
    { key: "dueOn", column: "dueOn", label: "Due", type: "date", writable: true, dateOffset: true },
  ],
  contact: [
    { key: "name", column: "name", label: "Name", type: "text", writable: true },
    { key: "role", column: "role", label: "Role", type: "text", writable: true },
    { key: "email", column: "email", label: "Email", type: "text", writable: true },
    { key: "phone", column: "phone", label: "Phone", type: "text", writable: true },
    { key: "city", column: "city", label: "City", type: "text", writable: true },
    { key: "notes", column: "notes", label: "Notes", type: "text", writable: true },
  ],
  organization: [
    { key: "name", column: "name", label: "Name", type: "text", writable: true },
    { key: "type", column: "type", label: "Type", type: "enum", options: opts(ORGANIZATION_TYPES), writable: true },
    { key: "city", column: "city", label: "City", type: "text", writable: true },
    { key: "email", column: "email", label: "Email", type: "text", writable: true },
    { key: "phone", column: "phone", label: "Phone", type: "text", writable: true },
    { key: "notes", column: "notes", label: "Notes", type: "text", writable: true },
  ],
};

export function customFieldToAutomation(field: CustomFieldDef): AutomationFieldDef {
  const key = `${CUSTOM_PREFIX}${field.id}`;
  const base = {
    key,
    column: key,
    label: field.label,
    writable: true as const,
    custom: true as const,
  };
  switch (field.type) {
    case "date":
      return { ...base, type: "date", dateOffset: true };
    case "number":
      return { ...base, type: "number" };
    case "select":
      return {
        ...base,
        type: "enum",
        options: field.options.map((value) => ({ value, label: value })),
      };
    case "checkbox":
      return {
        ...base,
        type: "checkbox",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      };
    default:
      return { ...base, type: "text" };
  }
}

export function fieldsForEntity(
  entity: EntityType,
  custom: CustomFieldDef[] = [],
): AutomationFieldDef[] {
  return [
    ...AUTOMATION_FIELDS[entity],
    ...custom.map(customFieldToAutomation),
  ];
}

export function fieldByKey(
  entity: EntityType,
  key: string,
  custom: CustomFieldDef[] = [],
): AutomationFieldDef | undefined {
  return fieldsForEntity(entity, custom).find(
    (f) => f.key === key || f.column === key,
  );
}

export function dateOffsetFields(
  entity: EntityType,
  custom: CustomFieldDef[] = [],
) {
  return fieldsForEntity(entity, custom).filter((f) => f.dateOffset);
}

export function parseCustomFieldId(key: string): number | null {
  if (!isCustomKey(key)) return null;
  const id = Number(key.slice(CUSTOM_PREFIX.length));
  return Number.isInteger(id) && id > 0 ? id : null;
}
