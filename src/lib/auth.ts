import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import {
  getIdentity,
  requireIdentity,
  IdentityError,
  type VerifiedIdentity,
} from "../../cursor/identity";
import { getDb, users, type User } from "@/db";
import { LOCAL_USER_COOKIE, parseLocalUserId } from "@/lib/local-session";

/** The staff member chosen on /sign-in (local servers only). */
async function localUserId(): Promise<number | null> {
  return parseLocalUserId((await cookies()).get(LOCAL_USER_COOKIE)?.value);
}

/** On a local server, nobody is signed in until a staff member is chosen. */
async function isSignedOutLocally(identity: VerifiedIdentity): Promise<boolean> {
  return identity.simulated && (await localUserId()) === null;
}

/** Require a signed-in viewer. */
export async function requireSignedIn(): Promise<VerifiedIdentity> {
  try {
    const h = await headers();
    const identity = await requireIdentity(h, { onFailure: "throw" });
    if (await isSignedOutLocally(identity)) {
      throw new Error("Sign in required to continue.");
    }
    return identity;
  } catch (error) {
    if (error instanceof IdentityError) {
      throw new Error("Sign in required to continue.");
    }
    throw error;
  }
}

/** Soft read for UI (nav / layout). */
export async function getViewer(): Promise<VerifiedIdentity | null> {
  const h = await headers();
  const identity = await getIdentity(h);
  if (!identity.verified) return null;
  return (await isSignedOutLocally(identity)) ? null : identity;
}

/**
 * Map the signed-in person to a staff user row.
 *
 * On a local server that is the staff member chosen on /sign-in. Otherwise:
 * The row is found by the account's stable id first, so editing a staff
 * member's name or email keeps them linked. A row that has never signed in
 * is claimed by email, and a row is created only when neither matches.
 */
export async function resolveStaffUser(
  identity: VerifiedIdentity,
): Promise<User | null> {
  if (identity.kind !== "person") return null;
  const db = await getDb({ system: true });

  if (identity.simulated) {
    const id = await localUserId();
    if (id === null) return null;
    const [chosen] = await db.select().from(users).where(eq(users.id, id));
    return chosen?.active ? chosen : null;
  }

  const email = identity.email.trim().toLowerCase();
  const sub = identity.sub;
  const [linked] = await db
    .select()
    .from(users)
    .where(eq(users.identitySub, sub));
  if (linked) return linked;
  if (!email) return null;

  const [byEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));
  if (byEmail) {
    if (byEmail.identitySub) return byEmail;
    const [claimed] = await db
      .update(users)
      .set({ identitySub: sub })
      .where(eq(users.id, byEmail.id))
      .returning();
    return claimed ?? byEmail;
  }

  const name =
    identity.name.trim() ||
    email.split("@")[0] ||
    "Staff";
  const [created] = await db
    .insert(users)
    .values({ name, email, active: true, identitySub: sub })
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
