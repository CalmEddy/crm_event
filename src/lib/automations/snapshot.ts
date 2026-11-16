import { snapshot } from "@/lib/activity";
import type { EntityType } from "@/db";
import { loadCustomValues } from "@/lib/custom-fields";

export async function snapshotWithCustom(
  entity: EntityType,
  id: number,
): Promise<Record<string, unknown> | null> {
  const row = await snapshot(entity, id);
  if (!row) return null;
  try {
    const map = await loadCustomValues(entity, [id]);
    return { ...(row as Record<string, unknown>), ...(map.get(id) ?? {}) };
  } catch {
    return row as Record<string, unknown>;
  }
}
