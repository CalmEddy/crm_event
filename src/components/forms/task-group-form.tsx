import {
  Field,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import type { TaskGroup } from "@/db";

export function TaskGroupForm({
  action,
  group,
}: {
  action: (formData: FormData) => Promise<void>;
  group?: TaskGroup;
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
          defaultValue={group?.name ?? ""}
        />
      </Field>
      <Field label="Description">
        <textarea
          className={inputClassName}
          name="description"
          rows={3}
          defaultValue={group?.description ?? ""}
        />
      </Field>
      <SubmitButton>{group ? "Save group" : "Create group"}</SubmitButton>
    </form>
  );
}
