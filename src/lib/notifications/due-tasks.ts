import { and, asc, eq, inArray, lte, notInArray } from "drizzle-orm";
import { formatISO } from "date-fns";
import {
  events,
  getDb,
  taskAssignees,
  tasks,
  users,
} from "@/db";
import { formatDate } from "@/lib/format";
import { labelize } from "@/lib/constants";
import { notifyUsers } from "@/lib/notifications/notify";
import { appBaseUrl } from "@/lib/notifications/resend-send";

export async function sendDueTaskDigests(now = new Date()) {
  const today = formatISO(now, { representation: "date" });
  const db = await getDb();

  const dueTasks = await db
    .select({
      task: tasks,
      eventTitle: events.title,
    })
    .from(tasks)
    .leftJoin(events, eq(tasks.eventId, events.id))
    .where(
      and(
        notInArray(tasks.status, ["done", "skipped"]),
        lte(tasks.dueOn, today),
      ),
    )
    .orderBy(asc(tasks.dueOn));

  if (dueTasks.length === 0) {
    return { usersNotified: 0, tasksConsidered: 0 };
  }

  const taskIds = dueTasks.map(({ task }) => task.id);
  const assignmentRows = await db
    .select({
      taskId: taskAssignees.taskId,
      userId: taskAssignees.userId,
    })
    .from(taskAssignees)
    .where(inArray(taskAssignees.taskId, taskIds));

  const byUser = new Map<number, typeof dueTasks>();
  for (const row of assignmentRows) {
    const entry = dueTasks.find(({ task }) => task.id === row.taskId);
    if (!entry) continue;
    const list = byUser.get(row.userId) ?? [];
    list.push(entry);
    byUser.set(row.userId, list);
  }

  let usersNotified = 0;
  for (const [userId, userTasks] of byUser) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user?.active || !user.email) continue;

    const overdue = userTasks.filter(({ task }) => task.dueOn < today);
    const dueToday = userTasks.filter(({ task }) => task.dueOn === today);

    const lines: string[] = [
      `Hi ${user.name},`,
      "",
      "Here are your open Greenroom tasks that are due today or overdue.",
      "",
    ];

    if (overdue.length > 0) {
      lines.push("Overdue:");
      for (const { task, eventTitle } of overdue) {
        lines.push(
          `- ${task.title} · due ${formatDate(task.dueOn)} · ${labelize(task.status)}${eventTitle ? ` · ${eventTitle}` : ""}`,
        );
      }
      lines.push("");
    }

    if (dueToday.length > 0) {
      lines.push("Due today:");
      for (const { task, eventTitle } of dueToday) {
        lines.push(
          `- ${task.title} · ${labelize(task.status)}${eventTitle ? ` · ${eventTitle}` : ""}`,
        );
      }
      lines.push("");
    }

    lines.push(`Open tasks: ${appBaseUrl()}/tasks?assigneeId=mine`);

    const result = await notifyUsers({
      kind: "task_due",
      entityType: "user",
      entityId: userId,
      userIds: [userId],
      subject: `Tasks due: ${overdue.length} overdue, ${dueToday.length} today`,
      body: lines.join("\n"),
      dedupeKeyPrefix: `task_due:${today}`,
    });

    if (result.sent > 0) usersNotified += 1;
  }

  return { usersNotified, tasksConsidered: dueTasks.length };
}
