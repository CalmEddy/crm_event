import {
  Field,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import type { Contact, Organization } from "@/db";
import { CONTACT_KEYS } from "@/lib/contact-info";
import { ContactInfoFields } from "./contact-info-fields";


export function ContactForm({
  action,
  contact,
  organizations,
  defaultOrganizationId,
}: {
  /** Pre-selected organization for a new contact. */
  defaultOrganizationId?: number | null;
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
          defaultValue={(contact?.organizationId ?? defaultOrganizationId)?.toString() ?? ""}
        >
          <option value="">None</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </Field>
      <ContactInfoFields keys={CONTACT_KEYS} values={contact} />
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
