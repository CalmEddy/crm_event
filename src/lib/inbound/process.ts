import { addDays, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  contacts,
  eventContacts,
  events,
  getDb,
  inboundEmails,
  taskGroupApplications,
  tasks,
  taskTemplates,
} from "@/db";
import { dueOnFromEventDate } from "@/lib/offsets";
import { htmlOrTextToBody, parseInboundBody } from "@/lib/inbound/parse";

export type ProcessInboundInput = {
  providerMessageId: string;
  subject: string | null;
  fromAddress: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
};

export type ProcessInboundResult = {
  status: "created" | "failed" | "duplicate";
  inboundEmailId: number;
  contactId?: number;
  eventId?: number;
  error?: string;
};

function placeholderStartsAt(now = new Date()) {
  // +30 days at local noon — staff replace with a real show time in Greenroom.
  const day = addDays(now, 30);
  return setMilliseconds(setSeconds(setMinutes(setHours(day, 12), 0), 0), 0);
}

async function maybeApplyDefaultTaskGroup(eventId: number, startsAt: Date) {
  const raw = process.env.INBOUND_DEFAULT_TASK_GROUP_ID?.trim() ?? "";
  if (!raw) return;
  const taskGroupId = Number(raw);
  if (!Number.isFinite(taskGroupId) || taskGroupId <= 0) return;

  const db = await getDb();
  const templates = await db
    .select()
    .from(taskTemplates)
    .where(eq(taskTemplates.taskGroupId, taskGroupId))
    .orderBy(asc(taskTemplates.sortOrder), asc(taskTemplates.id));
  if (templates.length === 0) return;

  const [existingApplication] = await db
    .select()
    .from(taskGroupApplications)
    .where(
      and(
        eq(taskGroupApplications.eventId, eventId),
        eq(taskGroupApplications.taskGroupId, taskGroupId),
      ),
    );
  if (existingApplication) return;

  await db.insert(tasks).values(
    templates.map((template) => ({
      title: template.title,
      kind: template.kind,
      dueOn: dueOnFromEventDate(startsAt, template.offsetDays),
      status: "todo" as const,
      eventId,
      taskGroupId,
      taskTemplateId: template.id,
    })),
  );
  await db.insert(taskGroupApplications).values({ eventId, taskGroupId });
}

export async function processInboundEmail(
  input: ProcessInboundInput,
): Promise<ProcessInboundResult> {
  const db = await getDb();

  const [existing] = await db
    .select()
    .from(inboundEmails)
    .where(eq(inboundEmails.providerMessageId, input.providerMessageId))
    .limit(1);

  if (existing) {
    return {
      status: "duplicate",
      inboundEmailId: existing.id,
      contactId: existing.contactId ?? undefined,
      eventId: existing.eventId ?? undefined,
      error: existing.error ?? undefined,
    };
  }

  const body = htmlOrTextToBody(input.bodyText, input.bodyHtml);
  const { fields, missing } = parseInboundBody(body);

  if (missing.length > 0) {
    const error = `Missing required field(s): ${missing.join(", ")}`;
    try {
      const [row] = await db
        .insert(inboundEmails)
        .values({
          providerMessageId: input.providerMessageId,
          subject: input.subject,
          fromAddress: input.fromAddress,
          status: "failed",
          error,
        })
        .returning();
      return { status: "failed", inboundEmailId: row.id, error };
    } catch (err) {
      const [race] = await db
        .select()
        .from(inboundEmails)
        .where(eq(inboundEmails.providerMessageId, input.providerMessageId))
        .limit(1);
      if (race) {
        return {
          status: "duplicate",
          inboundEmailId: race.id,
          contactId: race.contactId ?? undefined,
          eventId: race.eventId ?? undefined,
          error: race.error ?? undefined,
        };
      }
      throw err;
    }
  }

  const name = fields.name!.trim();
  const email = fields.email!.trim().toLowerCase();
  const phone = fields.phone!.trim();
  const notes = fields.notes?.trim() || null;

  const [matched] = await db
    .select()
    .from(contacts)
    .where(sql`lower(${contacts.email}) = ${email}`)
    .limit(1);

  let contactId: number;
  if (matched) {
    const [updated] = await db
      .update(contacts)
      .set({
        name,
        email,
        phone,
        notes: notes ?? matched.notes,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, matched.id))
      .returning();
    contactId = updated.id;
  } else {
    const [created] = await db
      .insert(contacts)
      .values({
        name,
        email,
        phone,
        notes,
        role: "buyer",
      })
      .returning();
    contactId = created.id;
  }

  const startsAt = placeholderStartsAt();
  const [event] = await db
    .insert(events)
    .values({
      title: `Event request — ${name}`,
      startsAt,
      status: "inquiry",
      notes,
    })
    .returning();

  await db.insert(eventContacts).values({
    eventId: event.id,
    contactId,
    role: "buyer",
  });

  try {
    await maybeApplyDefaultTaskGroup(event.id, startsAt);
  } catch {
    // Optional auto-apply must not fail the intake.
  }

  try {
    const [row] = await db
      .insert(inboundEmails)
      .values({
        providerMessageId: input.providerMessageId,
        subject: input.subject,
        fromAddress: input.fromAddress,
        status: "created",
        contactId,
        eventId: event.id,
      })
      .returning();

    return {
      status: "created",
      inboundEmailId: row.id,
      contactId,
      eventId: event.id,
    };
  } catch (err) {
    const [race] = await db
      .select()
      .from(inboundEmails)
      .where(eq(inboundEmails.providerMessageId, input.providerMessageId))
      .limit(1);
    if (race) {
      return {
        status: "duplicate",
        inboundEmailId: race.id,
        contactId: race.contactId ?? undefined,
        eventId: race.eventId ?? undefined,
        error: race.error ?? undefined,
      };
    }
    throw err;
  }
}
