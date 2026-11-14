import { and, asc, eq, inArray, lte, notInArray } from "drizzle-orm";
import { addDays, formatISO } from "date-fns";
import { events, getDb, taskAssignees, tasks, users } from "@/db";
import { formatDate } from "@/lib/format";
import { labelize } from "@/lib/constants";
import { notifyUsers } from "@/lib/notifications/notify";
import { LEAD_DAY_OPTIONS } from "@/lib/notifications/prefs-shared";
import { appBaseUrl } from "@/lib/notifications/resend-send";

const MAX_LEAD_DAYS = Math.max(...LEAD_DAY_OPTIONS);

/**
 * Daily reminder: each user's open tasks that are overdue, due today, or due
 * within the number of days they chose. Sent once per user per day and channel.
 * `onlyUserId` + `force` let a user send their own reminder on demand.
 */
export async function sendDueTaskDigests(
  now = new Date(),
  options: { onlyUserId?: number; force?: boolean } = {},
) {
  const today = formatISO(now, { representation: "date" });
  const horizon = formatISO(addDays(now, MAX_LEAD_DAYS), { representation: "date" });
  const db = await getDb({ system: true });

  const dueTasks = await db
    .select({ task: tasks, eventTitle: events.title })
    .from(tasks)
    .leftJoin(events, eq(tasks.eventId, events.id))
    .where(and(notInArray(tasks.status, ["done", "skipped"]), lte(tasks.dueOn, horizon)))
    .orderBy(asc(tasks.dueOn));

  if (dueTasks.length === 0) {
    return { usersNotified: 0, tasksConsidered: 0, messagesSent: 0 };
  }

  const assignmentRows = await db
    .select({ taskId: taskAssignees.taskId, userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(
      inArray(
        taskAssignees.taskId,
        dueTasks.map(({ task }) => task.id),
      ),
    );

  const byUser = new Map<number, typeof dueTasks>();
  for (const row of assignmentRows) {
    if (options.onlyUserId && row.userId !== options.onlyUserId) continue;
    const entry = dueTasks.find(({ task }) => task.id === row.taskId);
    if (!entry) continue;
    byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), entry]);
  }

  let usersNotified = 0;
  let messagesSent = 0;
  for (const [userId, userTasks] of byUser) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user?.active) continue;

    const lead = Math.min(Math.max(user.reminderLeadDays, 0), MAX_LEAD_DAYS);
    const until = formatISO(addDays(now, lead), { representation: "date" });
    const overdue = userTasks.filter(({ task }) => task.dueOn < today);
    const dueToday = userTasks.filter(({ task }) => task.dueOn === today);
    const upcoming = userTasks.filter(({ task }) => task.dueOn > today && task.dueOn <= until);
    if (overdue.length + dueToday.length + upcoming.length === 0) continue;

    const line = ({ task, eventTitle }: (typeof dueTasks)[number], withDate: boolean) =>
      `- ${task.title}${withDate ? ` · due ${formatDate(task.dueOn)}` : ""} · ${labelize(task.status)}${eventTitle ? ` · ${eventTitle}` : ""}`;

    const lines: string[] = [`Hi ${user.name},`, "", "Here are your open Greenroom tasks.", ""];
    if (overdue.length > 0) {
      lines.push("Overdue:", ...overdue.map((entry) => line(entry, true)), "");
    }
    if (dueToday.length > 0) {
      lines.push("Due today:", ...dueToday.map((entry) => line(entry, false)), "");
    }
    if (upcoming.length > 0) {
      lines.push(
        `Coming up (next ${lead} day${lead === 1 ? "" : "s"}):`,
        ...upcoming.map((entry) => line(entry, true)),
        "",
      );
    }
    const url = `${appBaseUrl()}/tasks?f.assignees=me`;
    lines.push(`Open tasks: ${url}`);

    const counts = [
      overdue.length ? `${overdue.length} overdue` : null,
      dueToday.length ? `${dueToday.length} today` : null,
      upcoming.length ? `${upcoming.length} coming up` : null,
    ].filter(Boolean);

    const result = await notifyUsers({
      kind: "task_due",
      entityType: "user",
      entityId: userId,
      userIds: [userId],
      subject: `Tasks due: ${counts.join(", ")}`,
      body: lines.join("\n"),
      url,
      dedupeKeyPrefix: options.force ? `task_due:${today}:manual:${now.getTime()}` : `task_due:${today}`,
    });

    messagesSent += result.sent;
    if (result.sent > 0) usersNotified += 1;
  }

  return { usersNotified, tasksConsidered: dueTasks.length, messagesSent };
}
