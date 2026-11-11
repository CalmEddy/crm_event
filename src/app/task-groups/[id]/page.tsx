import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { TaskGroupForm } from "@/components/forms/task-group-form";
import { TaskTemplateForm } from "@/components/forms/task-template-form";
import {
  Badge,
  ButtonLink,
  PageHeader,
  Section,
  SubmitButton,
} from "@/components/ui";
import { getDb, taskGroups, taskTemplates } from "@/db";
import {
  addTaskTemplate,
  deleteTaskGroup,
  deleteTaskTemplate,
  updateTaskGroup,
  updateTaskTemplate,
} from "@/lib/actions/task-groups";
import { labelize } from "@/lib/constants";
import { formatOffsetLabel } from "@/lib/offsets";

export default async function TaskGroupDetailPage({
  params,
}: PageProps<"/task-groups/[id]">) {
  await connection();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const db = await getDb();
  const [group] = await db
    .select()
    .from(taskGroups)
    .where(eq(taskGroups.id, id));
  if (!group) notFound();

  const templates = await db
    .select()
    .from(taskTemplates)
    .where(eq(taskTemplates.taskGroupId, id))
    .orderBy(asc(taskTemplates.sortOrder), asc(taskTemplates.id));

  return (
    <div className="space-y-10">
      <PageHeader
        title={group.name}
        description={
          group.description ||
          "Templates use offsetDays relative to the event start date."
        }
        actions={
          <>
            <ButtonLink href="/task-groups" variant="secondary">
              Back
            </ButtonLink>
            <form action={deleteTaskGroup.bind(null, id)}>
              <SubmitButton variant="danger">Delete group</SubmitButton>
            </form>
          </>
        }
      />

      <Section title="Group details">
        <TaskGroupForm
          group={group}
          action={updateTaskGroup.bind(null, id)}
        />
      </Section>

      <Section title="Templates">
        {templates.length === 0 ? (
          <p className="mb-4 text-sm text-[color:var(--muted)]">
            No templates yet. Add relative tasks like “2 weeks before” or “6
            months after”.
          </p>
        ) : (
          <div className="mb-6 space-y-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge>{labelize(template.kind)}</Badge>
                  <Badge>{formatOffsetLabel(template.offsetDays)}</Badge>
                  <span className="text-xs text-[color:var(--muted)]">
                    offsetDays = {template.offsetDays}
                  </span>
                </div>
                <TaskTemplateForm
                  template={template}
                  submitLabel="Save template"
                  action={updateTaskTemplate.bind(null, id, template.id)}
                />
                <form
                  action={deleteTaskTemplate.bind(null, id, template.id)}
                  className="mt-3"
                >
                  <SubmitButton variant="danger">Delete template</SubmitButton>
                </form>
              </div>
            ))}
          </div>
        )}

        <h3 className="mb-3 font-[family-name:var(--font-display)] text-lg">
          Add template
        </h3>
        <TaskTemplateForm action={addTaskTemplate.bind(null, id)} />
      </Section>
    </div>
  );
}
