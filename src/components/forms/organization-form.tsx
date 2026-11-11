import {
  Field,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import { ORGANIZATION_TYPES, labelize } from "@/lib/constants";
import type { Organization } from "@/db";

export function OrganizationForm({
  action,
  organization,
}: {
  action: (formData: FormData) => Promise<void>;
  organization?: Organization;
}) {
  return (
    <form action={action} className="max-w-xl space-y-4 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
      <Field label="Name">
        <input
          className={inputClassName}
          name="name"
          required
          defaultValue={organization?.name ?? ""}
        />
      </Field>
      <Field label="Type">
        <select
          className={inputClassName}
          name="type"
          defaultValue={organization?.type ?? "club"}
        >
          {ORGANIZATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {labelize(type)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Address">
        <input
          className={inputClassName}
          name="address"
          defaultValue={organization?.address ?? ""}
        />
      </Field>
      <Field label="City">
        <input
          className={inputClassName}
          name="city"
          defaultValue={organization?.city ?? ""}
        />
      </Field>
      <Field label="Notes">
        <textarea
          className={inputClassName}
          name="notes"
          rows={4}
          defaultValue={organization?.notes ?? ""}
        />
      </Field>
      <SubmitButton>{organization ? "Save organization" : "Create organization"}</SubmitButton>
    </form>
  );
}
