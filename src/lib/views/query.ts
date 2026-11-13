// Parse view state from URL search params and apply it to rows (client-side).
import type {
  CellValue,
  EntityViewConfig,
  FieldDef,
  Ref,
  ViewRow,
} from "@/lib/views/fields";

export const VIEW_TYPES = ["table", "list", "board", "calendar"] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

export type ViewState = {
  view: ViewType;
  q: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  group: string;
  board: string;
  cols: string[];
  /** key -> selected values (enum/users/relation) or "from..to" (dates) */
  filters: Record<string, string[]>;
  month: string;
};

export const FILTER_PREFIX = "f.";
export const ME = "me";

export function availableViews(config: EntityViewConfig): ViewType[] {
  return VIEW_TYPES.filter(
    (view) =>
      (view !== "calendar" || config.calendarKey) &&
      (view !== "board" || config.fields.some((f) => f.type === "enum" || f.type === "users")),
  );
}

export function parseViewState(
  params: URLSearchParams,
  config: EntityViewConfig,
): ViewState {
  const views = availableViews(config);
  const rawView = params.get("view") as ViewType | null;
  const view = rawView && views.includes(rawView) ? rawView : "table";
  const keys = new Set(config.fields.map((f) => f.key));

  const rawSort = params.get("sort") ?? config.defaultSort;
  const sortDir = rawSort.startsWith("-") ? "desc" : "asc";
  const sortKey = keys.has(rawSort.replace(/^-/, ""))
    ? rawSort.replace(/^-/, "")
    : config.defaultSort;

  const group = params.get("group") ?? "";
  const boardParam = params.get("board") ?? config.boardKey ?? "";
  const enumKeys = config.fields
    .filter((f) => f.type === "enum" || f.type === "users")
    .map((f) => f.key);
  const board = enumKeys.includes(boardParam) ? boardParam : (enumKeys[0] ?? "");

  const colsParam = params.get("cols");
  const cols = colsParam
    ? colsParam.split(",").filter((key) => keys.has(key))
    : config.fields.filter((f) => !f.hiddenByDefault).map((f) => f.key);

  const filters: Record<string, string[]> = {};
  for (const [name, value] of params.entries()) {
    if (!name.startsWith(FILTER_PREFIX)) continue;
    const key = name.slice(FILTER_PREFIX.length);
    if (!keys.has(key) || !value) continue;
    filters[key] = value.split(",").filter(Boolean);
  }

  return {
    view,
    q: params.get("q") ?? "",
    sortKey,
    sortDir,
    group: keys.has(group) ? group : "",
    board,
    cols: cols.length ? cols : [config.titleKey],
    filters,
    month: params.get("month") ?? "",
  };
}

export function cellText(value: CellValue | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((ref) => ref.label).join(", ");
  return value.label;
}

function refIds(value: CellValue | undefined): string[] {
  if (value == null || typeof value === "string") return [];
  if (Array.isArray(value)) return value.map((ref) => String(ref.id));
  return [String((value as Ref).id)];
}

function matchesFilter(
  field: FieldDef,
  value: CellValue | undefined,
  selected: string[],
  currentUserId: number | null,
) {
  if (selected.length === 0) return true;
  switch (field.type) {
    case "enum":
      return typeof value === "string" && selected.includes(value);
    case "users":
    case "tags":
    case "relation": {
      const ids = refIds(value);
      return selected.some((choice) => {
        if (choice === "none") return ids.length === 0;
        if (choice === ME) return currentUserId != null && ids.includes(String(currentUserId));
        return ids.includes(choice);
      });
    }
    case "date":
    case "datetime": {
      const [from = "", to = ""] = (selected[0] ?? "").split("..");
      if (typeof value !== "string") return false;
      const day = value.slice(0, 10);
      return (!from || day >= from) && (!to || day <= to);
    }
    case "text": {
      const text = cellText(value).toLowerCase();
      return selected.some((choice) => text.includes(choice.toLowerCase()));
    }
  }
}

export function applyViewState(
  rows: ViewRow[],
  config: EntityViewConfig,
  state: ViewState,
  currentUserId: number | null,
): ViewRow[] {
  const q = state.q.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (q) {
      const haystack = config.fields
        .map((field) => cellText(row.values[field.key]))
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    for (const [key, selected] of Object.entries(state.filters)) {
      const field = config.fields.find((f) => f.key === key);
      if (field && !matchesFilter(field, row.values[key], selected, currentUserId)) {
        return false;
      }
    }
    return true;
  });

  const dir = state.sortDir === "asc" ? 1 : -1;
  return filtered.sort((a, b) => {
    const left = cellText(a.values[state.sortKey]);
    const right = cellText(b.values[state.sortKey]);
    if (!left && right) return 1;
    if (left && !right) return -1;
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }) * dir;
  });
}

/** Group key(s) for a row: users fields put a row in each assignee's group. */
export function groupKeys(field: FieldDef, value: CellValue | undefined): string[] {
  if (value == null || (Array.isArray(value) && value.length === 0)) return [""];
  if (Array.isArray(value)) return value.map((ref) => ref.label);
  if (typeof value === "string") {
    if (field.type === "date" || field.type === "datetime") return [value.slice(0, 7)];
    return [value];
  }
  return [value.label];
}
