// Dashboard widget definitions (client-safe: no DB imports).
import { z } from "zod";

export const KPI_METRICS = {
  overdue_tasks: "Overdue tasks",
  due_this_week: "Tasks due this week",
  my_open_tasks: "My open tasks",
  upcoming_events: "Upcoming events (30 days)",
  unassigned_tasks: "Unassigned open tasks",
} as const;
export type KpiMetric = keyof typeof KPI_METRICS;

export const WIDGET_TYPES = {
  kpi: { label: "KPI tile", defaultSize: 1 },
  upcoming_events: { label: "Upcoming events", defaultSize: 3 },
  overdue_tasks: { label: "Overdue tasks", defaultSize: 2 },
  due_soon: { label: "Due in the next 7 days", defaultSize: 2 },
  my_tasks: { label: "My tasks", defaultSize: 2 },
  pipeline: { label: "Event pipeline", defaultSize: 2 },
  saved_view: { label: "Saved view", defaultSize: 2 },
} as const;
export type WidgetType = keyof typeof WIDGET_TYPES;

/** Width in columns of a 3-column grid. */
export type WidgetSize = 1 | 2 | 3;

const widgetSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(Object.keys(WIDGET_TYPES) as [WidgetType, ...WidgetType[]]),
  size: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  metric: z.enum(Object.keys(KPI_METRICS) as [KpiMetric, ...KpiMetric[]]).optional(),
  viewId: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(25).optional(),
});
export type DashboardWidget = z.infer<typeof widgetSchema>;

export const layoutSchema = z.array(widgetSchema).max(24);

export const DEFAULT_LAYOUT: DashboardWidget[] = [
  { id: "k1", type: "kpi", size: 1, metric: "overdue_tasks" },
  { id: "k2", type: "kpi", size: 1, metric: "due_this_week" },
  { id: "k3", type: "kpi", size: 1, metric: "upcoming_events" },
  { id: "w1", type: "upcoming_events", size: 3, limit: 8 },
  { id: "w2", type: "overdue_tasks", size: 2, limit: 12 },
  { id: "w3", type: "pipeline", size: 1 },
  { id: "w4", type: "due_soon", size: 2, limit: 12 },
  { id: "w5", type: "my_tasks", size: 1, limit: 8 },
];

export function parseLayout(raw: string | null | undefined): DashboardWidget[] {
  if (!raw) return DEFAULT_LAYOUT;
  try {
    const parsed = layoutSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function widgetTitle(
  widget: DashboardWidget,
  viewNames: Record<number, string> = {},
): string {
  if (widget.type === "kpi") return KPI_METRICS[widget.metric ?? "overdue_tasks"];
  if (widget.type === "saved_view") {
    return (widget.viewId && viewNames[widget.viewId]) || "Saved view";
  }
  return WIDGET_TYPES[widget.type].label;
}
