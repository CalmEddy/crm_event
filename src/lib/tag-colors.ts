// Tag palette (client-safe). Light chip backgrounds with readable text.
export const TAG_COLORS = {
  slate: { label: "Gray", chip: "bg-slate-100 text-slate-800 border-slate-200" },
  red: { label: "Red", chip: "bg-red-100 text-red-800 border-red-200" },
  amber: { label: "Amber", chip: "bg-amber-100 text-amber-900 border-amber-200" },
  green: { label: "Green", chip: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  blue: { label: "Blue", chip: "bg-sky-100 text-sky-800 border-sky-200" },
  violet: { label: "Violet", chip: "bg-violet-100 text-violet-800 border-violet-200" },
  pink: { label: "Pink", chip: "bg-pink-100 text-pink-800 border-pink-200" },
} as const;
export type TagColor = keyof typeof TAG_COLORS;

export const isTagColor = (value: string): value is TagColor => value in TAG_COLORS;

export function tagChipClass(color: string | undefined) {
  return TAG_COLORS[color && isTagColor(color) ? color : "slate"].chip;
}

export type TagOption = { id: number; label: string; color: string };
