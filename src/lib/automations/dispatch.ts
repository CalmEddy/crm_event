import { snapshot } from "@/lib/activity";
import type { EntityType } from "@/db";
import { dispatchRecordMutation } from "@/lib/automations/runner";
import type { MutationKind } from "@/lib/automations/context";
import { loadCustomValues } from "@/lib/custom-fields";
import { isCustomKey } from "@/lib/views/fields";

function hasCustomKeys(row: Record<string, unknown> | null) {
  return Boolean(row && Object.keys(row).some(isCustomKey));
}

async function enrichWithCustom(
  entity: EntityType,
  id: number,
  row: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (!row || hasCustomKeys(row)) return row;
  try {
    const map = await loadCustomValues(entity, [id]);
    return { ...row, ...(map.get(id) ?? {}) };
  } catch {
    return row;
  }
}

/**
 * Fire record-triggered automations after a successful create/update/delete.
 * Safe to call from actions, records helpers, and inbound — never throws.
 * Snapshots without `cf_*` keys are enriched with current custom values.
 */
export async function onRecordMutation(options: {
  entity: EntityType;
  id: number;
  kind: MutationKind;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  const beforeRaw =
    options.before !== undefined
      ? options.before
      : options.kind === "created"
        ? null
        : await snapshot(options.entity, options.id).catch(() => null);
  const afterRaw =
    options.after !== undefined
      ? options.after
      : options.kind === "deleted"
        ? null
        : await snapshot(options.entity, options.id).catch(() => null);

  const [before, after] = await Promise.all([
    enrichWithCustom(options.entity, options.id, beforeRaw),
    enrichWithCustom(options.entity, options.id, afterRaw),
  ]);

  await dispatchRecordMutation({
    entity: options.entity,
    id: options.id,
    kind: options.kind,
    before,
    after,
  });
}
