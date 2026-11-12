import { cookies } from "next/headers";
import { and, asc, eq } from "drizzle-orm";
import { getDb, users, type User } from "@/db";

export const CURRENT_USER_COOKIE = "greenroom_user_id";

export async function listActiveUsers(): Promise<User[]> {
  const db = await getDb();
  return db
    .select()
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name));
}

export async function listUsers(): Promise<User[]> {
  const db = await getDb();
  return db.select().from(users).orderBy(asc(users.name));
}

export async function getCurrentUserId(): Promise<number | null> {
  const jar = await cookies();
  const raw = jar.get(CURRENT_USER_COOKIE)?.value;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

export async function getCurrentUser(): Promise<User | null> {
  const id = await getCurrentUserId();
  if (id == null) return null;
  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.active, true)));
  return user ?? null;
}

export async function setCurrentUserCookie(userId: number | null) {
  const jar = await cookies();
  if (userId == null) {
    jar.delete(CURRENT_USER_COOKIE);
    return;
  }
  jar.set(CURRENT_USER_COOKIE, String(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
