"use server";

import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getIdentity } from "../../../cursor/identity";
import { getDb, users } from "@/db";
import { LOCAL_USER_COOKIE } from "@/lib/local-session";

/**
 * Local sign-in: choose which staff member this browser is.
 *
 * Only a local server has a simulated viewer, so these do nothing on a
 * published app, where each person is signed in by Cursor.
 */
async function requireLocalServer() {
  const identity = await getIdentity(await headers());
  if (!identity.verified || !identity.simulated) {
    throw new Error("Choosing a staff member is only available on a local server.");
  }
  return identity;
}

async function setLocalUser(id: number) {
  (await cookies()).set(LOCAL_USER_COOKIE, String(id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function signInAs(userId: number) {
  await requireLocalServer();
  const db = await getDb({ system: true });
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.active, true)));
  if (!user) redirect("/sign-in");
  await setLocalUser(user.id);
  redirect("/");
}

/** First run with an empty staff list: create a staff row for the local viewer. */
export async function signInAsFirstUser() {
  const identity = await requireLocalServer();
  const email = identity.email.trim().toLowerCase() || "dev@example.com";
  const db = await getDb({ system: true });
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  const user =
    existing ??
    (
      await db
        .insert(users)
        .values({ name: identity.name.trim() || "Dev Viewer", email, active: true })
        .returning()
    )[0];
  if (!user) redirect("/sign-in");
  if (!user.active) {
    await db.update(users).set({ active: true }).where(eq(users.id, user.id));
  }
  await setLocalUser(user.id);
  redirect("/");
}

export async function signOut() {
  await requireLocalServer();
  (await cookies()).delete(LOCAL_USER_COOKIE);
  redirect("/sign-in");
}
