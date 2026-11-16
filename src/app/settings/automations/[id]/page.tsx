import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/ui";
import { automations, getDb } from "@/db";
import { ensureSeedData } from "@/db/seed";
import { loadAutomationEditorOptions } from "@/lib/actions/automations";
import {
  normalizeConditionGroups,
  parseActions,
  parseTrigger,
  type AutomationAction,
  type AutomationConditionGroup,
  type AutomationTrigger,
} from "@/lib/automations/rule-schema";
import { AutomationEditor } from "../automation-editor";
import { TestPanel } from "../test-panel";

export default async function EditAutomationPage({
  params,
}: PageProps<"/settings/automations/[id]">) {
  await connection();
  await ensureSeedData();
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) notFound();

  const db = await getDb();
  const [row] = await db.select().from(automations).where(eq(automations.id, id));
  if (!row) notFound();

  const options = await loadAutomationEditorOptions();

  let trigger: AutomationTrigger;
  let conditionGroups: AutomationConditionGroup[];
  let actions: AutomationAction[];
  try {
    trigger = parseTrigger(row.trigger);
    conditionGroups = normalizeConditionGroups(row.conditions);
    actions = parseActions(row.actions);
  } catch {
    trigger = {
      type: "field_changed",
      entity: "event",
      field: "status",
      to: "booked",
    };
    conditionGroups = [];
    actions = [
      {
        type: "add_note",
        body: "Fix this automation — stored JSON failed validation.",
      },
    ];
  }

  return (
    <div className="space-y-6">
      <PageHeader title={row.name} description="Edit when this rule runs and what it does." />
      <TestPanel automationId={row.id} defaultEntity={row.entity ?? trigger.entity} />
      <AutomationEditor
        mode="edit"
        automationId={row.id}
        initial={{
          name: row.name,
          description: row.description ?? "",
          enabled: row.enabled,
          priority: row.priority,
          requireApproval: row.requireApproval,
          rateLimitPerHour: row.rateLimitPerHour,
          timezone: row.timezone,
          trigger,
          conditionGroups,
          actions,
        }}
        taskGroups={options.taskGroups}
        tags={options.tags}
        users={options.users}
        customFields={options.customFields}
      />
    </div>
  );
}
