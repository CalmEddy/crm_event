"use server";

import { refresh } from "next/cache";
import { contacts, events, getDb, organizations } from "@/db";
import { requireSignedIn } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import { isEntityType, revalidateEntityPaths } from "@/lib/entities";
import { FieldError, insertRecord, parsePatch } from "@/lib/records";
import { VIEW_CONFIGS, isEditableField } from "@/lib/views/fields";

const MAX_ROWS = 500;

export type ImportResult =
  | { ok: true; created: number; skipped: { row: number; error: string }[]; ignoredColumns: string[] }
  | { ok: false; error: string };

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Create records from CSV. Headers match field labels or keys (e.g. "Due" or
 * "dueOn"); relation columns match by name. Each row goes through the same
 * parsers as inline edits; bad rows are skipped and reported.
 */
export async function importCsv(entity: string, text: string): Promise<ImportResult> {
  await requireSignedIn();
  if (!isEntityType(entity)) return { ok: false, error: "Unknown record type." };
  if (text.length > 2_000_000) return { ok: false, error: "File is too large (2 MB max)." };
  const config = VIEW_CONFIGS[entity];
  const [header, ...body] = parseCsv(text);
  if (!header || body.length === 0) return { ok: false, error: "The file has no data rows." };
  if (body.length > MAX_ROWS) return { ok: false, error: `Import at most ${MAX_ROWS} rows at a time.` };

  const columns = header.map((name) =>
    config.fields.find(
      (f) => isEditableField(entity, f.key) && (norm(f.label) === norm(name) || norm(f.key) === norm(name)),
    ),
  );
  if (!columns.some((f) => f?.key === config.titleKey)) {
    const title = config.fields.find((f) => f.key === config.titleKey)?.label ?? config.titleKey;
    return { ok: false, error: `Add a "${title}" column.` };
  }

  // Name -> id lookups for relation columns.
  const db = await getDb();
  const lookups: Record<string, Map<string, number>> = {};
  const relationTables = {
    event: { table: events, label: events.title },
    contact: { table: contacts, label: contacts.name },
    organization: { table: organizations, label: organizations.name },
  } as const;
  for (const field of columns) {
    if (field?.type !== "relation" || lookups[field.key]) continue;
    const target = relationTables[field.key as keyof typeof relationTables];
    if (!target) continue;
    const rows = await db.select({ id: target.table.id, label: target.label }).from(target.table);
    lookups[field.key] = new Map(rows.map((row) => [row.label.trim().toLowerCase(), row.id]));
  }

  let created = 0;
  const skipped: { row: number; error: string }[] = [];
  const ids: number[] = [];
  for (const [index, values] of body.entries()) {
    const input: Record<string, string | null> = {};
    try {
      columns.forEach((field, col) => {
        if (!field) return;
        const raw = (values[col] ?? "").trim();
        if (field.type === "relation") {
          if (!raw) return;
          const id = lookups[field.key]?.get(raw.toLowerCase());
          if (!id) throw new FieldError(`${field.label} "${raw}" not found`);
          input[field.key] = String(id);
        } else if (raw) {
          input[field.key] = field.type === "datetime" ? new Date(raw).toISOString() : raw;
        }
      });
      const id = await insertRecord(entity, parsePatch(entity, input));
      ids.push(id);
      created++;
    } catch (error) {
      const message =
        error instanceof FieldError
          ? error.message
          : error instanceof RangeError
            ? "Invalid date"
            : "Couldn't save this row";
      skipped.push({ row: index + 2, error: message });
    }
  }
  if (ids.length) revalidateEntityPaths(ids.map((id) => ({ type: entity, id })));
  refresh();
  return {
    ok: true,
    created,
    skipped: skipped.slice(0, 20),
    ignoredColumns: header.filter((_, i) => !columns[i]),
  };
}
