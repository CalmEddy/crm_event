import { AssigneePicker } from "@/components/forms/assignee-picker";
import {
  Field,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import type { Contact, Event, Task, User } from "@/db";
import {
  TASK_KINDS,
  TASK_STATUSES,
  labelize,
} from "@/lib/constants";
import { toDateInputValue } from "@/lib/format";

export function TaskForm({
  action,
  task,
  events,
  contacts,
  users = [],
  assigneeIds = [],
}: {
  action: (formData: FormData) => Promise<void>;
  task?: Task;
  events: Event[];
  contacts: Contact[];
  users?: User[];
  assigneeIds?: number[];
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
          defaultValue={task?.title ?? ""}
        />
      </Field>
      <Field label="Kind">
        <select
          className={inputClassName}
          name="kind"
          defaultValue={task?.kind ?? "other"}
        >
          {TASK_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {labelize(kind)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select
          className={inputClassName}
          name="status"
          defaultValue={task?.status ?? "todo"}
        >
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {labelize(status)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Due on">
        <input
          className={inputClassName}
          name="dueOn"
          type="date"
          required
          defaultValue={toDateInputValue(task?.dueOn)}
        />
      </Field>
      <Field label="Event">
        <select
          className={inputClassName}
          name="eventId"
          defaultValue={task?.eventId?.toString() ?? ""}
        >
          <option value="">None</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Contact">
        <select
          className={inputClassName}
          name="contactId"
          defaultValue={task?.contactId?.toString() ?? ""}
        >
          <option value="">None</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notes">
        <textarea
          className={inputClassName}
          name="notes"
          rows={3}
          defaultValue={task?.notes ?? ""}
        />
      </Field>
      <AssigneePicker users={users} selectedIds={assigneeIds} />
      <SubmitButton>{task ? "Save task" : "Create task"}</SubmitButton>
    </form>
  );
}
