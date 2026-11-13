"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, users } from "@/db";
import { requireSignedIn } from "@/lib/auth";

function readUserFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const activeRaw = String(formData.get("active") ?? "true");
  const active = activeRaw === "true" || activeRaw === "on" || activeRaw === "1";

  if (!name) throw new Error("Name is required");
  if (!email || !email.includes("@")) throw new Error("Valid email is required");

  return { name, email, active };
}

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    code === "23505" ||
    message.includes("users_email_idx") ||
    message.toLowerCase().includes("duplicate key")
  );
}

export async function createUser(formData: FormData) {
  await requireSignedIn();
  const fields = readUserFields(formData);
  const db = await getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, fields.email))
    .limit(1);
  if (existing) {
    throw new Error(
      "A staff user with that email already exists. Open Users and edit them instead.",
    );
  }

  let row: typeof users.$inferSelect;
  try {
    const inserted = await db.insert(users).values(fields).returning();
    row = inserted[0];
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error(
        "A staff user with that email already exists. Open Users and edit them instead.",
      );
    }
    throw error;
  }

  if (!row) throw new Error("Could not create user");

  revalidatePath("/users");
  revalidatePath("/", "layout");
  redirect(`/users/${row.id}/edit`);
}

export async function updateUser(id: number, formData: FormData) {
  await requireSignedIn();
  const fields = readUserFields(formData);
  const db = await getDb();

  const [emailTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, fields.email))
    .limit(1);
  if (emailTaken && emailTaken.id !== id) {
    throw new Error("Another staff user already uses that email.");
  }

  try {
    await db
      .update(users)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(users.id, id));
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Another staff user already uses that email.");
    }
    throw error;
  }

  revalidatePath("/users");
  revalidatePath(`/users/${id}/edit`);
  revalidatePath("/", "layout");
  redirect(`/users/${id}/edit`);
}

export async function deleteUser(id: number) {
  await requireSignedIn();
  const db = await getDb();
  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/users");
  revalidatePath("/", "layout");
  redirect("/users");
}
