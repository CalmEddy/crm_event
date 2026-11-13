import { Field, inputClassName } from "@/components/ui";
import { CONTACT_INFO_FIELDS, type ContactInfoKey } from "@/lib/contact-info";

/** Email, phone, website and mailing address inputs, two per row. */
export function ContactInfoFields({
  keys,
  values,
}: {
  keys: readonly ContactInfoKey[];
  values?: Partial<Record<ContactInfoKey, string | null>>;
}) {
  const fields = CONTACT_INFO_FIELDS.filter((field) => keys.includes(field.name));
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="sr-only">Contact details</legend>
      {fields.map((field) => (
        <div key={field.name} className={field.name === "address" ? "sm:col-span-2" : undefined}>
          <Field label={field.label}>
            <input
              className={inputClassName}
              name={field.name}
              type={field.type}
              inputMode={field.name === "website" ? "url" : undefined}
              placeholder={field.name === "website" ? "example.com" : undefined}
              autoComplete={
                {
                  email: "email",
                  phone: "tel",
                  mobile: "tel",
                  website: "url",
                  address: "street-address",
                  city: "address-level2",
                  region: "address-level1",
                  postalCode: "postal-code",
                  country: "country-name",
                }[field.name]
              }
              defaultValue={values?.[field.name] ?? ""}
            />
          </Field>
        </div>
      ))}
    </fieldset>
  );
}
