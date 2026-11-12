import {
  Field,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import type { User } from "@/db";

export function UserForm({
  action,
  user,
}: {
  action: (formData: FormData) => Promise<void>;
  user?: User;
}) {
  return (
    <form
      action={action}
      className="max-w-xl space-y-4 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-5"
    >
      <Field label="Name">
        <input
          className={inputClassName}
          name="name"
          required
          defaultValue={user?.name ?? ""}
        />
      </Field>
      <Field label="Email">
        <input
          className={inputClassName}
          name="email"
          type="email"
          required
          defaultValue={user?.email ?? ""}
        />
      </Field>
      <Field label="Active" hint="Inactive users cannot be selected as current user or assignees.">
        <select
          className={inputClassName}
          name="active"
          defaultValue={user?.active === false ? "false" : "true"}
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </Field>
      <SubmitButton>{user ? "Save user" : "Create user"}</SubmitButton>
    </form>
  );
}
