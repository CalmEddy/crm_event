"use client";

import { useState, useTransition } from "react";
import {
  disconnectGoogleCalendar,
  runGoogleCalendarSyncNow,
  updateGoogleCalendarPrefs,
} from "@/lib/actions/google-calendar";
import { formatDateTime } from "@/lib/format";

export function CalendarSettings({
  configured,
  account,
}: {
  configured: boolean;
  account: {
    googleEmail: string | null;
    syncTasks: boolean;
    syncEvents: boolean;
    enabled: boolean;
    lastSyncedAt: Date | string | null;
    lastError: string | null;
  } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [syncTasks, setSyncTasks] = useState(account?.syncTasks ?? true);
  const [syncEvents, setSyncEvents] = useState(account?.syncEvents ?? true);
  const [enabled, setEnabled] = useState(account?.enabled ?? true);
  const [message, setMessage] = useState<string | null>(null);

  if (!configured) {
    return (
      <p className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4 text-sm text-[color:var(--muted)]">
        Google Calendar sync is not configured on this server. Set{" "}
        <code className="text-[color:var(--ink)]">GOOGLE_CLIENT_ID</code> and{" "}
        <code className="text-[color:var(--ink)]">GOOGLE_CLIENT_SECRET</code>{" "}
        (and optional{" "}
        <code className="text-[color:var(--ink)]">GOOGLE_REDIRECT_URI</code>), then
        restart.
      </p>
    );
  }

  if (!account) {
    return (
      <div className="space-y-4 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
        <p className="text-sm text-[color:var(--muted)]">
          Connect your Google account to push tasks you are assigned (all-day on
          the due date) and events you are assigned (timed from start) into your
          Google Calendar.
        </p>
        <a
          href="/api/google/oauth/start"
          className="inline-flex rounded-md bg-[color:var(--accent)] px-3.5 py-2 text-sm font-medium text-white"
        >
          Connect Google Calendar
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
      <div className="text-sm">
        <p className="font-medium text-[color:var(--ink)]">
          Connected{account.googleEmail ? ` as ${account.googleEmail}` : ""}
        </p>
        <p className="text-[color:var(--muted)]">
          Last sync:{" "}
          {account.lastSyncedAt
            ? formatDateTime(account.lastSyncedAt)
            : "never"}
        </p>
        {account.lastError ? (
          <p className="mt-1 text-[color:var(--danger)]" role="alert">
            {account.lastError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Sync enabled
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={syncTasks}
            onChange={(e) => setSyncTasks(e.target.checked)}
          />
          Sync my assigned tasks
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={syncEvents}
            onChange={(e) => setSyncEvents(e.target.checked)}
          />
          Sync my assigned events
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="rounded-md bg-[color:var(--accent)] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              const res = await updateGoogleCalendarPrefs({
                syncTasks,
                syncEvents,
                enabled,
              });
              setMessage(res.ok ? "Preferences saved." : res.error);
            })
          }
        >
          Save preferences
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-md border border-[color:var(--line)] px-3.5 py-2 text-sm disabled:opacity-60"
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              const res = await runGoogleCalendarSyncNow();
              setMessage(res.ok ? res.detail ?? "Synced." : res.error);
            })
          }
        >
          Sync now
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded-md bg-[color:var(--danger)] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              const res = await disconnectGoogleCalendar();
              setMessage(res.ok ? "Disconnected." : res.error);
              if (res.ok) window.location.reload();
            })
          }
        >
          Disconnect
        </button>
      </div>

      {message ? (
        <p className="text-sm text-[color:var(--ink)]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
