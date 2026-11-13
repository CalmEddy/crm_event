import Link from "next/link";
import { getViewer, resolveStaffUser } from "@/lib/auth";

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
  { href: "/settings/tags", label: "Tags" },
  { href: "/settings/fields", label: "Fields" },
];

export async function Nav() {
  const viewer = await getViewer();
  const staff = viewer ? await resolveStaffUser(viewer).catch(() => null) : null;
  const label =
    staff?.name ||
    (viewer?.kind === "person" ? viewer.name || viewer.email : null) ||
    null;

  return (
    <header className="border-b border-[color:var(--line)] bg-[color:var(--panel)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[color:var(--ink)]">
          Greenroom
        </Link>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
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
          {label ? (
            <p className="text-xs text-[color:var(--muted)]">
              <kbd className="mr-2 rounded border border-[color:var(--line)] px-1 font-sans">Ctrl K</kbd>
              Signed in as{" "}
              <span className="text-[color:var(--ink)]">{label}</span>
              {staff?.email ? ` · ${staff.email}` : ""}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
