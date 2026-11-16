import { connection } from "next/server";
import { PageHeader } from "@/components/ui";
import { ensureSeedData } from "@/db/seed";
import { loadAutomationEditorOptions } from "@/lib/actions/automations";
import { AutomationEditor } from "../automation-editor";

export default async function NewAutomationPage() {
  await connection();
  await ensureSeedData();
  const options = await loadAutomationEditorOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="New automation"
        description="Pick a trigger, optional conditions, and one or more actions."
      />
      <AutomationEditor
        mode="create"
        initial={{
          name: "",
          description: "",
          enabled: true,
          priority: 100,
          requireApproval: false,
          rateLimitPerHour: null,
          timezone: "local",
          trigger: {
            type: "field_changed",
            entity: "event",
            field: "status",
            to: "booked",
          },
          conditionGroups: [],
          actions: [
            {
              type: "apply_task_group",
              taskGroupId: options.taskGroups[0]?.id ?? 0,
              mode: "add_missing",
            },
          ],
        }}
        taskGroups={options.taskGroups}
        tags={options.tags}
        users={options.users}
        customFields={options.customFields}
      />
    </div>
  );
}
