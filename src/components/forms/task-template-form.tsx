import {
  Field,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import type { TaskTemplate } from "@/db";
import { TASK_KINDS, labelize } from "@/lib/constants";
import { parseOffsetDays } from "@/lib/offsets";

export function TaskTemplateForm({
  action,
  template,
  submitLabel = "Add template",
}: {
  action: (formData: FormData) => Promise<void>;
  template?: TaskTemplate;
  submitLabel?: string;
}) {
  const parsed = parseOffsetDays(template?.offsetDays ?? -14);

  return (
    <form
      action={action}
      className="grid gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4 sm:grid-cols-2"
    >
      <Field label="Title">
        <input
          className={inputClassName}
          name="title"
          required
          defaultValue={template?.title ?? ""}
        />
      </Field>
      <Field label="Kind">
        <select
          className={inputClassName}
          name="kind"
          defaultValue={template?.kind ?? "call"}
        >
          {TASK_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {labelize(kind)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Amount" hint="Friendly offset → stored as offsetDays">
        <input
          className={inputClassName}
          name="amount"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={parsed.amount}
        />
      </Field>
      <Field label="Unit">
        <select className={inputClassName} name="unit" defaultValue={parsed.unit}>
          <option value="days">Days</option>
          <option value="weeks">Weeks</option>
          <option value="months">Months (30-day)</option>
        </select>
      </Field>
      <Field label="When">
        <select
          className={inputClassName}
          name="direction"
          defaultValue={parsed.direction}
        >
          <option value="before">Before event</option>
          <option value="after">After event</option>
          <option value="on">On event day</option>
        </select>
      </Field>
      <div className="flex items-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
