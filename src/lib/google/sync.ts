import { and, eq, inArray } from "drizzle-orm";
import {
  events,
  getDb,
  googleCalendarAccounts,
  googleCalendarLinks,
  taskAssignees,
  eventAssignees,
  tasks,
  type EntityType,
  type GoogleCalendarAccount,
} from "@/db";
import {
  deleteCalendarEvent,
  insertCalendarEvent,
  patchCalendarEvent,
  type GoogleCalendarEventBody,
} from "@/lib/google/calendar-api";
import { getValidAccessToken } from "@/lib/google/tokens";
import { appBaseUrl } from "@/lib/notifications/resend-send";

const DEFAULT_EVENT_HOURS = 2;

function dueOnToDateString(dueOn: Date | string): string {
  if (typeof dueOn === "string") return dueOn.slice(0, 10);
  return dueOn.toISOString().slice(0, 10);
}

function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function taskBody(task: {
  id: number;
  title: string;
  dueOn: Date | string;
  status: string;
  kind: string;
}): GoogleCalendarEventBody {
  const day = dueOnToDateString(task.dueOn);
  return {
    summary: `Task: ${task.title}`,
    description: `Greenroom task (${task.status} · ${task.kind})\n${appBaseUrl()}/tasks/${task.id}`,
    start: { date: day },
    end: { date: nextDay(day) },
    source: { title: "Greenroom", url: `${appBaseUrl()}/tasks/${task.id}` },
  };
}

function eventBody(event: {
  id: number;
  title: string;
  startsAt: Date;
  venue: string | null;
  location: string | null;
  status: string;
}): GoogleCalendarEventBody {
  const start = event.startsAt instanceof Date ? event.startsAt : new Date(event.startsAt);
  const end = new Date(start.getTime() + DEFAULT_EVENT_HOURS * 60 * 60 * 1000);
  return {
    summary: event.title,
    description: `Greenroom event (${event.status})\n${appBaseUrl()}/events/${event.id}`,
    location: [event.venue, event.location].filter(Boolean).join(" · ") || undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    source: { title: "Greenroom", url: `${appBaseUrl()}/events/${event.id}` },
  };
}

async function loadAccount(userId: number): Promise<GoogleCalendarAccount | null> {
  const db = await getDb({ system: true });
  const [row] = await db
    .select()
    .from(googleCalendarAccounts)
    .where(eq(googleCalendarAccounts.userId, userId));
  if (!row || !row.enabled) return null;
  return row;
}

async function upsertLink(
  account: GoogleCalendarAccount,
  entity: "task" | "event",
  entityId: number,
  body: GoogleCalendarEventBody,
) {
  const db = await getDb({ system: true });
  const accessToken = await getValidAccessToken(account);
  const [existing] = await db
    .select()
    .from(googleCalendarLinks)
    .where(
      and(
        eq(googleCalendarLinks.userId, account.userId),
        eq(googleCalendarLinks.entity, entity),
        eq(googleCalendarLinks.entityId, entityId),
      ),
    );

  if (existing) {
    try {
      await patchCalendarEvent(
        accessToken,
        account.calendarId,
        existing.googleEventId,
        body,
      );
      await db
        .update(googleCalendarLinks)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(googleCalendarLinks.userId, account.userId),
            eq(googleCalendarLinks.entity, entity),
            eq(googleCalendarLinks.entityId, entityId),
          ),
        );
      return;
    } catch (err) {
      if (!(err instanceof Error && err.message === "NOT_FOUND")) throw err;
      await db
        .delete(googleCalendarLinks)
        .where(
          and(
            eq(googleCalendarLinks.userId, account.userId),
            eq(googleCalendarLinks.entity, entity),
            eq(googleCalendarLinks.entityId, entityId),
          ),
        );
    }
  }

  const created = await insertCalendarEvent(
    accessToken,
    account.calendarId,
    body,
  );
  await db
    .insert(googleCalendarLinks)
    .values({
      userId: account.userId,
      entity,
      entityId,
      googleEventId: created.id,
    })
    .onConflictDoUpdate({
      target: [
        googleCalendarLinks.userId,
        googleCalendarLinks.entity,
        googleCalendarLinks.entityId,
      ],
      set: { googleEventId: created.id, updatedAt: new Date() },
    });
}

async function removeLink(
  account: GoogleCalendarAccount,
  entity: "task" | "event",
  entityId: number,
) {
  const db = await getDb({ system: true });
  const [existing] = await db
    .select()
    .from(googleCalendarLinks)
    .where(
      and(
        eq(googleCalendarLinks.userId, account.userId),
        eq(googleCalendarLinks.entity, entity),
        eq(googleCalendarLinks.entityId, entityId),
      ),
    );
  if (!existing) return;
  const accessToken = await getValidAccessToken(account);
  await deleteCalendarEvent(accessToken, account.calendarId, existing.googleEventId);
  await db
    .delete(googleCalendarLinks)
    .where(
      and(
        eq(googleCalendarLinks.userId, account.userId),
        eq(googleCalendarLinks.entity, entity),
        eq(googleCalendarLinks.entityId, entityId),
      ),
    );
}

async function syncTaskForUser(account: GoogleCalendarAccount, taskId: number) {
  if (!account.syncTasks) {
    await removeLink(account, "task", taskId);
    return;
  }
  const db = await getDb({ system: true });
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) {
    await removeLink(account, "task", taskId);
    return;
  }
  const [assigned] = await db
    .select()
    .from(taskAssignees)
    .where(
      and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, account.userId)),
    );
  if (!assigned || task.status === "done" || task.status === "skipped") {
    await removeLink(account, "task", taskId);
    return;
  }
  await upsertLink(account, "task", taskId, taskBody(task));
}

