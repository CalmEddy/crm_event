// Client-safe custom field definitions.
import type { FieldDef } from "@/lib/views/fields";
import { CUSTOM_PREFIX } from "@/lib/views/fields";

export const CUSTOM_FIELD_TYPES = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  checkbox: "Yes / no",
} as const;
export type CustomFieldType = keyof typeof CUSTOM_FIELD_TYPES;

export type CustomFieldDef = {
  id: number;
  label: string;
  type: CustomFieldType;
  options: string[];
};

export function splitOptions(raw: string): string[] {
  return [...new Set(raw.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean))].slice(0, 50);
}

/** Map a custom field onto the DataView field model. */
export function toFieldDef(field: CustomFieldDef): FieldDef {
  const key = `${CUSTOM_PREFIX}${field.id}`;
  switch (field.type) {
    case "date":
      return { key, label: field.label, type: "date", editable: true };
    case "select":
      return {
        key,
        label: field.label,
        type: "enum",
        editable: true,
        options: field.options.map((value) => ({ value, label: value })),
      };
    case "checkbox":
      return {
        key,
        label: field.label,
        type: "enum",
        editable: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      };
    default:
      return { key, label: field.label, type: "text", editable: true };
  }
}
