"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import { Badge, Section, SubmitButton, inputClassName } from "@/components/ui";
import {
  disconnectTelegram,
  finishTelegramLink,
  saveNotificationSettings,
  sendMyReminderNow,
  sendTestNotification,
  startTelegramLink,
  type SettingsState,
} from "@/lib/actions/notification-settings";
import {
  CHANNELS,
  CHANNEL_LABELS,
  KINDS,
  LEAD_DAY_OPTIONS,
  prefKey,
  type Channel,
} from "@/lib/notifications/prefs-shared";

const FORM_ID = "notification-settings";
const cardClass = "rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4 text-sm";

function Status({ state }: { state: SettingsState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-[color:var(--danger)]">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="text-sm text-[color:var(--accent)]">
        {state.ok}
      </p>
    );
  }
  return null;
}

/** A button that runs an action and shows its result underneath. */
function ActionButton({
  action,
  children,
  pendingLabel = "Working…",
}: {
  action: (prev: SettingsState) => Promise<SettingsState>;
  children: ReactNode;
  pendingLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<SettingsState>(action, {});
  return (
    <form action={formAction} className="space-y-2">
      <SubmitButton variant="secondary">{pending ? pendingLabel : children}</SubmitButton>
      <Status state={state} />
    </form>
  );
}

function ChannelCard({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <div className={`${cardClass} space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-[color:var(--ink)]">{title}</h3>
        <Badge>{badge}</Badge>
      </div>
      {children}
    </div>
  );
}

export function NotificationSettings({
  email,
  phone,
  leadDays,
  prefs,
  configured,
  telegram,
}: {
  email: string;
  phone: string | null;
  leadDays: number;
  prefs: Record<string, boolean>;
  configured: Record<Channel, boolean>;
  telegram: { connected: boolean; code: string | null; botUsername: string | null };
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    saveNotificationSettings,
    {},
  );
  const notSetUp = "Not set up on this server";
  const muted = "text-[color:var(--muted)]";

  return (
    <div className="space-y-8">
      <Section title="Where to reach you">
        <div className="grid gap-4 md:grid-cols-3">
          <ChannelCard title="Email" badge={configured.email ? "Ready" : notSetUp}>
            <p>{email}</p>
            <p className={`text-xs ${muted}`}>Your account email. Change it on the Users page.</p>
            {configured.email ? (
              <ActionButton action={sendTestNotification.bind(null, "email")} pendingLabel="Sending…">
                Send test email
              </ActionButton>
            ) : null}
          </ChannelCard>

          <ChannelCard
            title="Text message"
            badge={!configured.sms ? notSetUp : phone ? "Ready" : "Add a number"}
          >
            <label className="block space-y-1.5">
              <span className="font-medium">Mobile number</span>
              <input
                form={FORM_ID}
                className={inputClassName}
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+1 555 010 2000"
                defaultValue={phone ?? ""}
              />
              <span className={`block text-xs ${muted}`}>
                Include the country code. Texts are short: a headline and a link. Saved with the button below.
              </span>
            </label>
            {configured.sms && phone ? (
              <ActionButton action={sendTestNotification.bind(null, "sms")} pendingLabel="Sending…">
                Send test text
              </ActionButton>
            ) : null}
          </ChannelCard>

          <ChannelCard
            title="Telegram"
            badge={!configured.telegram ? notSetUp : telegram.connected ? "Connected" : "Not connected"}
          >
            {!configured.telegram ? (
              <p className={muted}>
                Telegram needs a bot token on the server before anyone can connect.
              </p>
            ) : telegram.connected ? (
              <>
                <p>Messages go to your private chat with the Greenroom bot.</p>
                <div className="flex flex-wrap items-start gap-2">
                  <ActionButton action={sendTestNotification.bind(null, "telegram")} pendingLabel="Sending…">
                    Send test message
                  </ActionButton>
                  <form action={disconnectTelegram}>
                    <SubmitButton variant="secondary">Disconnect</SubmitButton>
                  </form>
                </div>
              </>
            ) : telegram.code ? (
              <>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>
                    {telegram.botUsername ? (
                      <>
                        Open{" "}
                        <a
                          className="text-[color:var(--accent)] underline"
                          href={`https://t.me/${telegram.botUsername}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          @{telegram.botUsername}
                        </a>{" "}
                        in Telegram
                      </>
                    ) : (
                      <>Open the Greenroom bot in Telegram</>
                    )}
                  </li>
                  <li>
                    Send this exact message (copy/paste):{" "}
                    <code className="select-all">/start {telegram.code}</code>
                  </li>
                  <li>Come back here and finish.</li>
                </ol>
                <p className={muted}>
                  If the bot was already started, tapping Start on a link does nothing — typing the
                  command above is what connects you.
                </p>
                <div className="flex flex-wrap items-start gap-2">
                  <ActionButton action={finishTelegramLink} pendingLabel="Checking…">
                    Finish connecting
                  </ActionButton>
                  <form action={disconnectTelegram}>
                    <SubmitButton variant="secondary">Cancel</SubmitButton>
                  </form>
                </div>
              </>
            ) : (
              <>
                <p className={muted}>Get notifications in a private chat with the Greenroom bot.</p>
                <form action={startTelegramLink}>
                  <SubmitButton variant="secondary">Connect Telegram</SubmitButton>
                </form>
              </>
            )}
          </ChannelCard>
        </div>
      </Section>

      {/* Submitted by hand so a rejected save keeps what was typed (form actions reset the form). */}
      <form
        id={FORM_ID}
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
      >
        <Section title="What to send">
          <div className="overflow-x-auto rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--line)] bg-[color:var(--panel-soft)] text-left text-xs uppercase tracking-wide text-[color:var(--muted)]">
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Notify me about
                  </th>
                  {CHANNELS.map((channel) => (
                    <th key={channel} scope="col" className="px-4 py-2 text-center font-semibold">
                      {CHANNEL_LABELS[channel]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {KINDS.map((item) => (
                  <tr key={item.kind}>
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <div className="font-medium text-[color:var(--ink)]">{item.label}</div>
                      <div className={`text-xs ${muted}`}>{item.description}</div>
                    </th>
                    {CHANNELS.map((channel) => (
                      <td key={channel} className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="size-4 accent-[color:var(--accent)]"
                          name={`pref:${prefKey(item.kind, channel)}`}
                          defaultChecked={prefs[prefKey(item.kind, channel)]}
                          aria-label={`${item.label}: ${CHANNEL_LABELS[channel]}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`text-xs ${muted}`}>
            You are never notified about changes you make yourself. A ticked channel only sends once it
            shows Ready or Connected above.
          </p>
        </Section>

        <Section title="Task reminders">
          <div className={`${cardClass} space-y-3`}>
            <label className="block max-w-sm space-y-1.5">
              <span className="font-medium">Start reminding me</span>
              <select className={inputClassName} name="reminderLeadDays" defaultValue={String(leadDays)}>
                {LEAD_DAY_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days === 0
                      ? "On the due date"
                      : `${days} day${days === 1 ? "" : "s"} before the due date`}
                  </option>
                ))}
              </select>
            </label>
            <p className={`text-xs ${muted}`}>
              The reminder goes out once a day and keeps listing a task until it is done or skipped,
              including after it is overdue.
            </p>
          </div>
        </Section>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>{pending ? "Saving…" : "Save settings"}</SubmitButton>
          <Status state={state} />
        </div>
      </form>

      <Section title="Try it">
        <div className={`${cardClass} space-y-2`}>
          <p className={muted}>
            Send today&apos;s task reminder right now, using your saved settings.
          </p>
          <ActionButton action={sendMyReminderNow} pendingLabel="Sending…">
            Send my task reminder now
          </ActionButton>
        </div>
      </Section>
    </div>
  );
}
