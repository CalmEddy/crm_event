import { Suspense } from "react";
import type { EntityType } from "@/db";
import { getCurrentUserId, listActiveUsers } from "@/lib/current-user";
import { VIEW_CONFIGS, type Ref } from "@/lib/views/fields";
import { loadSavedViews, loadViewRows } from "@/lib/views/load";
import { DataView } from "./data-view";

/** Server wrapper: loads rows + saved views, then hands off to the client view. */
export async function EntityDataView({ entity }: { entity: EntityType }) {
  const config = VIEW_CONFIGS[entity];
  const [rows, currentUserId, activeUsers] = await Promise.all([
    loadViewRows(entity),
    getCurrentUserId(),
    listActiveUsers(),
  ]);
  const savedViews = await loadSavedViews(entity, currentUserId);

  // Filter choices: every active user for user fields; refs present in the data for relations.
  const refOptions: Record<string, Ref[]> = {};
  for (const field of config.fields) {
    if (field.type === "users") {
      refOptions[field.key] = activeUsers.map((u) => ({ id: u.id, label: u.name }));
    } else if (field.type === "relation") {
      const seen = new Map<number, Ref>();
      for (const row of rows) {
        const value = row.values[field.key];
        if (value && typeof value === "object" && !Array.isArray(value)) {
          seen.set(value.id, value);
        }
      }
      refOptions[field.key] = [...seen.values()].sort((a, b) =>
        a.label.localeCompare(b.label),
      );
    }
  }

  return (
    <Suspense fallback={<p className="text-sm text-[color:var(--muted)]">Loading…</p>}>
      <DataView
        entity={entity}
        rows={rows}
        savedViews={savedViews}
        currentUserId={currentUserId}
        refOptions={refOptions}
      />
    </Suspense>
  );
}
