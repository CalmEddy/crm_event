"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eventContacts, events, getDb } from "@/db";
import {
  listEventAssigneeIds,
  readAssigneeIds,
  replaceEventAssignees,
} from "@/lib/assignees";
import { EVENT_STATUSES, type EventStatus } from "@/lib/constants";
import { getCurrentUserId } from "@/lib/current-user";
import {
  eventAssignedMessage,
  eventChangedMessage,
  eventDeletedMessage,
} from "@/lib/notifications/messages";
import { notifyUsers } from "@/lib/notifications/notify";

function readEventFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const startsAtRaw = String(formData.get("startsAt") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const venue = String(formData.get("venue") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "inquiry") as EventStatus;
  const venueOrgRaw = String(formData.get("venueOrganizationId") ?? "").trim();
  const venueOrganizationId = venueOrgRaw ? Number(venueOrgRaw) : null;

  if (!title) throw new Error("Title is required");
  if (!startsAtRaw) throw new Error("Start date/time is required");
  if (!EVENT_STATUSES.includes(status)) throw new Error("Invalid status");

  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) throw new Error("Invalid start date");

  return {
    title,
    startsAt,
    location,
    venue,
    notes,
    status,
    venueOrganizationId:
      venueOrganizationId && Number.isFinite(venueOrganizationId)
        ? venueOrganizationId
        : null,
  };
}

async function notifyEventAssignees(options: {
  event: {
    id: number;
    title: string;
    status: string;
    startsAt: Date;
  };
  assigneeIds: number[];
  addedIds?: number[];
  action: "created" | "updated" | "deleted";
}) {
  const actorUserId = await getCurrentUserId();
  const stamp = Date.now();

  if (options.addedIds && options.addedIds.length > 0) {
    const message = eventAssignedMessage(options.event);
    await notifyUsers({
      kind: "assignment",
      entityType: "event",
      entityId: options.event.id,
      userIds: options.addedIds,
      subject: message.subject,
      body: message.body,
      dedupeKeyPrefix: `assignment:event:${options.event.id}:${stamp}`,
      actorUserId,
    });
  }

  if (options.action === "created") {
    // Assignment email above covers create-time assignees.
    return;
  }

  if (options.action === "deleted") {
    const message = eventDeletedMessage(options.event);
    await notifyUsers({
      kind: "record_change",
      entityType: "event",
      entityId: options.event.id,
      userIds: options.assigneeIds,
      subject: message.subject,
      body: message.body,
      dedupeKeyPrefix: `record_change:event:${options.event.id}:deleted:${stamp}`,
      actorUserId,
    });
    return;
  }

  const message = eventChangedMessage(options.event, options.action);
  await notifyUsers({
    kind: "record_change",
    entityType: "event",
    entityId: options.event.id,
    userIds: options.assigneeIds,
    subject: message.subject,
    body: message.body,
    dedupeKeyPrefix: `record_change:event:${options.event.id}:${options.action}:${stamp}`,
    actorUserId,
  });
}

export async function createEvent(formData: FormData) {
  const fields = readEventFields(formData);
  const assigneeIds = readAssigneeIds(formData);
  const db = await getDb();
  const [row] = await db.insert(events).values(fields).returning();
  const { next, added } = await replaceEventAssignees(row.id, assigneeIds);
  await notifyEventAssignees({
    event: row,
    assigneeIds: next,
    addedIds: added,
    action: "created",
  });
  revalidatePath("/events");
  revalidatePath("/");
  redirect(`/events/${row.id}`);
}

export async function updateEvent(id: number, formData: FormData) {
  const fields = readEventFields(formData);
  const assigneeIds = readAssigneeIds(formData);
  const db = await getDb();
  const [row] = await db
    .update(events)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning();
  const { next, added } = await replaceEventAssignees(id, assigneeIds);
  if (row) {
    await notifyEventAssignees({
      event: row,
      assigneeIds: next,
      addedIds: added,
      action: "updated",
    });
  }
  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  revalidatePath("/");
  redirect(`/events/${id}`);
}

export async function deleteEvent(id: number) {
  const db = await getDb();
  const [existing] = await db.select().from(events).where(eq(events.id, id));
  const assigneeIds = existing ? await listEventAssigneeIds(id) : [];
  await db.delete(events).where(eq(events.id, id));
  if (existing) {
    await notifyEventAssignees({
      event: existing,
      assigneeIds,
      action: "deleted",
    });
  }
  revalidatePath("/events");
  revalidatePath("/");
  redirect("/events");
}

export async function addEventLink(eventId: number, formData: FormData) {
  const role = String(formData.get("role") ?? "contact").trim() || "contact";
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const contactRaw = String(formData.get("contactId") ?? "").trim();
  const orgRaw = String(formData.get("organizationId") ?? "").trim();
  const contactId = contactRaw ? Number(contactRaw) : null;
  const organizationId = orgRaw ? Number(orgRaw) : null;

  if (!contactId && !organizationId) {
    throw new Error("Pick a contact or organization");
  }

  const db = await getDb();
  await db.insert(eventContacts).values({
    eventId,
    contactId: contactId && Number.isFinite(contactId) ? contactId : null,
    organizationId:
      organizationId && Number.isFinite(organizationId) ? organizationId : null,
    role,
    notes,
  });

  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

export async function removeEventLink(eventId: number, linkId: number) {
  const db = await getDb();
  await db
    .delete(eventContacts)
    .where(and(eq(eventContacts.id, linkId), eq(eventContacts.eventId, eventId)));
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}
