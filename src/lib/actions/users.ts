"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, users } from "@/db";
import { requireSignedIn } from "@/lib/auth";
import { LOCAL_USER_COOKIE } from "@/lib/local-session";
import { isUniqueViolation } from "@/lib/db-errors";

export type UserActionState = {
  error?: string;
};

function readUserFields(formData: FormData):
  | { ok: true; name: string; email: string; active: boolean }
  | { ok: false; error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const activeRaw = String(formData.get("active") ?? "true");
  const active = activeRaw === "true" || activeRaw === "on" || activeRaw === "1";

  if (!name) return { ok: false, error: "Name is required" };
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Valid email is required" };
  }

  return { ok: true, name, email, active };
}

function toActionError(error: unknown): UserActionState {
  if (error instanceof Error && error.message) {
    return { error: error.message };
  }
  return { error: "Something went wrong. Please try again." };
}

export async function createUser(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  let createdId: number | null = null;

  try {
    await requireSignedIn();
    const fields = readUserFields(formData);
    if (!fields.ok) return { error: fields.error };

    const db = await getDb();

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, fields.email))
      .limit(1);
    if (existing) {
      return {
        error:
          "A staff user with that email already exists. Open Users and edit them instead.",
      };
    }

    const inserted = await db
      .insert(users)
      .values({
        name: fields.name,
        email: fields.email,
        active: fields.active,
      })
      .returning();
    const row = inserted[0];
    if (!row) return { error: "Could not create user" };
    createdId = row.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        error:
          "A staff user with that email already exists. Open Users and edit them instead.",
      };
    }
    console.error("createUser failed", error);
    return toActionError(error);
  }

  revalidatePath("/users");
  revalidatePath("/", "layout");
  redirect(`/users/${createdId}/edit`);
}

export async function updateUser(
  id: number,
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    await requireSignedIn();
    const fields = readUserFields(formData);
    if (!fields.ok) return { error: fields.error };

    const db = await getDb();

    const [emailTaken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, fields.email))
      .limit(1);
    if (emailTaken && emailTaken.id !== id) {
      return { error: "Another staff user already uses that email." };
    }

    await db
      .update(users)
      .set({
        name: fields.name,
        email: fields.email,
        active: fields.active,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Another staff user already uses that email." };
    }
    console.error("updateUser failed", error);
    return toActionError(error);
  }

  revalidatePath("/users");
  revalidatePath(`/users/${id}/edit`);
  revalidatePath("/", "layout");
  redirect(`/users/${id}/edit`);
}

export async function deleteUser(id: number) {
  try {
    await requireSignedIn();
    const db = await getDb();
    await db.delete(users).where(eq(users.id, id));
    // Deleting the staff member this browser is signed in as (local server) signs it out.
    const jar = await cookies();
    if (jar.get(LOCAL_USER_COOKIE)?.value === String(id)) jar.delete(LOCAL_USER_COOKIE);
  } catch (error) {
    console.error("deleteUser failed", error);
    throw new Error(
      error instanceof Error ? error.message : "Could not delete user",
    );
  }

  revalidatePath("/users");
  revalidatePath("/", "layout");
  redirect("/users");
}
