import { count, eq } from "drizzle-orm";
import { addDays, setHours, setMinutes } from "date-fns";
import {
  contacts,
  eventAssignees,
  eventContacts,
  events,
  getDb,
  organizations,
  taskAssignees,
  taskGroupApplications,
  taskGroups,
  tasks,
  taskTemplates,
  users,
} from "@/db";
import { dueOnFromEventDate } from "@/lib/offsets";

export async function ensureSeedData() {
  const db = await getDb();
  const [{ value: orgCount }] = await db
    .select({ value: count() })
    .from(organizations);

  if (orgCount > 0) return { seeded: false as const };

  const [club] = await db
    .insert(organizations)
    .values({
      name: "Laugh Track Lounge",
      type: "club",
      address: "418 Comedy Row",
      city: "Chicago",
      notes: "Two-room club with late show on Fridays.",
    })
    .returning();

  const [agency] = await db
    .insert(organizations)
    .values({
      name: "Midwest Mirth Agency",
      type: "agency",
      city: "Chicago",
      notes: "Handles regional club routing.",
    })
    .returning();

  const [buyer] = await db
    .insert(contacts)
    .values({
      name: "Dana Ortiz",
      email: "dana@laughtrack.example",
      phone: "312-555-0148",
      role: "Buyer",
      organizationId: club.id,
      notes: "Prefers email for offer confirmations.",
    })
    .returning();

  const [performer] = await db
    .insert(contacts)
    .values({
      name: "Jules Park",
      email: "jules@example.com",
      phone: "773-555-0199",
      role: "Comic",
      organizationId: agency.id,
      notes: "Road set + clean late show.",
    })
    .returning();

  const [travel] = await db
    .insert(contacts)
    .values({
      name: "Sam Rivera",
      email: "sam@midwestmirth.example",
      role: "Travel coordinator",
      organizationId: agency.id,
    })
    .returning();

  const [booker] = await db
    .insert(users)
    .values({
      name: "Alex Chen",
      email: "alex@midwestmirth.example",
      active: true,
    })
    .returning();

  const [travelStaff] = await db
    .insert(users)
    .values({
      name: "Morgan Blake",
      email: "morgan@midwestmirth.example",
      active: true,
    })
    .returning();

  await db.insert(users).values({
    name: "Riley Quinn",
    email: "riley@midwestmirth.example",
    active: true,
  });

  const startsAt = setMinutes(setHours(addDays(new Date(), 21), 20), 0);

  const [event] = await db
    .insert(events)
    .values({
      title: "Jules Park · Friday Late",
      startsAt,
      location: "Chicago, IL",
      venue: "Laugh Track Lounge — Main Room",
      venueOrganizationId: club.id,
      status: "booked",
      notes: "Sample comedy-club booking used for local development.",
    })
    .returning();

  await db.insert(eventContacts).values([
    {
      eventId: event.id,
      contactId: performer.id,
      role: "performer",
    },
    {
      eventId: event.id,
      contactId: buyer.id,
      organizationId: club.id,
      role: "buyer",
    },
    {
      eventId: event.id,
      contactId: travel.id,
      role: "travel",
    },
    {
      eventId: event.id,
      organizationId: club.id,
      role: "venue contact",
    },
  ]);

  const [group] = await db
    .insert(taskGroups)
    .values({
      name: "Standard booking",
      description:
        "Default comedy booking pack: preliminary call, follow-up email, and postcard.",
    })
    .returning();

  await db.insert(taskTemplates).values([
    {
      taskGroupId: group.id,
      title: "Preliminary call",
      kind: "call",
      offsetDays: -14,
      sortOrder: 0,
    },
    {
      taskGroupId: group.id,
      title: "Follow-up email",
      kind: "email",
      offsetDays: 2,
      sortOrder: 1,
    },
    {
      taskGroupId: group.id,
      title: "Postcard",
      kind: "follow_up",
      offsetDays: 182,
      sortOrder: 2,
    },
  ]);

  const templates = await db
    .select()
    .from(taskTemplates)
    .where(eq(taskTemplates.taskGroupId, group.id));

  const createdTasks = await db
    .insert(tasks)
    .values(
      templates.map((template) => ({
        title: template.title,
        kind: template.kind,
        dueOn: dueOnFromEventDate(event.startsAt, template.offsetDays),
        status: "todo" as const,
        eventId: event.id,
        taskGroupId: group.id,
        taskTemplateId: template.id,
      })),
    )
    .returning();

  await db.insert(taskGroupApplications).values({
    eventId: event.id,
    taskGroupId: group.id,
  });

  await db.insert(eventAssignees).values([
    { eventId: event.id, userId: booker.id },
    { eventId: event.id, userId: travelStaff.id },
  ]);

  await db.insert(taskAssignees).values(
    createdTasks.flatMap((task) => [
      { taskId: task.id, userId: booker.id },
      { taskId: task.id, userId: travelStaff.id },
    ]),
  );

  return { seeded: true as const, eventId: event.id };
}
