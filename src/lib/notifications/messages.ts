import { formatDate, formatDateTime } from "@/lib/format";
import { labelize } from "@/lib/constants";
import { appBaseUrl } from "@/lib/notifications/resend-send";

type EventSummary = {
  id: number;
  title: string;
  status: string;
  startsAt: Date;
};

type TaskSummary = {
  id: number;
  title: string;
  status: string;
  dueOn: string;
  kind: string;
  eventId: number | null;
  eventTitle?: string | null;
};

export function eventAssignedMessage(event: EventSummary) {
  const url = `${appBaseUrl()}/events/${event.id}`;
  return {
    subject: `Assigned to event: ${event.title}`,
    body: [
      `You were assigned to an event in Greenroom.`,
      "",
      `Title: ${event.title}`,
      `Status: ${labelize(event.status)}`,
      `Starts: ${formatDateTime(event.startsAt)}`,
      "",
      `Open: ${url}`,
    ].join("\n"),
  };
}

export function eventChangedMessage(event: EventSummary, action: string) {
  const url = `${appBaseUrl()}/events/${event.id}`;
  return {
    subject: `Event ${action}: ${event.title}`,
    body: [
      `An event you are assigned to was ${action}.`,
      "",
      `Title: ${event.title}`,
      `Status: ${labelize(event.status)}`,
      `Starts: ${formatDateTime(event.startsAt)}`,
      "",
      `Open: ${url}`,
    ].join("\n"),
  };
}

export function eventDeletedMessage(event: EventSummary) {
  return {
    subject: `Event deleted: ${event.title}`,
    body: [
      `An event you were assigned to was deleted.`,
      "",
      `Title: ${event.title}`,
      `Status: ${labelize(event.status)}`,
      `Starts: ${formatDateTime(event.startsAt)}`,
    ].join("\n"),
  };
}

export function taskAssignedMessage(task: TaskSummary) {
  const url = `${appBaseUrl()}/tasks/${task.id}/edit`;
  return {
    subject: `Assigned to task: ${task.title}`,
    body: [
      `You were assigned to a task in Greenroom.`,
      "",
      `Title: ${task.title}`,
      `Status: ${labelize(task.status)}`,
      `Kind: ${labelize(task.kind)}`,
      `Due: ${formatDate(task.dueOn)}`,
      task.eventTitle ? `Event: ${task.eventTitle}` : null,
      "",
      `Open: ${url}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function taskChangedMessage(task: TaskSummary, action: string) {
  const url = `${appBaseUrl()}/tasks/${task.id}/edit`;
  return {
    subject: `Task ${action}: ${task.title}`,
    body: [
      `A task you are assigned to was ${action}.`,
      "",
      `Title: ${task.title}`,
      `Status: ${labelize(task.status)}`,
      `Kind: ${labelize(task.kind)}`,
      `Due: ${formatDate(task.dueOn)}`,
      task.eventTitle ? `Event: ${task.eventTitle}` : null,
      "",
      `Open: ${url}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function taskDeletedMessage(task: TaskSummary) {
  return {
    subject: `Task deleted: ${task.title}`,
    body: [
      `A task you were assigned to was deleted.`,
      "",
      `Title: ${task.title}`,
      `Status: ${labelize(task.status)}`,
      `Due: ${formatDate(task.dueOn)}`,
      task.eventTitle ? `Event: ${task.eventTitle}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
