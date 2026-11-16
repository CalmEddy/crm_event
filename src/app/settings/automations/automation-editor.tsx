"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inputClassName } from "@/components/ui";
import {
  createAutomation,
  createAutomationTag,
  createAutomationTaskGroup,
  updateAutomation,
  deleteAutomation,
} from "@/lib/actions/automations";
import {
  fieldsForEntity,
  type AutomationFieldDef,
} from "@/lib/automations/fields";
import {
  ACTION_TYPE_LABELS,
  AUTOMATION_ENTITIES,
  CONDITION_OP_LABELS,
  CONDITION_OPS,
  TRIGGER_TYPE_LABELS,
  type AutomationAction,
  type AutomationCondition,
  type AutomationConditionGroup,
  type AutomationTrigger,
} from "@/lib/automations/rule-schema";
import { EVENT_LINK_ROLES, TASK_KINDS, TASK_STATUSES, labelize } from "@/lib/constants";
import type { CustomFieldDef } from "@/lib/custom-fields-shared";

type Option = { id: number; name: string };

type Props = {
  mode: "create" | "edit";
  automationId?: number;
  initial: {
    name: string;
    description: string;
    enabled: boolean;
    priority: number;
    requireApproval: boolean;
    rateLimitPerHour: number | null;
    timezone: string;
    trigger: AutomationTrigger;
    conditionGroups: AutomationConditionGroup[];
    actions: AutomationAction[];
  };
  taskGroups: Option[];
  tags: Option[];
  users: Option[];
  customFields: Record<(typeof AUTOMATION_ENTITIES)[number], CustomFieldDef[]>;
};

const ACTION_TYPES = Object.keys(ACTION_TYPE_LABELS) as AutomationAction["type"][];
const TRIGGER_TYPES = Object.keys(TRIGGER_TYPE_LABELS) as AutomationTrigger["type"][];

function defaultTrigger(
  type: AutomationTrigger["type"],
  entity: (typeof AUTOMATION_ENTITIES)[number],
  fields: AutomationFieldDef[],
): AutomationTrigger {
  switch (type) {
    case "record_created":
    case "record_updated":
    case "record_deleted":
      return { type, entity };
    case "field_changed":
      return {
        type,
        entity,
        field: fields.find((f) => f.key === "status")?.key ?? fields[0]?.key ?? "status",
        to: "",
      };
    case "schedule":
      return { type, entity, cadence: "daily", hour: 9 };
    case "date_offset":
      return {
        type,
        entity,
        field: fields.find((f) => f.dateOffset)?.key ?? "startsAt",
        offsetDays: -3,
      };
  }
}

function defaultAction(
  type: AutomationAction["type"],
  fields: AutomationFieldDef[],
): AutomationAction {
  switch (type) {
    case "update_record": {
      const field = fields.find((f) => f.writable) ?? fields[0];
      return { type, fields: { [field?.key ?? "status"]: field?.options?.[0]?.value ?? "" } };
    }
    case "create_task":
      return { type, title: "Follow up", kind: "follow_up", status: "todo", copyAssignees: true };
    case "create_contact":
      return { type, name: "{{title}} contact", role: "buyer", linkToEventAs: "buyer" };
    case "link_event_role":
      return { type, useTriggerContact: true, role: "buyer" };
    case "set_owners":
      return { type, userIds: [], mode: "add" };
    case "apply_task_group":
      return { type, taskGroupId: 0, mode: "add_missing" };
    case "assign_users":
      return { type, userIds: [], mode: "add" };
    case "add_tag":
      return { type };
    case "add_note":
      return { type, body: "Automation note for {{title}}" };
    case "notify":
      return {
        type,
        audience: "assignees",
        subject: "Automation: {{title}}",
        body: "An automation ran for {{title}}.",
      };
  }
}

