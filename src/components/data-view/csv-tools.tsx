"use client";

import { useRef, useState, useTransition } from "react";
import { importCsv, type ImportResult } from "@/lib/actions/import";
import { toCsv } from "@/lib/csv";
import type { EntityViewConfig, ViewRow } from "@/lib/views/fields";
import { cellText } from "@/lib/views/query";

const button =
  "rounded-md border border-[color:var(--line)] bg-white px-2.5 py-1 text-sm hover:bg-[color:var(--panel-soft)]";

/** Export the rows/columns currently shown; import new records from CSV. */
export function CsvTools({
  config,
  rows,
  cols,
}: {
  config: EntityViewConfig;
  rows: ViewRow[];
  cols: string[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function exportCsv() {
    const fields = cols
      .map((key) => config.fields.find((f) => f.key === key))
      .filter((f) => f != null);
    const csv = toCsv([
      fields.map((f) => f.label),
      ...rows.map((row) => fields.map((f) => cellText(row.values[f.key]))),
    ]);
    const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${config.pluralLabel.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    startTransition(async () => {
      setResult(await importCsv(config.entity, await file.text()));
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" className={button} onClick={exportCsv} disabled={rows.length === 0}>
        Export CSV
      </button>
      <button type="button" className={button} onClick={() => fileRef.current?.click()} disabled={pending}>
        {pending ? "Importing…" : "Import CSV"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-label={`Import ${config.pluralLabel} from CSV`}
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      {result ? (
        <div role="status" className="relative">
          <div className="absolute right-0 top-2 z-40 w-80 rounded-lg border border-[color:var(--line)] bg-white p-3 text-sm shadow-lg">
            {result.ok ? (
              <>
                <p className="font-medium">
                  Imported {result.created}{" "}
                  {(result.created === 1 ? config.label : config.pluralLabel).toLowerCase()}.
                </p>
                {result.ignoredColumns.length ? (
                  <p className="text-[color:var(--muted)]">Ignored columns: {result.ignoredColumns.join(", ")}</p>
                ) : null}
                {result.skipped.length ? (
                  <ul className="mt-1 max-h-32 overflow-y-auto text-[color:var(--danger)]">
                    {result.skipped.map((s) => (
                      <li key={s.row}>
                        Row {s.row}: {s.error}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="text-[color:var(--danger)]">{result.error}</p>
            )}
            <button type="button" className="mt-2 text-xs text-[color:var(--accent)]" onClick={() => setResult(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
