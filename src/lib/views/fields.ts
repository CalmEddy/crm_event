// Client-safe field registry: describes each entity's columns for DataView.
import type { EntityType } from "@/db/schema";
import {
  EVENT_STATUSES,
  ORGANIZATION_TYPES,
  TASK_KINDS,
  TASK_STATUSES,
  labelize,
} from "@/lib/constants";

export type FieldType =
  | "text"
  | "date"
  | "datetime"
  | "enum"
  | "users"
  | "relation";

export type FieldOption = { value: string; label: string };

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  /** Enum choices (static). Relation/user choices come from the loader. */
  options?: readonly FieldOption[];
  /** Fields the board can drag between (server action whitelist mirrors this). */
  editable?: boolean;
  /** Hidden in the table until the user turns it on. */
  hiddenByDefault?: boolean;
};

export type EntityViewConfig = {
  entity: EntityType;
  label: string;
  pluralLabel: string;
  basePath: string;
  titleKey: string;
  /** Secondary line in list view. */
  subtitleKeys: string[];
  /** Date field used by the calendar view, if any. */
  calendarKey?: string;
  /** Enum field used by the board view by default, if any. */
  boardKey?: string;
  defaultSort: string;
  fields: FieldDef[];
};

function opts(values: readonly string[]): FieldOption[] {
  return values.map((value) => ({ value, label: labelize(value) }));
}

export const VIEW_CONFIGS: Record<EntityType, EntityViewConfig> = {
  task: {
    entity: "task",
    label: "Task",
    pluralLabel: "Tasks",
    basePath: "/tasks",
    titleKey: "title",
    subtitleKeys: ["dueOn", "event", "assignees"],
    calendarKey: "dueOn",
    boardKey: "status",
    defaultSort: "dueOn",
    fields: [
      { key: "title", label: "Task", type: "text" },
      { key: "dueOn", label: "Due", type: "date" },
      { key: "status", label: "Status", type: "enum", options: opts(TASK_STATUSES), editable: true },
      { key: "kind", label: "Kind", type: "enum", options: opts(TASK_KINDS), editable: true },
      { key: "assignees", label: "Assignees", type: "users" },
      { key: "event", label: "Event", type: "relation" },
      { key: "contact", label: "Contact", type: "relation", hiddenByDefault: true },
    ],
  },
  event: {
    entity: "event",
    label: "Event",
    pluralLabel: "Events",
    basePath: "/events",
    titleKey: "title",
    subtitleKeys: ["startsAt", "venue", "assignees"],
    calendarKey: "startsAt",
    boardKey: "status",
    defaultSort: "startsAt",
    fields: [
      { key: "title", label: "Event", type: "text" },
      { key: "startsAt", label: "When", type: "datetime" },
      { key: "venue", label: "Venue", type: "text" },
      { key: "location", label: "Location", type: "text", hiddenByDefault: true },
      { key: "status", label: "Status", type: "enum", options: opts(EVENT_STATUSES), editable: true },
      { key: "assignees", label: "Assignees", type: "users" },
    ],
  },
  contact: {
    entity: "contact",
    label: "Contact",
    pluralLabel: "Contacts",
    basePath: "/contacts",
    titleKey: "name",
    subtitleKeys: ["role", "organization", "email"],
    defaultSort: "name",
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "role", label: "Role", type: "text" },
      { key: "organization", label: "Organization", type: "relation" },
      { key: "email", label: "Email", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
    ],
  },
  organization: {
    entity: "organization",
    label: "Organization",
    pluralLabel: "Organizations",
    basePath: "/organizations",
    titleKey: "name",
    subtitleKeys: ["type", "city"],
    boardKey: "type",
    defaultSort: "name",
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "type", label: "Type", type: "enum", options: opts(ORGANIZATION_TYPES), editable: true },
      { key: "city", label: "City", type: "text" },
      { key: "address", label: "Address", type: "text", hiddenByDefault: true },
    ],
  },
};

export type Ref = { id: number; label: string };
export type CellValue = string | null | Ref | Ref[];
export type ViewRow = { id: number; values: Record<string, CellValue> };

export function fieldByKey(config: EntityViewConfig, key: string) {
  return config.fields.find((field) => field.key === key);
}

export function isEditableField(entity: EntityType, key: string) {
  const field = fieldByKey(VIEW_CONFIGS[entity], key);
  return Boolean(field?.editable && field.type === "enum");
}
