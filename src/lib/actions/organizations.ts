"use server";

import { logCreated, logDeleted, logUpdated, snapshot } from "@/lib/activity";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, organizations } from "@/db";
import { ORGANIZATION_TYPES, type OrganizationType } from "@/lib/constants";
import { deletePolymorphicRefsForEntity } from "@/lib/entities";
import { requireSignedIn } from "@/lib/auth";
import { ORGANIZATION_KEYS, readContactInfo } from "@/lib/contact-info";

function readOrgFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "other") as OrganizationType;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) throw new Error("Name is required");
  if (!ORGANIZATION_TYPES.includes(type)) throw new Error("Invalid type");

  return { name, type, ...readContactInfo(formData, ORGANIZATION_KEYS), notes };
}

export async function createOrganization(formData: FormData) {
  await requireSignedIn();
  const fields = readOrgFields(formData);
  const db = await getDb();
  const [row] = await db.insert(organizations).values(fields).returning();
  await logCreated("organization", row.id);
  revalidatePath("/organizations");
  redirect(`/organizations/${row.id}`);
}

export async function updateOrganization(id: number, formData: FormData) {
  await requireSignedIn();
  const fields = readOrgFields(formData);
  const db = await getDb();
  const before = await snapshot("organization", id);
  await db
    .update(organizations)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(organizations.id, id));
  await logUpdated("organization", id, before);
  revalidatePath("/organizations");
  revalidatePath(`/organizations/${id}`);
  redirect(`/organizations/${id}`);
}

export async function deleteOrganization(id: number) {
  await requireSignedIn();
  await deletePolymorphicRefsForEntity({ type: "organization", id });
  const db = await getDb();
  await logDeleted("organization", id, await snapshot("organization", id));
  await db.delete(organizations).where(eq(organizations.id, id));
  revalidatePath("/organizations");
  revalidatePath("/notes");
  redirect("/organizations");
}
