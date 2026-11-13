import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import {
  getIdentity,
  requireIdentity,
  IdentityError,
  type VerifiedIdentity,
} from "../../cursor/identity";
import { getDb, users, type User } from "@/db";

/** Require a signed-in Cursor viewer (throws IdentityError / 401). */
export async function requireSignedIn(): Promise<VerifiedIdentity> {
  const h = await headers();
  return requireIdentity(h, { onFailure: "throw" });
}

/** Soft read for UI (nav / layout). */
export async function getViewer(): Promise<VerifiedIdentity | null> {
  const h = await headers();
  const identity = await getIdentity(h);
  return identity.verified ? identity : null;
}

/**
 * Map the signed-in Cursor person to a staff user row (by email).
 * Creates an active staff user on first visit when email is present.
 */
export async function resolveStaffUser(
  identity: VerifiedIdentity,
): Promise<User | null> {
  if (identity.kind !== "person") return null;
  const email = identity.email.trim().toLowerCase();
  if (!email) return null;

  const db = await getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));
  if (existing) return existing;

  const name =
    identity.name.trim() ||
    email.split("@")[0] ||
    "Staff";
  const [created] = await db
    .insert(users)
    .values({ name, email, active: true })
    .returning();
  return created ?? null;
}

export async function requireStaffActor(): Promise<{
  identity: VerifiedIdentity;
  staff: User | null;
}> {
  const identity = await requireSignedIn();
  const staff = await resolveStaffUser(identity);
  return { identity, staff };
}

export function isAuthError(error: unknown): error is IdentityError {
  return error instanceof IdentityError;
}
