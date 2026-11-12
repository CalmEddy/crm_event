"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eventContacts, events, getDb } from "@/db";
import { EVENT_STATUSES, type EventStatus } from "@/lib/constants";
import { deletePolymorphicRefsForEntity } from "@/lib/entities";

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

  // datetime-local yields "YYYY-MM-DDTHH:mm" (no timezone). Normalize so Node
  // and hosted runtimes parse consistently.
  const normalizedStartsAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAtRaw)
    ? `${startsAtRaw}:00`
    : startsAtRaw;
  const startsAt = new Date(normalizedStartsAt);
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

export async function createEvent(formData: FormData) {
  const fields = readEventFields(formData);
  const db = await getDb();
  const [row] = await db.insert(events).values(fields).returning();
  revalidatePath("/events");
  revalidatePath("/");
  redirect(`/events/${row.id}`);
}

export async function updateEvent(id: number, formData: FormData) {
  const fields = readEventFields(formData);
  const db = await getDb();
  await db
    .update(events)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(events.id, id));
  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  revalidatePath("/");
  redirect(`/events/${id}`);
}

export async function deleteEvent(id: number) {
  await deletePolymorphicRefsForEntity({ type: "event", id });
  const db = await getDb();
  await db.delete(events).where(eq(events.id, id));
  revalidatePath("/events");
  revalidatePath("/notes");
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
