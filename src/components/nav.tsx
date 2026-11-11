import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/contacts", label: "Contacts" },
  { href: "/organizations", label: "Organizations" },
  { href: "/tasks", label: "Tasks" },
  { href: "/task-groups", label: "Task groups" },
];

export function Nav() {
  return (
    <header className="border-b border-[color:var(--line)] bg-[color:var(--panel)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[color:var(--ink)]">
          Greenroom
        </Link>
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
      </div>
    </header>
  );
}
