"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, tasks } from "@/db";
import {
  TASK_KINDS,
  TASK_STATUSES,
  type TaskKind,
  type TaskStatus,
} from "@/lib/constants";

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

function revalidateTaskPaths(eventId?: number | null) {
  revalidatePath("/tasks");
  revalidatePath("/");
  if (eventId) revalidatePath(`/events/${eventId}`);
}

export async function createTask(formData: FormData) {
  const fields = readTaskFields(formData);
  const db = await getDb();
  const [row] = await db.insert(tasks).values(fields).returning();
  revalidateTaskPaths(row.eventId);
  redirect("/tasks");
}

export async function updateTask(id: number, formData: FormData) {
  const fields = readTaskFields(formData);
  const db = await getDb();
  const [row] = await db
    .update(tasks)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  revalidateTaskPaths(row?.eventId);
  redirect("/tasks");
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
  revalidateTaskPaths(row?.eventId);
}

export async function deleteTask(id: number) {
  const db = await getDb();
  const [row] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
  revalidateTaskPaths(row?.eventId);
  redirect("/tasks");
}
