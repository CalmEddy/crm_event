/**
 * Smoke-test createUser duplicate handling against local PGlite.
 */
import { eq } from "drizzle-orm";
import { getDb, users } from "../src/db";
import { ensureSeedData } from "../src/db/seed";
import { isUniqueViolation } from "../src/lib/db-errors";

async function main() {
  process.env.DATABASE_URL = "";
  await ensureSeedData();
  const db = await getDb({ system: true });

  const email = `smoke-${Date.now()}@example.com`;

  const inserted = await db
    .insert(users)
    .values({ name: "Smoke User", email, active: true })
    .returning();
  if (!inserted[0]) throw new Error("insert returned no row");
  console.log("create ok", { id: inserted[0].id, email: inserted[0].email });

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!existing) throw new Error("expected existing row");

  let caught: unknown;
  try {
    await db.insert(users).values({ name: "Dup", email, active: true });
  } catch (error) {
    caught = error;
  }
  if (!caught) throw new Error("expected insert to throw on duplicate email");
  if (!isUniqueViolation(caught)) {
    throw new Error(
      `isUniqueViolation missed wrapped drizzle error: ${String(
        (caught as Error).message,
      ).slice(0, 160)}`,
    );
  }
  console.log("isUniqueViolation detected drizzle-wrapped 23505");

  console.log("smoke-create-user: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
