"use client";

import { useRef, type ReactNode } from "react";

/**
 * "+ Add" button that opens its children in a modal dialog. Submitting a form
 * inside closes it (the server action then refreshes the page).
 */
export function AddDialog({
  label = "+ Add",
  title,
  children,
  closeOnSubmit = true,
}: {
  label?: string;
  title: string;
  children: ReactNode;
  closeOnSubmit?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded-md border border-[color:var(--line)] bg-white px-3 py-1.5 text-sm font-medium text-[color:var(--accent)] hover:bg-[color:var(--panel-soft)]"
      >
        {label}
      </button>
      <dialog
        ref={ref}
        aria-label={title}
        onClick={(event) => {
          // Click on the backdrop (the dialog element itself) closes it.
          if (event.target === ref.current) ref.current?.close();
        }}
        onSubmit={() => {
          if (closeOnSubmit) setTimeout(() => ref.current?.close(), 0);
        }}
        className="m-auto max-h-[calc(100vh-4rem)] w-[min(36rem,calc(100vw-2rem))] overflow-visible rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-0 text-[color:var(--ink)] shadow-xl backdrop:bg-black/30"
      >
        <div className="flex items-center justify-between border-b border-[color:var(--line)] px-5 py-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => ref.current?.close()}
            className="rounded px-2 py-1 text-[color:var(--muted)] hover:bg-[color:var(--panel-soft)]"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </dialog>
    </>
  );
}
