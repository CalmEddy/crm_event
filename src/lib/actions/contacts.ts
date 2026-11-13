"use server";

import { logCreated, logDeleted, logUpdated, snapshot } from "@/lib/activity";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contacts, getDb } from "@/db";
import { deletePolymorphicRefsForEntity } from "@/lib/entities";
import { requireSignedIn } from "@/lib/auth";

function readContactFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const organizationRaw = String(formData.get("organizationId") ?? "").trim();
  const organizationId = organizationRaw ? Number(organizationRaw) : null;

  if (!name) throw new Error("Name is required");

  return {
    name,
    email,
    phone,
    role,
    notes,
    organizationId:
      organizationId && Number.isFinite(organizationId) ? organizationId : null,
  };
}

export async function createContact(formData: FormData) {
  await requireSignedIn();
  const fields = readContactFields(formData);
  const db = await getDb();
  const [row] = await db.insert(contacts).values(fields).returning();
  await logCreated("contact", row.id);
  revalidatePath("/contacts");
  redirect(`/contacts/${row.id}`);
}

export async function updateContact(id: number, formData: FormData) {
  await requireSignedIn();
  const fields = readContactFields(formData);
  const db = await getDb();
  const before = await snapshot("contact", id);
  await db
    .update(contacts)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(contacts.id, id));
  await logUpdated("contact", id, before);
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}`);
}

export async function deleteContact(id: number) {
  await requireSignedIn();
  await deletePolymorphicRefsForEntity({ type: "contact", id });
  const db = await getDb();
  await logDeleted("contact", id, await snapshot("contact", id));
  await db.delete(contacts).where(eq(contacts.id, id));
  revalidatePath("/contacts");
  revalidatePath("/notes");
  redirect("/contacts");
}
