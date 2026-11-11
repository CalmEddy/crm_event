import {
  Field,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import type { Event, Organization } from "@/db";
import { EVENT_STATUSES, labelize } from "@/lib/constants";
import { toDateTimeLocalValue } from "@/lib/format";

export function EventForm({
  action,
  event,
  organizations,
}: {
  action: (formData: FormData) => Promise<void>;
  event?: Event;
  organizations: Organization[];
}) {
  return (
    <form
      action={action}
      className="max-w-xl space-y-4 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-5"
    >
      <Field label="Title">
        <input
          className={inputClassName}
          name="title"
          required
          defaultValue={event?.title ?? ""}
        />
      </Field>
      <Field label="Starts at">
        <input
          className={inputClassName}
          name="startsAt"
          type="datetime-local"
          required
          defaultValue={toDateTimeLocalValue(event?.startsAt)}
        />
      </Field>
      <Field label="Status">
        <select
          className={inputClassName}
          name="status"
          defaultValue={event?.status ?? "inquiry"}
        >
          {EVENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {labelize(status)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Venue">
        <input
          className={inputClassName}
          name="venue"
          defaultValue={event?.venue ?? ""}
        />
      </Field>
      <Field label="Location">
        <input
          className={inputClassName}
          name="location"
          defaultValue={event?.location ?? ""}
        />
      </Field>
      <Field label="Venue organization">
        <select
          className={inputClassName}
          name="venueOrganizationId"
          defaultValue={event?.venueOrganizationId?.toString() ?? ""}
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
          defaultValue={event?.notes ?? ""}
        />
      </Field>
      <SubmitButton>{event ? "Save event" : "Create event"}</SubmitButton>
    </form>
  );
}
