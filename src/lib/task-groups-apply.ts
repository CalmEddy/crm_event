// Core task-group application (no redirect). Used by UI actions and automations.
import { and, asc, eq } from "drizzle-orm";
import {
  events,
  getDb,
  taskGroupApplications,
  tasks,
  taskTemplates,
} from "@/db";
import { copyEventAssigneesToTasks } from "@/lib/assignees";
import { dueOnFromEventDate } from "@/lib/offsets";

export type ApplyTaskGroupMode = "block" | "add_missing";

export type ApplyTaskGroupResult = {
  createdTaskIds: number[];
  skipped: boolean;
  alreadyApplied: boolean;
};

/**
 * Apply a task group's templates to an event.
 * When `mode` is `"block"` and the group was already applied, throws.
 * When `mode` is `"add_missing"`, only spawns templates not yet linked.
 */
export async function applyTaskGroupToEventCore(
  eventId: number,
  taskGroupId: number,
  mode: ApplyTaskGroupMode = "block",
): Promise<ApplyTaskGroupResult> {
  const db = await getDb({ system: true });
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) throw new Error("Event not found");

  const templates = await db
    .select()
    .from(taskTemplates)
    .where(eq(taskTemplates.taskGroupId, taskGroupId))
    .orderBy(asc(taskTemplates.sortOrder), asc(taskTemplates.id));

  if (templates.length === 0) {
    throw new Error("Task group has no templates");
  }

  const [existingApplication] = await db
    .select()
    .from(taskGroupApplications)
    .where(
      and(
        eq(taskGroupApplications.eventId, eventId),
        eq(taskGroupApplications.taskGroupId, taskGroupId),
      ),
    );

  if (existingApplication && mode !== "add_missing") {
    throw new Error(
      'This task group was already applied. Choose "add missing only" to spawn templates that are not yet linked.',
    );
  }

  const existingTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.eventId, eventId), eq(tasks.taskGroupId, taskGroupId)));
  const spawnedTemplateIds = new Set(
    existingTasks
      .map((task) => task.taskTemplateId)
      .filter((id): id is number => id != null),
  );

  const toCreate = templates.filter((template) => !spawnedTemplateIds.has(template.id));
  const createdTaskIds: number[] = [];

  if (toCreate.length > 0) {
    const created = await db
      .insert(tasks)
      .values(
        toCreate.map((template) => ({
          title: template.title,
          kind: template.kind,
          dueOn: dueOnFromEventDate(event.startsAt, template.offsetDays),
          status: "todo" as const,
          eventId,
          taskGroupId,
          taskTemplateId: template.id,
        })),
      )
      .returning();
    createdTaskIds.push(...created.map((task) => task.id));
    await copyEventAssigneesToTasks(eventId, createdTaskIds);
  }

  if (!existingApplication) {
    await db.insert(taskGroupApplications).values({
      eventId,
      taskGroupId,
    });
  }

  return {
    createdTaskIds,
    skipped: toCreate.length === 0,
    alreadyApplied: Boolean(existingApplication),
  };
}
