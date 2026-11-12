"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, users } from "@/db";
import { setCurrentUserCookie } from "@/lib/current-user";

function readUserFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const activeRaw = String(formData.get("active") ?? "true");
  const active = activeRaw === "true" || activeRaw === "on" || activeRaw === "1";

  if (!name) throw new Error("Name is required");
  if (!email || !email.includes("@")) throw new Error("Valid email is required");

  return { name, email, active };
}

export async function setCurrentUser(formData: FormData) {
  const raw = String(formData.get("userId") ?? "").trim();
  if (!raw) {
    await setCurrentUserCookie(null);
  } else {
    const id = Number(raw);
    if (!Number.isFinite(id)) throw new Error("Invalid user");
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user || !user.active) throw new Error("User not found");
    await setCurrentUserCookie(user.id);
  }
  revalidatePath("/", "layout");
}

export async function createUser(formData: FormData) {
  const fields = readUserFields(formData);
  const db = await getDb();
  const [row] = await db.insert(users).values(fields).returning();
  revalidatePath("/users");
  revalidatePath("/", "layout");
  redirect(`/users/${row.id}/edit`);
}

export async function updateUser(id: number, formData: FormData) {
  const fields = readUserFields(formData);
  const db = await getDb();
  await db
    .update(users)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(users.id, id));
  revalidatePath("/users");
  revalidatePath(`/users/${id}/edit`);
  revalidatePath("/", "layout");
  redirect(`/users/${id}/edit`);
}

export async function deleteUser(id: number) {
  const db = await getDb();
  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/users");
  revalidatePath("/", "layout");
  redirect("/users");
}
