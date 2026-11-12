"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { events, getDb, tasks } from "@/db";
import {
  listTaskAssigneeIds,
  readAssigneeIds,
  replaceTaskAssignees,
} from "@/lib/assignees";
import {
  TASK_KINDS,
  TASK_STATUSES,
  type TaskKind,
  type TaskStatus,
} from "@/lib/constants";
import { getCurrentUserId } from "@/lib/current-user";
import { deletePolymorphicRefsForEntity } from "@/lib/entities";
import {
  taskAssignedMessage,
  taskChangedMessage,
  taskDeletedMessage,
} from "@/lib/notifications/messages";
import { notifyUsers } from "@/lib/notifications/notify";

function readTaskFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "other") as TaskKind;
  const status = String(formData.get("status") ?? "todo") as TaskStatus;
  const dueOn = String(formData.get("dueOn") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const eventRaw = String(formData.get("eventId") ?? "").trim();
  const contactRaw = String(formData.get("contactId") ?? "").trim();
  const eventId = eventRaw ? Number(eventRaw) : null;
  const contactId = contactRaw ? Number(contactRaw) : null;

  if (!title) throw new Error("Title is required");
  if (!dueOn) throw new Error("Due date is required");
  if (!TASK_KINDS.includes(kind)) throw new Error("Invalid kind");
  if (!TASK_STATUSES.includes(status)) throw new Error("Invalid status");

  return {
    title,
    kind,
    status,
    dueOn,
    notes,
    eventId: eventId && Number.isFinite(eventId) ? eventId : null,
    contactId: contactId && Number.isFinite(contactId) ? contactId : null,
  };
}

function revalidateTaskPaths(eventId?: number | null, taskId?: number | null) {
  revalidatePath("/tasks");
  revalidatePath("/");
  if (eventId) revalidatePath(`/events/${eventId}`);
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

async function eventTitleFor(eventId: number | null) {
  if (eventId == null) return null;
  const db = await getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  return event?.title ?? null;
}

async function notifyTaskAssignees(options: {
  task: {
    id: number;
    title: string;
    status: string;
    dueOn: string;
    kind: string;
    eventId: number | null;
  };
  assigneeIds: number[];
  addedIds?: number[];
  action: "created" | "updated" | "deleted";
}) {
  const actorUserId = await getCurrentUserId();
  const stamp = Date.now();
  const eventTitle = await eventTitleFor(options.task.eventId);
  const summary = { ...options.task, eventTitle };

  if (options.addedIds && options.addedIds.length > 0) {
    const message = taskAssignedMessage(summary);
    await notifyUsers({
      kind: "assignment",
      entityType: "task",
      entityId: options.task.id,
      userIds: options.addedIds,
      subject: message.subject,
      body: message.body,
      dedupeKeyPrefix: `assignment:task:${options.task.id}:${stamp}`,
      actorUserId,
    });
  }

  if (options.action === "created") {
    // Assignment email above covers create-time assignees.
    return;
  }

  if (options.action === "deleted") {
    const message = taskDeletedMessage(summary);
    await notifyUsers({
      kind: "record_change",
      entityType: "task",
      entityId: options.task.id,
      userIds: options.assigneeIds,
      subject: message.subject,
      body: message.body,
      dedupeKeyPrefix: `record_change:task:${options.task.id}:deleted:${stamp}`,
      actorUserId,
    });
    return;
  }

  const message = taskChangedMessage(summary, options.action);
  await notifyUsers({
    kind: "record_change",
    entityType: "task",
    entityId: options.task.id,
    userIds: options.assigneeIds,
    subject: message.subject,
    body: message.body,
    dedupeKeyPrefix: `record_change:task:${options.task.id}:${options.action}:${stamp}`,
    actorUserId,
  });
}

export async function createTask(formData: FormData) {
  const fields = readTaskFields(formData);
  const assigneeIds = readAssigneeIds(formData);
  const db = await getDb();
  const [row] = await db.insert(tasks).values(fields).returning();
  const { next, added } = await replaceTaskAssignees(row.id, assigneeIds);
  await notifyTaskAssignees({
    task: row,
    assigneeIds: next,
    addedIds: added,
    action: "created",
  });
  revalidateTaskPaths(row.eventId, row.id);
  if (row.contactId) revalidatePath(`/contacts/${row.contactId}`);
  redirect(`/tasks/${row.id}`);
}

export async function updateTask(id: number, formData: FormData) {
  const fields = readTaskFields(formData);
  const assigneeIds = readAssigneeIds(formData);
  const db = await getDb();
  // Only overwrite editable fields — preserve taskGroupId / taskTemplateId.
  const [row] = await db
    .update(tasks)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  const { next, added } = await replaceTaskAssignees(id, assigneeIds);
  if (row) {
    await notifyTaskAssignees({
      task: row,
      assigneeIds: next,
      addedIds: added,
      action: "updated",
    });
  }
  revalidateTaskPaths(row?.eventId, id);
  if (row?.contactId) revalidatePath(`/contacts/${row.contactId}`);
  redirect(`/tasks/${id}`);
}

export async function updateTaskStatus(id: number, formData: FormData) {
  const status = String(formData.get("status") ?? "") as TaskStatus;
  if (!TASK_STATUSES.includes(status)) throw new Error("Invalid status");
  const db = await getDb();
  const [row] = await db
    .update(tasks)
    .set({ status, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  if (row) {
    const assigneeIds = await listTaskAssigneeIds(id);
    await notifyTaskAssignees({
      task: row,
      assigneeIds,
      action: "updated",
    });
  }
  revalidateTaskPaths(row?.eventId, id);
}

export async function deleteTask(id: number) {
  await deletePolymorphicRefsForEntity({ type: "task", id });
  const db = await getDb();
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  const assigneeIds = existing ? await listTaskAssigneeIds(id) : [];
  const [row] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
  if (existing) {
    await notifyTaskAssignees({
      task: existing,
      assigneeIds,
      action: "deleted",
    });
  }
  revalidateTaskPaths(row?.eventId, id);
  revalidatePath("/notes");
  redirect("/tasks");
}
