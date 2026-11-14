import { asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getIdentity } from "../../../cursor/identity";
import { SubmitButton } from "@/components/ui";
import { getDb, users } from "@/db";
import { ensureSeedData } from "@/db/seed";
import { signInAs, signInAsFirstUser } from "@/lib/actions/session";
import { getViewer, resolveStaffUser } from "@/lib/auth";

export default async function SignInPage() {
  await connection();
  const identity = await getIdentity(await headers());
  // A published app signs people in through Cursor; there is nothing to choose.
  if (!identity.verified || !identity.simulated) redirect("/");

  await ensureSeedData();
  const viewer = await getViewer();
  const current = viewer ? await resolveStaffUser(viewer) : null;
  const db = await getDb({ system: true });
  const staff = await db
    .select()
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name));

  return (
    <div className="mx-auto max-w-lg space-y-6 py-10">
      <div className="text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[color:var(--ink)]">
          Sign in to Greenroom
        </h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Choose who you are. This list appears only on a local server; the published app signs
          each person in with their Cursor account.
        </p>
      </div>

      {staff.length === 0 ? (
        <form action={signInAsFirstUser} className="text-center">
          <p className="mb-4 text-sm text-[color:var(--muted)]">There are no active staff yet.</p>
          <SubmitButton>Continue as {identity.name || "Dev Viewer"}</SubmitButton>
        </form>
      ) : (
        <ul className="divide-y divide-[color:var(--line)] overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
          {staff.map((user) => (
            <li key={user.id}>
              <form action={signInAs.bind(null, user.id)}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm transition hover:bg-[color:var(--panel-soft)]"
                >
                  <span>
                    <span className="block font-medium text-[color:var(--ink)]">{user.name}</span>
                    <span className="block text-xs text-[color:var(--muted)]">{user.email}</span>
                  </span>
                  <span className="text-xs text-[color:var(--muted)]">
                    {current?.id === user.id ? "Signed in" : "Sign in"}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
