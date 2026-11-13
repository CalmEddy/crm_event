"use server";

import { and, eq, max } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { customFields, getDb } from "@/db";
import { requireSignedIn } from "@/lib/auth";
import { CUSTOM_FIELD_TYPES, splitOptions, type CustomFieldType } from "@/lib/custom-fields-shared";
import { isEntityType } from "@/lib/entities";
import { VIEW_CONFIGS } from "@/lib/views/fields";

export type FieldFormState = { error?: string; ok?: boolean };

const schema = z.object({
  entity: z.string().refine(isEntityType, "Unknown record type"),
  label: z.string().trim().min(1, "Name is required").max(40, "Keep the name under 40 characters"),
  type: z.enum(Object.keys(CUSTOM_FIELD_TYPES) as [CustomFieldType, ...CustomFieldType[]]),
  options: z.string().max(2000),
});

export async function createCustomField(
  _prev: FieldFormState,
  formData: FormData,
): Promise<FieldFormState> {
  await requireSignedIn();
  const parsed = schema.safeParse({
    entity: formData.get("entity"),
    label: formData.get("label"),
    type: formData.get("type"),
    options: formData.get("options") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid field" };
  const { entity, label, type } = parsed.data;
  const options = splitOptions(parsed.data.options);
  if (type === "select" && options.length < 2) {
    return { error: "A dropdown needs at least two choices." };
  }
  const entityType = entity as keyof typeof VIEW_CONFIGS;
  const builtIn = VIEW_CONFIGS[entityType].fields.some((f) => f.label.toLowerCase() === label.toLowerCase());
  const db = await getDb();
  const existing = await db
    .select({ id: customFields.id })
    .from(customFields)
    .where(and(eq(customFields.entity, entityType), eq(customFields.label, label)));
  if (builtIn || existing.length) return { error: `There is already a "${label}" field.` };
  const [{ top }] = await db
    .select({ top: max(customFields.position) })
    .from(customFields)
    .where(eq(customFields.entity, entityType));
  await db.insert(customFields).values({
    entity: entityType,
    label,
    type,
    options: type === "select" ? options.join("\n") : "",
    position: (top ?? 0) + 1,
  });
  refresh();
  return { ok: true };
}

export async function updateCustomFieldOptions(id: number, formData: FormData) {
  await requireSignedIn();
  const label = String(formData.get("label") ?? "").trim().slice(0, 40);
  const options = splitOptions(String(formData.get("options") ?? ""));
  const db = await getDb();
  const [field] = await db.select().from(customFields).where(eq(customFields.id, id));
  if (!field) return;
  await db
    .update(customFields)
    .set({
      ...(label ? { label } : {}),
      ...(field.type === "select" && options.length >= 2 ? { options: options.join("\n") } : {}),
    })
    .where(eq(customFields.id, id));
  refresh();
}

export async function deleteCustomField(id: number) {
  await requireSignedIn();
  const db = await getDb();
  // Values go with it (ON DELETE CASCADE).
  await db.delete(customFields).where(eq(customFields.id, id));
  refresh();
}
