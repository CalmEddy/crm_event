"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, googleCalendarAccounts, googleCalendarLinks } from "@/db";
import { requireSignedIn } from "@/lib/auth";
import { getCurrentUserId } from "@/lib/current-user";
import { syncUserGoogleCalendar } from "@/lib/google/sync";

export type GoogleCalendarActionResult =
  | { ok: true; detail?: string }
  | { ok: false; error: string };

function revalidate() {
  revalidatePath("/settings/calendar");
  revalidatePath("/calendar");
}

export async function updateGoogleCalendarPrefs(input: {
  syncTasks: boolean;
  syncEvents: boolean;
  enabled: boolean;
}): Promise<GoogleCalendarActionResult> {
  await requireSignedIn();
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "No staff profile" };
  const db = await getDb();
  const [row] = await db
    .select()
    .from(googleCalendarAccounts)
    .where(eq(googleCalendarAccounts.userId, userId));
  if (!row) return { ok: false, error: "Connect Google Calendar first" };
  await db
    .update(googleCalendarAccounts)
    .set({
      syncTasks: input.syncTasks,
      syncEvents: input.syncEvents,
      enabled: input.enabled,
      updatedAt: new Date(),
    })
    .where(eq(googleCalendarAccounts.userId, userId));
  revalidate();
  return { ok: true };
}

export async function disconnectGoogleCalendar(): Promise<GoogleCalendarActionResult> {
  await requireSignedIn();
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "No staff profile" };
  const db = await getDb();
  await db
    .delete(googleCalendarLinks)
    .where(eq(googleCalendarLinks.userId, userId));
  await db
    .delete(googleCalendarAccounts)
    .where(eq(googleCalendarAccounts.userId, userId));
  revalidate();
  return { ok: true };
}

export async function runGoogleCalendarSyncNow(): Promise<GoogleCalendarActionResult> {
  await requireSignedIn();
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "No staff profile" };
  try {
    const result = await syncUserGoogleCalendar(userId);
    revalidate();
    return {
      ok: true,
      detail: `Synced ${result.tasks} task(s) and ${result.events} event(s).`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Sync failed",
    };
  }
}
