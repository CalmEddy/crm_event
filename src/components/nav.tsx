import Link from "next/link";
import { setCurrentUser } from "@/lib/actions/users";
import {
  getCurrentUser,
  listActiveUsers,
} from "@/lib/current-user";
import { inputClassName } from "@/components/ui";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/inbound", label: "Inbound" },
  { href: "/contacts", label: "Contacts" },
  { href: "/organizations", label: "Organizations" },
  { href: "/tasks", label: "Tasks" },
  { href: "/notes", label: "Notes" },
  { href: "/task-groups", label: "Task groups" },
  { href: "/users", label: "Users" },
];

export async function Nav() {
  const [activeUsers, currentUser] = await Promise.all([
    listActiveUsers().catch(() => []),
    getCurrentUser().catch(() => null),
  ]);

  return (
    <header className="border-b border-[color:var(--line)] bg-[color:var(--panel)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[color:var(--ink)]">
          Greenroom
        </Link>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[color:var(--muted)]">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-[color:var(--ink)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <form
            action={setCurrentUser}
            className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--muted)]"
          >
            <label htmlFor="act-as-user" className="shrink-0">
              Act as
            </label>
            <select
              id="act-as-user"
              name="userId"
              className={`${inputClassName} min-w-[12rem] py-1.5`}
              defaultValue={currentUser?.id?.toString() ?? ""}
            >
              <option value="">Nobody</option>
              {activeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-3 py-1.5 text-[color:var(--ink)] transition hover:border-[color:var(--ink)]"
            >
              Set
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
