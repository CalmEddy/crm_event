import { Field } from "@/components/ui";
import type { User } from "@/db";

export function AssigneePicker({
  users,
  selectedIds = [],
  name = "assigneeIds",
}: {
  users: User[];
  selectedIds?: number[];
  name?: string;
}) {
  const selected = new Set(selectedIds);

  return (
    <Field
      label="Assignees"
      hint="Staff notified when this record changes or tasks come due."
    >
      {users.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">
          No active users. Add staff under Users first.
        </p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-soft)] p-3">
          {users.map((user) => (
            <li key={user.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--ink)]">
                <input
                  type="checkbox"
                  name={name}
                  value={user.id}
                  defaultChecked={selected.has(user.id)}
                  className="size-4 accent-[color:var(--accent)]"
                />
                <span>
                  {user.name}
                  <span className="ml-1 text-[color:var(--muted)]">
                    ({user.email})
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}
