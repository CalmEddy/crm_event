import { PageHeader } from "@/components/ui";
import { TaskGroupForm } from "@/components/forms/task-group-form";
import { createTaskGroup } from "@/lib/actions/task-groups";

export default function NewTaskGroupPage() {
  return (
    <div>
      <PageHeader
        title="New task group"
        description="Name a pack, then add relative templates on the detail page."
      />
      <TaskGroupForm action={createTaskGroup} />
    </div>
  );
}
