import { Suspense } from "react";
import type { EntityType } from "@/db";
import { getCurrentUserId, listActiveUsers } from "@/lib/current-user";
import { isEntityType, loadEntityOptions } from "@/lib/entities";
import { loadEntityConfig } from "@/lib/custom-fields";
import { VIEW_CONFIGS, type Ref } from "@/lib/views/fields";
import { loadSavedViews, loadViewRows } from "@/lib/views/load";
import { DataView } from "./data-view";

/** Server wrapper: loads rows, saved views and choices, then hands off to the client view. */
export async function EntityDataView({ entity }: { entity: EntityType }) {
  const [config, rows, currentUserId, activeUsers, entityOptions] = await Promise.all([
    loadEntityConfig(entity),
    loadViewRows(entity),
    getCurrentUserId(),
    listActiveUsers(),
    loadEntityOptions(),
  ]);
  const savedViews = await loadSavedViews(entity, currentUserId);

  const refOptions: Record<string, Ref[]> = {};
  const editOptions: Record<string, Ref[]> = {};
  for (const field of config.fields) {
    if (field.type === "users") {
      refOptions[field.key] = activeUsers.map((u) => ({ id: u.id, label: u.name }));
    } else if (field.type === "relation" && isEntityType(field.key)) {
      // Relation field keys name the entity they point at (event, contact, organization).
      const all = entityOptions[field.key];
      editOptions[field.key] = all;
      // Filters only offer values that appear in the data.
      const used = new Set(
        rows.map((row) => {
          const value = row.values[field.key];
          return value && typeof value === "object" && !Array.isArray(value) ? value.id : null;
        }),
      );
      refOptions[field.key] = all
        .filter((option) => used.has(option.id))
        .sort((a, b) => a.label.localeCompare(b.label));
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
        editOptions={editOptions}
        customFields={config.fields.slice(VIEW_CONFIGS[entity].fields.length)}
      />
    </Suspense>
  );
}
