import { asc, eq } from "drizzle-orm";
import { getDb, users, type User } from "@/db";
import { getViewer, resolveStaffUser } from "@/lib/auth";

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

/** Staff user linked to the signed-in Cursor viewer (no impersonation cookie). */
export async function getCurrentUser(): Promise<User | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  return resolveStaffUser(viewer);
}

export async function getCurrentUserId(): Promise<number | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}
