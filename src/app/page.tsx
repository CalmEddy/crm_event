import { Suspense } from "react";
import { asc, eq, or } from "drizzle-orm";
import { connection } from "next/server";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { WidgetContent } from "@/components/dashboard/widget-content";
import { PageHeader } from "@/components/ui";
import { dashboardLayouts, getDb, savedViews } from "@/db";
import { ensureSeedData } from "@/db/seed";
import { getCurrentUserId } from "@/lib/current-user";
import { parseLayout } from "@/lib/dashboard/widgets";
import { VIEW_CONFIGS } from "@/lib/views/fields";

export default async function DashboardPage() {
  await connection();
  await ensureSeedData();
  const db = await getDb();
  const userId = await getCurrentUserId();

  const [layoutRow] =
    userId != null
      ? await db.select().from(dashboardLayouts).where(eq(dashboardLayouts.userId, userId)).limit(1)
      : [];
  const widgets = parseLayout(layoutRow?.widgets);

  const views = await db
    .select({ id: savedViews.id, name: savedViews.name, entity: savedViews.entity })
    .from(savedViews)
    .where(
      userId != null
        ? or(eq(savedViews.userId, userId), eq(savedViews.shared, true))
        : eq(savedViews.shared, true),
    )
    .orderBy(asc(savedViews.entity), asc(savedViews.name));

  const content = Object.fromEntries(
    widgets.map((widget) => [
      widget.id,
      <Suspense key={widget.id} fallback={<p className="py-4 text-sm text-[color:var(--muted)]">Loading…</p>}>
        <WidgetContent widget={widget} userId={userId} />
      </Suspense>,
    ]),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Your widgets, your order. Customize to add saved views and KPIs." />
      <DashboardGrid
        widgets={widgets}
        content={content}
        canSave={userId != null}
        views={views.map((view) => ({
          ...view,
          entity: VIEW_CONFIGS[view.entity].pluralLabel,
        }))}
      />
    </div>
  );
}