export function AutomationEditor({
  mode,
  automationId,
  initial,
  taskGroups: initialGroups,
  tags: initialTags,
  users,
  customFields,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [priority, setPriority] = useState(initial.priority);
  const [requireApproval, setRequireApproval] = useState(initial.requireApproval);
  const [rateLimitPerHour, setRateLimitPerHour] = useState(
    initial.rateLimitPerHour == null ? "" : String(initial.rateLimitPerHour),
  );
  const [timezone, setTimezone] = useState(initial.timezone);
  const [trigger, setTrigger] = useState<AutomationTrigger>(initial.trigger);
  const [groups, setGroups] = useState<AutomationConditionGroup[]>(initial.conditionGroups);
  const [actions, setActions] = useState<AutomationAction[]>(initial.actions);
  const [tags, setTags] = useState(initialTags);
  const [taskGroups, setTaskGroups] = useState(initialGroups);

  const entity = trigger.entity;
  const fields = useMemo(
    () => fieldsForEntity(entity, customFields[entity] ?? []),
    [entity, customFields],
  );

  const save = () => {
    startTransition(async () => {
      setError(null);
      const payload = {
        name,
        description: description || null,
        enabled,
        priority,
        requireApproval,
        rateLimitPerHour: rateLimitPerHour === "" ? null : Number(rateLimitPerHour),
        timezone: timezone || "local",
        entity,
        trigger,
        conditions: groups,
        actions,
      };
      const result =
        mode === "create"
          ? await createAutomation(payload)
          : await updateAutomation(automationId!, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.id ? `/settings/automations/${result.id}` : "/settings/automations");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="text-sm text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}

      <section className="space-y-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Basics</h2>
        <label className="block space-y-1 text-sm">
          <span className="text-[color:var(--muted)]">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-[color:var(--muted)]">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={inputClassName}
          />
        </label>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enabled
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={requireApproval}
              onChange={(e) => setRequireApproval(e.target.checked)}
            />
            Require approval
          </label>
          <label className="space-y-1">
            <span className="text-[color:var(--muted)]">Priority (lower first)</span>
            <input
              type="number"
              className={inputClassName}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[color:var(--muted)]">Max runs / hour</span>
            <input
              type="number"
              min={1}
              className={inputClassName}
              value={rateLimitPerHour}
              placeholder="Unlimited"
              onChange={(e) => setRateLimitPerHour(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[color:var(--muted)]">Timezone</span>
            <input
              className={inputClassName}
              list="tz-list"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="local or America/New_York"
            />
            <datalist id="tz-list">
              <option value="local" />
              <option value="UTC" />
              <option value="America/New_York" />
              <option value="America/Chicago" />
              <option value="America/Los_Angeles" />
            </datalist>
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg">When</h2>
        <div className="flex flex-wrap gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">Record type</span>
            <select
              className={inputClassName}
              value={entity}
              onChange={(e) => {
                const next = e.target.value as (typeof AUTOMATION_ENTITIES)[number];
                const nextFields = fieldsForEntity(next, customFields[next] ?? []);
                setTrigger(defaultTrigger(trigger.type, next, nextFields));
                setGroups([]);
              }}
            >
              {AUTOMATION_ENTITIES.map((value) => (
                <option key={value} value={value}>
                  {labelize(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">Trigger</span>
            <select
              className={inputClassName}
              value={trigger.type}
              onChange={(e) =>
                setTrigger(
                  defaultTrigger(e.target.value as AutomationTrigger["type"], entity, fields),
                )
              }
            >
              {TRIGGER_TYPES.map((value) => (
                <option key={value} value={value}>
                  {TRIGGER_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {trigger.type === "field_changed" ? (
          <div className="flex flex-wrap gap-3">
            <FieldSelect
              fields={fields}
              value={trigger.field}
              onChange={(field) => setTrigger({ ...trigger, field, from: undefined, to: undefined })}
            />
            <FieldValueInput
              field={fields.find((f) => f.key === trigger.field)}
              value={trigger.from ?? ""}
              onChange={(from) => setTrigger({ ...trigger, from: from || undefined })}
              allowEmpty
            />
            <FieldValueInput
              field={fields.find((f) => f.key === trigger.field)}
              value={trigger.to ?? ""}
              onChange={(to) => setTrigger({ ...trigger, to: to || undefined })}
              allowEmpty
            />
          </div>
        ) : null}

        {trigger.type === "schedule" ? (
          <div className="flex flex-wrap gap-3">
            <select
              className={inputClassName}
              value={trigger.cadence}
              onChange={(e) =>
                setTrigger({
                  ...trigger,
                  cadence: e.target.value as "hourly" | "daily" | "cron",
                })
              }
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="cron">Cron</option>
            </select>
            {trigger.cadence === "daily" ? (
              <input
                type="number"
                min={0}
                max={23}
                className={inputClassName}
                value={trigger.hour ?? 9}
                onChange={(e) => setTrigger({ ...trigger, hour: Number(e.target.value) })}
              />
            ) : null}
            {trigger.cadence === "cron" ? (
              <input
                className={inputClassName}
                value={trigger.cron ?? "0 9 * * *"}
                onChange={(e) => setTrigger({ ...trigger, cron: e.target.value })}
                placeholder="0 9 * * 1-5"
              />
            ) : null}
          </div>
        ) : null}

        {trigger.type === "date_offset" ? (
          <div className="flex flex-wrap gap-3">
            <FieldSelect
              fields={fields.filter((f) => f.dateOffset)}
              value={trigger.field}
              onChange={(field) => setTrigger({ ...trigger, field })}
            />
            <input
              type="number"
              className={inputClassName}
              value={trigger.offsetDays}
              onChange={(e) => setTrigger({ ...trigger, offsetDays: Number(e.target.value) })}
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg">
            If (OR of AND groups)
          </h2>
          <button
            type="button"
            className="text-sm text-[color:var(--accent)]"
            onClick={() =>
              setGroups((prev) => [
                ...prev,
                { conditions: [{ field: fields[0]?.key ?? "status", op: "eq", value: "" }] },
              ])
            }
          >
            Add OR group
          </button>
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No conditions — trigger alone is enough.</p>
        ) : (
          <ul className="space-y-4">
            {groups.map((group, gi) => (
              <li
                key={gi}
                className="space-y-2 rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-soft)] p-3"
              >
                <div className="flex justify-between text-xs text-[color:var(--muted)]">
                  <span>AND group {gi + 1}</span>
                  <button type="button" onClick={() => setGroups(groups.filter((_, i) => i !== gi))}>
                    Remove group
                  </button>
                </div>
                {group.conditions.map((condition, ci) => (
                  <ConditionRow
                    key={ci}
                    condition={condition}
                    fields={fields}
                    tags={tags}
                    users={users}
                    onChange={(next) => {
                      const copy = groups.map((g) => ({
                        conditions: [...g.conditions],
                      }));
                      copy[gi].conditions[ci] = next;
                      setGroups(copy);
                    }}
                    onRemove={() => {
                      const copy = groups.map((g) => ({
                        conditions: [...g.conditions],
                      }));
                      copy[gi].conditions = copy[gi].conditions.filter((_, i) => i !== ci);
                      if (copy[gi].conditions.length === 0) {
                        setGroups(groups.filter((_, i) => i !== gi));
                      } else {
                        setGroups(copy);
                      }
                    }}
                  />
                ))}
                <button
                  type="button"
                  className="text-sm text-[color:var(--accent)]"
                  onClick={() => {
                    const copy = groups.map((g) => ({
                      conditions: [...g.conditions],
                    }));
                    copy[gi].conditions.push({
                      field: fields[0]?.key ?? "status",
                      op: "eq",
                      value: "",
                    });
                    setGroups(copy);
                  }}
                >
                  Add AND condition
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Then (actions)</h2>
          <button
            type="button"
            className="text-sm text-[color:var(--accent)]"
            onClick={() => setActions((prev) => [...prev, defaultAction("add_note", fields)])}
          >
            Add action
          </button>
        </div>
        <ul className="space-y-4">
          {actions.map((action, index) => (
            <li
              key={index}
              className="space-y-2 rounded-lg border border-[color:var(--line)] bg-[color:var(--panel-soft)] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <select
                  className={inputClassName}
                  value={action.type}
                  onChange={(e) => {
                    const next = [...actions];
                    next[index] = defaultAction(
                      e.target.value as AutomationAction["type"],
                      fields,
                    );
                    setActions(next);
                  }}
                >
                  {ACTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ACTION_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-sm text-[color:var(--danger)]"
                  disabled={actions.length <= 1}
                  onClick={() => setActions(actions.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
              <ActionFields
                action={action}
                fields={fields}
                taskGroups={taskGroups}
                tags={tags}
                users={users}
                onChange={(next) => {
                  const list = [...actions];
                  list[index] = next;
                  setActions(list);
                }}
                onTagsChange={setTags}
                onTaskGroupsChange={setTaskGroups}
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || !name.trim() || actions.length === 0}
          onClick={save}
          className="rounded-md bg-[color:var(--accent)] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {mode === "create" ? "Create automation" : "Save changes"}
        </button>
        {mode === "edit" && automationId ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteAutomation(automationId);
              })
            }
            className="rounded-md bg-[color:var(--danger)] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FieldSelect({
  fields,
  value,
  onChange,
}: {
  fields: AutomationFieldDef[];
  value: string;
  onChange: (value: string) => void;
}) {
  const builtins = fields.filter((f) => !f.custom);
  const custom = fields.filter((f) => f.custom);
  return (
    <select className={inputClassName} value={value} onChange={(e) => onChange(e.target.value)}>
      {builtins.map((f) => (
        <option key={f.key} value={f.key}>
          {f.label}
        </option>
      ))}
      {custom.length ? (
        <optgroup label="Custom fields">
          {custom.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}

function FieldValueInput({
  field,
  value,
  onChange,
  allowEmpty = false,
}: {
  field?: AutomationFieldDef;
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  if (!field) {
    return <input className={inputClassName} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === "enum" || field.type === "checkbox") {
    return (
      <select className={inputClassName} value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty ? <option value="">Any</option> : null}
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "date") {
    return (
      <input type="date" className={inputClassName} value={value} onChange={(e) => onChange(e.target.value)} />
    );
  }
  if (field.type === "datetime") {
    return (
      <input
        type="datetime-local"
        className={inputClassName}
        value={value.includes("T") ? value.slice(0, 16) : value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "number") {
    return (
      <input type="number" className={inputClassName} value={value} onChange={(e) => onChange(e.target.value)} />
    );
  }
  return <input className={inputClassName} value={value} onChange={(e) => onChange(e.target.value)} />;
}

function TemplateInsert({
  fields,
  onInsert,
}: {
  fields: AutomationFieldDef[];
  onInsert: (token: string) => void;
}) {
  return (
    <select
      className={inputClassName}
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) onInsert(`{{${e.target.value}}}`);
        e.target.value = "";
      }}
    >
      <option value="">Insert field…</option>
      {fields.map((f) => (
        <option key={f.key} value={f.key}>
          {f.label} ({f.key})
        </option>
      ))}
    </select>
  );
}

function ConditionRow({
  condition,
  fields,
  tags,
  users,
  onChange,
  onRemove,
}: {
  condition: AutomationCondition;
  fields: AutomationFieldDef[];
  tags: Option[];
  users: Option[];
  onChange: (c: AutomationCondition) => void;
  onRemove: () => void;
}) {
  const needsField = !["has_tag", "assigned_to", "owned_by"].includes(condition.op);
  const needsValue = !["changed", "is_empty", "is_not_empty", "has_tag", "assigned_to", "owned_by"].includes(
    condition.op,
  );
  return (
    <div className="flex flex-wrap items-end gap-2">
      <select
        className={inputClassName}
        value={condition.op}
        onChange={(e) =>
          onChange({
            ...condition,
            op: e.target.value as (typeof CONDITION_OPS)[number],
            id: undefined,
            value: "",
          })
        }
      >
        {CONDITION_OPS.map((op) => (
          <option key={op} value={op}>
            {CONDITION_OP_LABELS[op]}
          </option>
        ))}
      </select>
      {needsField ? (
        <FieldSelect
          fields={fields}
          value={condition.field ?? fields[0]?.key ?? ""}
          onChange={(field) => onChange({ ...condition, field })}
        />
      ) : null}
      {condition.op === "has_tag" ? (
        <Combobox
          options={tags}
          value={condition.id ?? 0}
          onChange={(id) => onChange({ ...condition, id })}
          placeholder="Tag"
        />
      ) : null}
      {condition.op === "assigned_to" || condition.op === "owned_by" ? (
        <Combobox
          options={users}
          value={condition.id ?? 0}
          onChange={(id) => onChange({ ...condition, id })}
          placeholder="Staff"
        />
      ) : null}
      {needsValue ? (
        <FieldValueInput
          field={fields.find((f) => f.key === condition.field)}
          value={condition.value ?? ""}
          onChange={(value) => onChange({ ...condition, value })}
        />
      ) : null}
      <button type="button" className="text-sm text-[color:var(--danger)]" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}

function Combobox({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: Option[];
  value: number;
  onChange: (id: number) => void;
  placeholder: string;
}) {
  const listId = `cb-${placeholder}-${options.length}`;
  const selected = options.find((o) => o.id === value);
  return (
    <>
      <input
        className={inputClassName}
        list={listId}
        placeholder={placeholder}
        defaultValue={selected?.name ?? ""}
        onChange={(e) => {
          const match = options.find(
            (o) => o.name.toLowerCase() === e.target.value.trim().toLowerCase(),
          );
          if (match) onChange(match.id);
        }}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.id} value={o.name} />
        ))}
      </datalist>
    </>
  );
}

function ActionFields({
  action,
  onChange,
  fields,
  taskGroups,
  tags,
  users,
  onTagsChange,
  onTaskGroupsChange,
}: {
  action: AutomationAction;
  onChange: (action: AutomationAction) => void;
  fields: AutomationFieldDef[];
  taskGroups: Option[];
  tags: Option[];
  users: Option[];
  onTagsChange: (tags: Option[]) => void;
  onTaskGroupsChange: (groups: Option[]) => void;
}) {
  const [newTag, setNewTag] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [busy, startTransition] = useTransition();

  switch (action.type) {
    case "update_record": {
      const entries = Object.entries(action.fields);
      const writable = fields.filter((f) => f.writable);
      return (
        <div className="space-y-2">
          {entries.map(([key, val], i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <FieldSelect
                fields={writable}
                value={key}
                onChange={(nextKey) => {
                  const next = { ...action.fields };
                  delete next[key];
                  next[nextKey] = writable.find((f) => f.key === nextKey)?.options?.[0]?.value ?? "";
                  onChange({ type: "update_record", fields: next });
                }}
              />
              <FieldValueInput
                field={fields.find((f) => f.key === key)}
                value={val}
                onChange={(value) =>
                  onChange({
                    type: "update_record",
                    fields: { ...action.fields, [key]: value },
                  })
                }
              />
              <button
                type="button"
                className="text-sm text-[color:var(--danger)]"
                onClick={() => {
                  const next = { ...action.fields };
                  delete next[key];
                  onChange({
                    type: "update_record",
                    fields:
                      Object.keys(next).length > 0
                        ? next
                        : { [writable[0]?.key ?? "status"]: "" },
                  });
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-sm text-[color:var(--accent)]"
            onClick={() => {
              const unused = writable.find((f) => !(f.key in action.fields));
              if (!unused) return;
              onChange({
                type: "update_record",
                fields: {
                  ...action.fields,
                  [unused.key]: unused.options?.[0]?.value ?? "",
                },
              });
            }}
          >
            Add field
          </button>
        </div>
      );
    }
    case "create_task":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <input
              className={inputClassName}
              value={action.title}
              onChange={(e) => onChange({ ...action, title: e.target.value })}
            />
            <TemplateInsert
              fields={fields}
              onInsert={(token) => onChange({ ...action, title: action.title + token })}
            />
          </div>
          <select
            className={inputClassName}
            value={action.kind}
            onChange={(e) => onChange({ ...action, kind: e.target.value })}
          >
            {TASK_KINDS.map((k) => (
              <option key={k} value={k}>
                {labelize(k)}
              </option>
            ))}
          </select>
          <select
            className={inputClassName}
            value={action.status}
            onChange={(e) => onChange({ ...action, status: e.target.value })}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </select>
        </div>
      );
    case "create_contact":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className={inputClassName}
            value={action.name}
            onChange={(e) => onChange({ ...action, name: e.target.value })}
            placeholder="Name"
          />
          <input
            className={inputClassName}
            value={action.email ?? ""}
            onChange={(e) => onChange({ ...action, email: e.target.value })}
            placeholder="Email"
          />
          <input
            className={inputClassName}
            value={action.role ?? ""}
            onChange={(e) => onChange({ ...action, role: e.target.value })}
            placeholder="Role"
          />
          <select
            className={inputClassName}
            value={action.linkToEventAs ?? ""}
            onChange={(e) =>
              onChange({ ...action, linkToEventAs: e.target.value || undefined })
            }
          >
            <option value="">Don’t link to event</option>
            {EVENT_LINK_ROLES.map((r) => (
              <option key={r} value={r}>
                Link as {r}
              </option>
            ))}
          </select>
        </div>
      );
    case "link_event_role":
      return (
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(action.useTriggerContact)}
              onChange={(e) =>
                onChange({ ...action, useTriggerContact: e.target.checked })
              }
            />
            Use triggering contact
          </label>
          <select
            className={inputClassName}
            value={action.role}
            onChange={(e) => onChange({ ...action, role: e.target.value })}
          >
            {EVENT_LINK_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      );
    case "set_owners":
    case "assign_users":
      return (
        <div className="space-y-2">
          <select
            className={inputClassName}
            value={action.mode}
            onChange={(e) =>
              onChange({ ...action, mode: e.target.value as "add" | "replace" })
            }
          >
            <option value="add">Add</option>
            <option value="replace">Replace</option>
          </select>
          <select
            multiple
            className={`${inputClassName} min-h-28`}
            value={action.userIds.map(String)}
            onChange={(e) =>
              onChange({
                ...action,
                userIds: Array.from(e.target.selectedOptions).map((o) => Number(o.value)),
              })
            }
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      );
    case "apply_task_group":
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              className={inputClassName}
              list="task-group-list"
              placeholder="Task group"
              defaultValue={taskGroups.find((g) => g.id === action.taskGroupId)?.name ?? ""}
              onChange={(e) => {
                const match = taskGroups.find(
                  (g) => g.name.toLowerCase() === e.target.value.trim().toLowerCase(),
                );
                if (match) onChange({ ...action, taskGroupId: match.id });
              }}
            />
            <datalist id="task-group-list">
              {taskGroups.map((g) => (
                <option key={g.id} value={g.name} />
              ))}
            </datalist>
            <select
              className={inputClassName}
              value={action.mode}
              onChange={(e) =>
                onChange({
                  ...action,
                  mode: e.target.value as "block" | "add_missing",
                })
              }
            >
              <option value="add_missing">Add missing</option>
              <option value="block">Block if applied</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className={`${inputClassName} max-w-xs`}
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              placeholder="New task group"
            />
            <button
              type="button"
              disabled={busy || !newGroup.trim()}
              className="rounded-md border border-[color:var(--line)] px-3 py-2 text-sm"
              onClick={() =>
                startTransition(async () => {
                  const result = await createAutomationTaskGroup(newGroup);
                  if (!result.ok) return;
                  onTaskGroupsChange([...taskGroups, result.group]);
                  onChange({ ...action, taskGroupId: result.group.id });
                  setNewGroup("");
                })
              }
            >
              Create
            </button>
          </div>
        </div>
      );
    case "add_tag":
      return (
        <div className="space-y-2">
          <input
            className={inputClassName}
            list="tag-list"
            placeholder="Pick a tag"
            defaultValue={tags.find((t) => t.id === action.tagId)?.name ?? ""}
            onChange={(e) => {
              const match = tags.find(
                (t) => t.name.toLowerCase() === e.target.value.trim().toLowerCase(),
              );
              if (match) onChange({ type: "add_tag", tagId: match.id });
            }}
          />
          <datalist id="tag-list">
            {tags.map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
          <div className="flex flex-wrap gap-2">
            <input
              className={`${inputClassName} max-w-xs`}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="New tag"
            />
            <button
              type="button"
              disabled={busy || !newTag.trim()}
              className="rounded-md border border-[color:var(--line)] px-3 py-2 text-sm"
              onClick={() =>
                startTransition(async () => {
                  const result = await createAutomationTag(newTag);
                  if (!result.ok) return;
                  onTagsChange(
                    tags.some((t) => t.id === result.tag.id)
                      ? tags
                      : [...tags, result.tag],
                  );
                  onChange({ type: "add_tag", tagId: result.tag.id });
                  setNewTag("");
                })
              }
            >
              Create tag
            </button>
          </div>
        </div>
      );
    case "add_note":
    case "notify": {
      const isNotify = action.type === "notify";
      return (
        <div className="grid gap-2">
          {isNotify ? (
            <>
              <select
                className={inputClassName}
                value={action.audience}
                onChange={(e) =>
                  onChange({
                    ...action,
                    audience: e.target.value as "specific" | "assignees" | "owners",
                  })
                }
              >
                <option value="assignees">Assignees / owners</option>
                <option value="owners">Owners</option>
                <option value="specific">Specific</option>
              </select>
              <input
                className={inputClassName}
                value={action.subject}
                onChange={(e) => onChange({ ...action, subject: e.target.value })}
                placeholder="Subject"
              />
            </>
          ) : null}
          <TemplateInsert
            fields={fields}
            onInsert={(token) =>
              onChange({
                ...action,
                body: action.body + token,
              })
            }
          />
          <textarea
            className={inputClassName}
            rows={3}
            value={action.body}
            onChange={(e) => onChange({ ...action, body: e.target.value })}
          />
        </div>
      );
    }
  }
}
