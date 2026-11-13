"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { dashboardLayouts, getDb } from "@/db";
import { requireSignedIn } from "@/lib/auth";
import { getCurrentUserId } from "@/lib/current-user";
import { layoutSchema } from "@/lib/dashboard/widgets";

export type DashboardResult = { ok: true } | { ok: false; error: string };

export async function saveDashboard(widgets: unknown): Promise<DashboardResult> {
  await requireSignedIn();
  const userId = await getCurrentUserId();
  if (userId == null) return { ok: false, error: "Your account isn't linked to a staff user." };
  const parsed = layoutSchema.safeParse(widgets);
  if (!parsed.success) return { ok: false, error: "That layout isn't valid." };
  const json = JSON.stringify(parsed.data);
  const db = await getDb();
  await db
    .insert(dashboardLayouts)
    .values({ userId, widgets: json })
    .onConflictDoUpdate({
      target: dashboardLayouts.userId,
      set: { widgets: json, updatedAt: new Date() },
    });
  refresh();
  return { ok: true };
}

export async function resetDashboard(): Promise<DashboardResult> {
  await requireSignedIn();
  const userId = await getCurrentUserId();
  if (userId == null) return { ok: false, error: "Not allowed." };
  const db = await getDb();
  await db.delete(dashboardLayouts).where(eq(dashboardLayouts.userId, userId));
  refresh();
  return { ok: true };
}
