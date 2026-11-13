"use client";

import { useState, useTransition, type ReactNode } from "react";
import { resetDashboard, saveDashboard } from "@/lib/actions/dashboard";
import {
  KPI_METRICS,
  WIDGET_TYPES,
  widgetTitle,
  type DashboardWidget,
  type KpiMetric,
  type WidgetSize,
  type WidgetType,
} from "@/lib/dashboard/widgets";

export type ViewChoice = { id: number; name: string; entity: string };

const SPAN: Record<WidgetSize, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
};

const control =
  "rounded border border-[color:var(--line)] bg-white px-1.5 py-0.5 text-xs";

export function DashboardGrid({
  widgets,
  content,
  views,
  canSave,
}: {
  widgets: DashboardWidget[];
  /** Server-rendered body per widget id. */
  content: Record<string, ReactNode>;
  views: ViewChoice[];
  canSave: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(widgets);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const viewNames = Object.fromEntries(views.map((v) => [v.id, v.name]));
  const shown = editing ? draft : widgets;

  const update = (id: string, patch: Partial<DashboardWidget>) =>
    setDraft((list) => list.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const move = (index: number, delta: number) =>
    setDraft((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const add = (type: WidgetType) =>
    setDraft((list) => [
      ...list,
      {
        id: `w${Date.now().toString(36)}`,
        type,
        size: WIDGET_TYPES[type].defaultSize,
        ...(type === "kpi" ? { metric: "my_open_tasks" as const } : {}),
        ...(type === "saved_view" ? { viewId: views[0]?.id, limit: 8 } : {}),
      },
    ]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) setEditing(false);
      else setError(result.error ?? "Couldn't save.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
        {error ? <span className="mr-auto text-[color:var(--danger)]">{error}</span> : null}
        {editing ? (
          <>
            <select
              aria-label="Add widget"
              className="rounded-md border border-[color:var(--line)] bg-white px-2 py-1"
              value=""
              onChange={(e) => e.target.value && add(e.target.value as WidgetType)}
            >
              <option value="">+ Add widget…</option>
              {Object.entries(WIDGET_TYPES).map(([type, def]) => (
                <option key={type} value={type} disabled={type === "saved_view" && views.length === 0}>
                  {def.label}
                  {type === "saved_view" && views.length === 0 ? " (save a view first)" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(resetDashboard)}
              className="rounded-md border border-[color:var(--line)] px-3 py-1"
            >
              Reset to default
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(widgets);
                setEditing(false);
              }}
              className="rounded-md border border-[color:var(--line)] px-3 py-1"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => saveDashboard(draft))}
              className="rounded-md bg-[color:var(--accent)] px-3 py-1 text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save layout"}
            </button>
          </>
        ) : canSave ? (
          <button
            type="button"
            onClick={() => {
              setDraft(widgets);
              setEditing(true);
            }}
            className="rounded-md border border-[color:var(--line)] px-3 py-1"
          >
            Customize
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {shown.map((widget, index) => (
          <section
            key={widget.id}
            aria-label={widgetTitle(widget, viewNames)}
            className={`${SPAN[widget.size]} rounded-xl border bg-[color:var(--panel)] p-4 ${
              editing ? "border-dashed border-[color:var(--accent)]" : "border-[color:var(--line)]"
            }`}
          >
            <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
                {widgetTitle(widget, viewNames)}
              </h2>
              {editing ? (
                <div className="flex flex-wrap items-center gap-1">
                  <button type="button" className={control} aria-label="Move earlier" onClick={() => move(index, -1)}>
                    ←
                  </button>
                  <button type="button" className={control} aria-label="Move later" onClick={() => move(index, 1)}>
                    →
                  </button>
                  <select
                    aria-label="Width"
                    className={control}
                    value={widget.size}
                    onChange={(e) => update(widget.id, { size: Number(e.target.value) as WidgetSize })}
                  >
                    <option value={1}>1/3</option>
                    <option value={2}>2/3</option>
                    <option value={3}>Full</option>
                  </select>
                  <button
                    type="button"
                    className={`${control} text-[color:var(--danger)]`}
                    aria-label={`Remove ${widgetTitle(widget, viewNames)}`}
                    onClick={() => setDraft((list) => list.filter((w) => w.id !== widget.id))}
                  >
                    ✕
                  </button>
                </div>
              ) : null}
            </header>
            {editing ? (
              <WidgetSettings widget={widget} views={views} onChange={(p) => update(widget.id, p)} />
            ) : null}
            {content[widget.id] ?? (
              <p className="py-4 text-sm text-[color:var(--muted)]">Save the layout to load this widget.</p>
            )}
          </section>
        ))}
        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[color:var(--line)] p-8 text-sm text-[color:var(--muted)] lg:col-span-3">
            No widgets. Use “Add widget” to build your dashboard.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function WidgetSettings({
  widget,
  views,
  onChange,
}: {
  widget: DashboardWidget;
  views: ViewChoice[];
  onChange: (patch: Partial<DashboardWidget>) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2 text-xs">
      {widget.type === "kpi" ? (
        <select
          aria-label="Metric"
          className={control}
          value={widget.metric}
          onChange={(e) => onChange({ metric: e.target.value as KpiMetric })}
        >
          {Object.entries(KPI_METRICS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      ) : null}
      {widget.type === "saved_view" ? (
        <select
          aria-label="Saved view"
          className={control}
          value={widget.viewId ?? ""}
          onChange={(e) => onChange({ viewId: Number(e.target.value) || undefined })}
        >
          {views.map((view) => (
            <option key={view.id} value={view.id}>
              {view.entity}: {view.name}
            </option>
          ))}
        </select>
      ) : null}
      {widget.type !== "kpi" && widget.type !== "pipeline" ? (
        <label className="flex items-center gap-1">
          Rows
          <select
            className={control}
            value={widget.limit ?? 8}
            onChange={(e) => onChange({ limit: Number(e.target.value) })}
          >
            {[3, 5, 8, 12, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
