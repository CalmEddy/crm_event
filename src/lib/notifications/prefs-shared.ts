// Notification kinds and channels. Safe to import from client components.

export const CHANNELS = ["email", "sms", "telegram"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email",
  sms: "Text message",
  telegram: "Telegram",
};

export const KINDS = [
  {
    kind: "task_due",
    label: "Tasks coming due",
    description: "A daily reminder listing your open tasks that are overdue, due today or coming up.",
  },
  {
    kind: "assignment",
    label: "Assigned to me",
    description: "You are assigned to a task or event, or made an owner of a contact or organization.",
  },
  {
    kind: "record_change",
    label: "Changes to my items",
    description: "Someone else edits or deletes a task, event, contact or organization you own or are assigned to.",
  },
  {
    kind: "note_added",
    label: "Notes on my items",
    description: "Someone else adds a note to a record you own or are assigned to.",
  },
] as const;

export type NotificationKind = (typeof KINDS)[number]["kind"];

export const LEAD_DAY_OPTIONS = [0, 1, 2, 3, 7, 14] as const;

/** With no saved preference: email on, text and Telegram off. */
export function defaultEnabled(_kind: NotificationKind, channel: Channel) {
  return channel === "email";
}

export function prefKey(kind: string, channel: string) {
  return `${kind}:${channel}`;
}

export function isKind(value: string): value is NotificationKind {
  return KINDS.some((item) => item.kind === value);
}

export function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}
