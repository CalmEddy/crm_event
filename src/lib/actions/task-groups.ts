"use server";

import { and, asc, eq, inArray, isNotNull, ne, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  events,
  getDb,
  taskGroupApplications,
  taskGroups,
  tasks,
  taskTemplates,
} from "@/db";
import { TASK_KINDS, type TaskKind } from "@/lib/constants";
import {
  dueOnFromEventDate,
  toOffsetDays,
  type OffsetDirection,
  type OffsetUnit,
} from "@/lib/offsets";

function readGroupFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) throw new Error("Name is required");
  return { name, description };
}

function readTemplateFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "other") as TaskKind;
  const amount = Number(formData.get("amount") ?? 0);
  const unit = String(formData.get("unit") ?? "days") as OffsetUnit;
  const direction = String(
    formData.get("direction") ?? "before",
  ) as OffsetDirection;

  if (!title) throw new Error("Title is required");
  if (!TASK_KINDS.includes(kind)) throw new Error("Invalid kind");
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Offset amount must be zero or greater");
  }

  return {
    title,
    kind,
    offsetDays: toOffsetDays(amount, unit, direction),
  };
}

export async function createTaskGroup(formData: FormData) {
  const fields = readGroupFields(formData);
  const db = await getDb();
  const [row] = await db.insert(taskGroups).values(fields).returning();
  revalidatePath("/task-groups");
  redirect(`/task-groups/${row.id}`);
}

export async function updateTaskGroup(id: number, formData: FormData) {
  const fields = readGroupFields(formData);
  const db = await getDb();
  await db
    .update(taskGroups)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(taskGroups.id, id));
  revalidatePath("/task-groups");
  revalidatePath(`/task-groups/${id}`);
  redirect(`/task-groups/${id}`);
}

export async function deleteTaskGroup(id: number) {
  const db = await getDb();
  await db.delete(taskGroups).where(eq(taskGroups.id, id));
  revalidatePath("/task-groups");
  redirect("/task-groups");
}

export async function addTaskTemplate(groupId: number, formData: FormData) {
  const fields = readTemplateFields(formData);
  const db = await getDb();
  const existing = await db
    .select()
    .from(taskTemplates)
    .where(eq(taskTemplates.taskGroupId, groupId))
    .orderBy(asc(taskTemplates.sortOrder));
  const sortOrder =
    existing.length > 0
      ? existing[existing.length - 1].sortOrder + 1
      : 0;

  await db.insert(taskTemplates).values({
    taskGroupId: groupId,
    ...fields,
    sortOrder,
  });

  revalidatePath(`/task-groups/${groupId}`);
  redirect(`/task-groups/${groupId}`);
}

export async function updateTaskTemplate(
  groupId: number,
  templateId: number,
  formData: FormData,
) {
  const fields = readTemplateFields(formData);
  const db = await getDb();
  await db
    .update(taskTemplates)
    .set(fields)
    .where(
      and(
        eq(taskTemplates.id, templateId),
        eq(taskTemplates.taskGroupId, groupId),
      ),
    );
  revalidatePath(`/task-groups/${groupId}`);
  redirect(`/task-groups/${groupId}`);
}

export async function deleteTaskTemplate(groupId: number, templateId: number) {
  const db = await getDb();
  await db
    .delete(taskTemplates)
    .where(
      and(
        eq(taskTemplates.id, templateId),
        eq(taskTemplates.taskGroupId, groupId),
      ),
    );
  revalidatePath(`/task-groups/${groupId}`);
  redirect(`/task-groups/${groupId}`);
}

export async function applyTaskGroupToEvent(eventId: number, formData: FormData) {
  const taskGroupId = Number(formData.get("taskGroupId"));
  const mode = String(formData.get("mode") ?? "block");
  if (!Number.isFinite(taskGroupId)) throw new Error("Pick a task group");

  const db = await getDb();
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
    .where(
      and(eq(tasks.eventId, eventId), eq(tasks.taskGroupId, taskGroupId)),
    );
  const spawnedTemplateIds = new Set(
    existingTasks
      .map((task) => task.taskTemplateId)
      .filter((id): id is number => id != null),
  );

  const toCreate = templates.filter(
    (template) => !spawnedTemplateIds.has(template.id),
  );

  if (toCreate.length > 0) {
    await db.insert(tasks).values(
      toCreate.map((template) => ({
        title: template.title,
        kind: template.kind,
        dueOn: dueOnFromEventDate(event.startsAt, template.offsetDays),
        status: "todo" as const,
        eventId,
        taskGroupId,
        taskTemplateId: template.id,
      })),
    );
  }

  if (!existingApplication) {
    await db.insert(taskGroupApplications).values({
      eventId,
      taskGroupId,
    });
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  redirect(`/events/${eventId}`);
}

export async function recalculateOpenTasksFromTemplates(eventId: number) {
  const db = await getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) throw new Error("Event not found");

  const openTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.eventId, eventId),
        isNotNull(tasks.taskTemplateId),
        notInArray(tasks.status, ["done", "skipped"]),
      ),
    );

  if (openTasks.length === 0) {
    redirect(`/events/${eventId}`);
  }

  const templateIds = openTasks
    .map((task) => task.taskTemplateId)
    .filter((id): id is number => id != null);

  const templates = await db
    .select()
    .from(taskTemplates)
    .where(inArray(taskTemplates.id, templateIds));
  const byId = new Map(templates.map((template) => [template.id, template]));

  for (const task of openTasks) {
    if (!task.taskTemplateId) continue;
    const template = byId.get(task.taskTemplateId);
    if (!template) continue;
    const dueOn = dueOnFromEventDate(event.startsAt, template.offsetDays);
    if (dueOn === task.dueOn) continue;
    await db
      .update(tasks)
      .set({ dueOn, updatedAt: new Date() })
      .where(and(eq(tasks.id, task.id), ne(tasks.status, "done")));
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  redirect(`/events/${eventId}`);
}
