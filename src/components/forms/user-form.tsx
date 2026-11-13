"use client";

import { useActionState } from "react";
import {
  Field,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import type { User } from "@/db";
import {
  createUser,
  updateUser,
  type UserActionState,
} from "@/lib/actions/users";

export function UserForm({
  user,
}: {
  user?: User;
}) {
  const action = user
    ? updateUser.bind(null, user.id)
    : createUser;

  const [state, formAction, pending] = useActionState<
    UserActionState,
    FormData
  >(action, {});

  return (
    <form
      action={formAction}
      className="max-w-xl space-y-4 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-5"
    >
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-[color:var(--danger)]"
        >
          {state.error}
        </p>
      ) : null}
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
      <Field
        label="Active"
        hint="Use a unique email. Your signed-in Cursor account is linked automatically on first visit."
      >
        <select
          className={inputClassName}
          name="active"
          defaultValue={user?.active === false ? "false" : "true"}
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </Field>
      <SubmitButton>
        {pending
          ? user
            ? "Saving…"
            : "Creating…"
          : user
            ? "Save user"
            : "Create user"}
      </SubmitButton>
    </form>
  );
}