async function syncEventForUser(account: GoogleCalendarAccount, eventId: number) {
  if (!account.syncEvents) {
    await removeLink(account, "event", eventId);
    return;
  }
  const db = await getDb({ system: true });
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) {
    await removeLink(account, "event", eventId);
    return;
  }
  const [assigned] = await db
    .select()
    .from(eventAssignees)
    .where(
      and(
        eq(eventAssignees.eventId, eventId),
        eq(eventAssignees.userId, account.userId),
      ),
    );
  if (!assigned || event.status === "canceled") {
    await removeLink(account, "event", eventId);
    return;
  }
  await upsertLink(account, "event", eventId, eventBody(event));
}

/** Sync one record for every connected assignee (and prune for former assignees). */
export async function syncRecordToGoogleCalendars(options: {
  entity: EntityType;
  id: number;
  kind: "created" | "updated" | "deleted";
  extraUserIds?: number[];
}) {
  if (options.entity !== "task" && options.entity !== "event") return;

  const db = await getDb({ system: true });
  const userIds = new Set<number>(options.extraUserIds ?? []);

  if (options.kind !== "deleted") {
    if (options.entity === "task") {
      const rows = await db
        .select({ userId: taskAssignees.userId })
        .from(taskAssignees)
        .where(eq(taskAssignees.taskId, options.id));
      for (const row of rows) userIds.add(row.userId);
    } else {
      const rows = await db
        .select({ userId: eventAssignees.userId })
        .from(eventAssignees)
        .where(eq(eventAssignees.eventId, options.id));
      for (const row of rows) userIds.add(row.userId);
    }
  }

  // Anyone who already has a link should be updated/removed too.
  const linked = await db
    .select({ userId: googleCalendarLinks.userId })
    .from(googleCalendarLinks)
    .where(
      and(
        eq(googleCalendarLinks.entity, options.entity),
        eq(googleCalendarLinks.entityId, options.id),
      ),
    );
  for (const row of linked) userIds.add(row.userId);

  for (const userId of userIds) {
    try {
      const account = await loadAccount(userId);
      if (!account) continue;
      if (options.kind === "deleted") {
        await removeLink(account, options.entity, options.id);
      } else if (options.entity === "task") {
        await syncTaskForUser(account, options.id);
      } else {
        await syncEventForUser(account, options.id);
      }
    } catch (err) {
      console.error(`[google-calendar] sync user ${userId} failed:`, err);
      await db
        .update(googleCalendarAccounts)
        .set({
          lastError: err instanceof Error ? err.message : String(err),
          updatedAt: new Date(),
        })
        .where(eq(googleCalendarAccounts.userId, userId))
        .catch(() => undefined);
    }
  }
}

/** Full push sync for one staff user. */
export async function syncUserGoogleCalendar(userId: number): Promise<{
  tasks: number;
  events: number;
}> {
  const account = await loadAccount(userId);
  if (!account) throw new Error("Google Calendar is not connected");

  const db = await getDb({ system: true });
  let taskCount = 0;
  let eventCount = 0;

  try {
    if (account.syncTasks) {
      const assigned = await db
        .select({ taskId: taskAssignees.taskId })
        .from(taskAssignees)
        .where(eq(taskAssignees.userId, userId));
      const ids = assigned.map((r) => r.taskId);
      if (ids.length) {
        const open = await db
          .select()
          .from(tasks)
          .where(inArray(tasks.id, ids));
        for (const task of open) {
          if (task.status === "done" || task.status === "skipped") {
            await removeLink(account, "task", task.id);
            continue;
          }
          await upsertLink(account, "task", task.id, taskBody(task));
          taskCount += 1;
        }
      }
    }

    if (account.syncEvents) {
      const assigned = await db
        .select({ eventId: eventAssignees.eventId })
        .from(eventAssignees)
        .where(eq(eventAssignees.userId, userId));
      const ids = assigned.map((r) => r.eventId);
      if (ids.length) {
        const rows = await db.select().from(events).where(inArray(events.id, ids));
        for (const event of rows) {
          if (event.status === "canceled") {
            await removeLink(account, "event", event.id);
            continue;
          }
          await upsertLink(account, "event", event.id, eventBody(event));
          eventCount += 1;
        }
      }
    }

    await db
      .update(googleCalendarAccounts)
      .set({
        lastSyncedAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarAccounts.userId, userId));

    return { tasks: taskCount, events: eventCount };
  } catch (err) {
    await db
      .update(googleCalendarAccounts)
      .set({
        lastError: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarAccounts.userId, userId));
    throw err;
  }
}

/** Cron: sync every connected account. */
export async function syncAllGoogleCalendars() {
  const db = await getDb({ system: true });
  const accounts = await db
    .select({ userId: googleCalendarAccounts.userId })
    .from(googleCalendarAccounts)
    .where(eq(googleCalendarAccounts.enabled, true));
  let succeeded = 0;
  let failed = 0;
  for (const row of accounts) {
    try {
      await syncUserGoogleCalendar(row.userId);
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }
  return { accounts: accounts.length, succeeded, failed };
}

/** Fire-and-forget from activity hooks. */
export function queueGoogleCalendarSync(
  entity: EntityType,
  id: number,
  kind: "created" | "updated" | "deleted",
) {
  void syncRecordToGoogleCalendars({ entity, id, kind }).catch((err) => {
    console.error("[google-calendar] background sync failed:", err);
  });
}