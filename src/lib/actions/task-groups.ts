"use server";

import { and, asc, eq, inArray, isNotNull, ne, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  events,
  getDb,
  taskGroups,
  tasks,
  taskTemplates,
} from "@/db";
import { TASK_KINDS, type TaskKind } from "@/lib/constants";
import { requireSignedIn } from "@/lib/auth";
import {
  dueOnFromEventDate,
  toOffsetDays,
  type OffsetDirection,
  type OffsetUnit,
} from "@/lib/offsets";
import { applyTaskGroupToEventCore } from "@/lib/task-groups-apply";

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
  await requireSignedIn();
  const fields = readGroupFields(formData);
  const db = await getDb();
  const [row] = await db.insert(taskGroups).values(fields).returning();
  revalidatePath("/task-groups");
  redirect(`/task-groups/${row.id}`);
}

export async function updateTaskGroup(id: number, formData: FormData) {
  await requireSignedIn();
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
  await requireSignedIn();
  const db = await getDb();
  await db.delete(taskGroups).where(eq(taskGroups.id, id));
  revalidatePath("/task-groups");
  redirect("/task-groups");
}

export async function addTaskTemplate(groupId: number, formData: FormData) {
  await requireSignedIn();
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
  await requireSignedIn();
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
  await requireSignedIn();
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
  await requireSignedIn();
  const taskGroupId = Number(formData.get("taskGroupId"));
  const mode = String(formData.get("mode") ?? "block");
  if (!Number.isFinite(taskGroupId)) throw new Error("Pick a task group");

  await applyTaskGroupToEventCore(
    eventId,
    taskGroupId,
    mode === "add_missing" ? "add_missing" : "block",
  );

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  redirect(`/events/${eventId}`);
}

export async function recalculateOpenTasksFromTemplates(eventId: number) {
  await requireSignedIn();
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
