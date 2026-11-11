import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[color:var(--ink)] sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[color:var(--muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
}) {
  const styles =
    variant === "primary"
      ? "bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-strong)]"
      : variant === "danger"
        ? "bg-[color:var(--danger)] text-white hover:opacity-90"
        : "border border-[color:var(--line)] bg-white text-[color:var(--ink)] hover:bg-[color:var(--panel-soft)]";
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium transition ${styles}`}
    >
      {children}
    </Link>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
}) {
  const styles =
    variant === "primary"
      ? "bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-strong)]"
      : variant === "danger"
        ? "bg-[color:var(--danger)] text-white hover:opacity-90"
        : "border border-[color:var(--line)] bg-white text-[color:var(--ink)] hover:bg-[color:var(--panel-soft)]";
  return (
    <button
      type="submit"
      className={`inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium transition ${styles}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[color:var(--line)] bg-[color:var(--panel)] px-6 py-12 text-center">
      <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--muted)]">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Field({
  label,
  name,
  children,
  hint,
}: {
  label: string;
  name?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-[color:var(--ink)]">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-[color:var(--muted)]">{hint}</span> : null}
      {name ? <span className="sr-only">{name}</span> : null}
    </label>
  );
}

export const inputClassName =
  "w-full rounded-md border border-[color:var(--line)] bg-white px-3 py-2 text-sm text-[color:var(--ink)] outline-none ring-[color:var(--accent)] placeholder:text-[color:var(--muted)] focus:ring-2";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-md bg-[color:var(--panel-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--ink)]">
      {children}
    </span>
  );
}

export function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-[color:var(--line)] bg-[color:var(--panel-soft)] text-[color:var(--muted)]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="border-b border-[color:var(--line)] last:border-0"
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
