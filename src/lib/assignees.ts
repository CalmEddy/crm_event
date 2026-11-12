import { eq, inArray } from "drizzle-orm";
import {
  eventAssignees,
  getDb,
  taskAssignees,
  users,
  type User,
} from "@/db";

export function readAssigneeIds(formData: FormData, name = "assigneeIds") {
  return [
    ...new Set(
      formData
        .getAll(name)
        .map((value) => Number(String(value)))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
}

export async function listEventAssigneeIds(eventId: number): Promise<number[]> {
  const db = await getDb();
  const rows = await db
    .select({ userId: eventAssignees.userId })
    .from(eventAssignees)
    .where(eq(eventAssignees.eventId, eventId));
  return rows.map((row) => row.userId);
}

export async function listTaskAssigneeIds(taskId: number): Promise<number[]> {
  const db = await getDb();
  const rows = await db
    .select({ userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(eq(taskAssignees.taskId, taskId));
  return rows.map((row) => row.userId);
}

export async function listEventAssigneeUsers(eventId: number): Promise<User[]> {
  const db = await getDb();
  const rows = await db
    .select({ user: users })
    .from(eventAssignees)
    .innerJoin(users, eq(eventAssignees.userId, users.id))
    .where(eq(eventAssignees.eventId, eventId));
  return rows.map((row) => row.user);
}

export async function replaceEventAssignees(
  eventId: number,
  userIds: number[],
): Promise<{ previous: number[]; next: number[]; added: number[] }> {
  const db = await getDb();
  const previous = await listEventAssigneeIds(eventId);
  await db.delete(eventAssignees).where(eq(eventAssignees.eventId, eventId));
  const next = [...new Set(userIds)];
  if (next.length > 0) {
    await db.insert(eventAssignees).values(
      next.map((userId) => ({ eventId, userId })),
    );
  }
  const previousSet = new Set(previous);
  const added = next.filter((id) => !previousSet.has(id));
  return { previous, next, added };
}

export async function replaceTaskAssignees(
  taskId: number,
  userIds: number[],
): Promise<{ previous: number[]; next: number[]; added: number[] }> {
  const db = await getDb();
  const previous = await listTaskAssigneeIds(taskId);
  await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
  const next = [...new Set(userIds)];
  if (next.length > 0) {
    await db.insert(taskAssignees).values(
      next.map((userId) => ({ taskId, userId })),
    );
  }
  const previousSet = new Set(previous);
  const added = next.filter((id) => !previousSet.has(id));
  return { previous, next, added };
}

export async function copyEventAssigneesToTasks(
  eventId: number,
  taskIds: number[],
) {
  if (taskIds.length === 0) return;
  const assigneeIds = await listEventAssigneeIds(eventId);
  if (assigneeIds.length === 0) return;
  const db = await getDb();
  await db.insert(taskAssignees).values(
    taskIds.flatMap((taskId) =>
      assigneeIds.map((userId) => ({ taskId, userId })),
    ),
  );
}

export async function usersByIds(userIds: number[]): Promise<User[]> {
  if (userIds.length === 0) return [];
  const db = await getDb();
  return db.select().from(users).where(inArray(users.id, userIds));
}
