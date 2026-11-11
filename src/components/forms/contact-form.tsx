import {
  Field,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import type { Contact, Organization } from "@/db";

export function ContactForm({
  action,
  contact,
  organizations,
}: {
  action: (formData: FormData) => Promise<void>;
  contact?: Contact;
  organizations: Organization[];
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
          defaultValue={contact?.name ?? ""}
        />
      </Field>
      <Field label="Email">
        <input
          className={inputClassName}
          name="email"
          type="email"
          defaultValue={contact?.email ?? ""}
        />
      </Field>
      <Field label="Phone">
        <input
          className={inputClassName}
          name="phone"
          defaultValue={contact?.phone ?? ""}
        />
      </Field>
      <Field label="Role / title">
        <input
          className={inputClassName}
          name="role"
          defaultValue={contact?.role ?? ""}
        />
      </Field>
      <Field label="Organization">
        <select
          className={inputClassName}
          name="organizationId"
          defaultValue={contact?.organizationId?.toString() ?? ""}
        >
          <option value="">None</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notes">
        <textarea
          className={inputClassName}
          name="notes"
          rows={4}
          defaultValue={contact?.notes ?? ""}
        />
      </Field>
      <SubmitButton>{contact ? "Save contact" : "Create contact"}</SubmitButton>
    </form>
  );
}
