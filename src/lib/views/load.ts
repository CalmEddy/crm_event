import { and, asc, eq, inArray, or } from "drizzle-orm";
import {
  contacts,
  eventAssignees,
  events,
  getDb,
  organizations,
  recordOwners,
  savedViews,
  taskAssignees,
  tasks,
  users,
  type EntityType,
} from "@/db";
import { loadCustomValues } from "@/lib/custom-fields";
import { loadRecordTags } from "@/lib/tags";
import type { Ref, ViewRow } from "@/lib/views/fields";

function toDate(value: Date | string | null) {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function groupRefs(rows: { ownerId: number; id: number; label: string }[]) {
  const map = new Map<number, Ref[]>();
  for (const row of rows) {
    const list = map.get(row.ownerId) ?? [];
    list.push({ id: row.id, label: row.label });
    map.set(row.ownerId, list);
  }
  return map;
}

/** Rows for DataView, including custom field values (keys "cf_<id>"). */
export async function loadViewRows(entity: EntityType): Promise<ViewRow[]> {
  const hasOwners = entity === "contact" || entity === "organization";
  const [rows, custom, tagMap, owners] = await Promise.all([
    loadBaseRows(entity),
    loadCustomValues(entity),
    loadRecordTags(entity),
    hasOwners ? loadOwners(entity) : Promise.resolve(new Map<number, Ref[]>()),
  ]);
  return rows.map((row) => ({
    ...row,
    values: {
      ...row.values,
      ...custom.get(row.id),
      tags: tagMap.get(row.id) ?? [],
      ...(hasOwners ? { owners: owners.get(row.id) ?? [] } : {}),
    },
  }));
}

async function loadOwners(entity: EntityType): Promise<Map<number, Ref[]>> {
  const db = await getDb();
  return groupRefs(
    await db
      .select({ ownerId: recordOwners.entityId, id: users.id, label: users.name })
      .from(recordOwners)
      .innerJoin(users, eq(recordOwners.userId, users.id))
      .where(eq(recordOwners.entity, entity)),
  );
}

async function loadBaseRows(entity: EntityType): Promise<ViewRow[]> {
  const db = await getDb();
  switch (entity) {
    case "task": {
      const rows = await db
        .select({
          task: tasks,
          eventTitle: events.title,
          contactName: contacts.name,
        })
        .from(tasks)
        .leftJoin(events, eq(tasks.eventId, events.id))
        .leftJoin(contacts, eq(tasks.contactId, contacts.id))
        .orderBy(asc(tasks.dueOn));
      const ids = rows.map((row) => row.task.id);
      const assignees = groupRefs(
        ids.length
          ? await db
              .select({ ownerId: taskAssignees.taskId, id: users.id, label: users.name })
              .from(taskAssignees)
              .innerJoin(users, eq(taskAssignees.userId, users.id))
              .where(inArray(taskAssignees.taskId, ids))
          : [],
      );
      return rows.map(({ task, eventTitle, contactName }) => ({
        id: task.id,
        values: {
          title: task.title,
          dueOn: toDate(task.dueOn),
          status: task.status,
          kind: task.kind,
          assignees: assignees.get(task.id) ?? [],
          event: task.eventId ? { id: task.eventId, label: eventTitle ?? `Event #${task.eventId}` } : null,
          contact: task.contactId ? { id: task.contactId, label: contactName ?? `Contact #${task.contactId}` } : null,
        },
      }));
    }
    case "event": {
      const rows = await db.select().from(events).orderBy(asc(events.startsAt));
      const ids = rows.map((row) => row.id);
      const assignees = groupRefs(
        ids.length
          ? await db
              .select({ ownerId: eventAssignees.eventId, id: users.id, label: users.name })
              .from(eventAssignees)
              .innerJoin(users, eq(eventAssignees.userId, users.id))
              .where(inArray(eventAssignees.eventId, ids))
          : [],
      );
      return rows.map((event) => ({
        id: event.id,
        values: {
          title: event.title,
          startsAt: toDate(event.startsAt),
          venue: event.venue,
          location: event.location,
          status: event.status,
          assignees: assignees.get(event.id) ?? [],
        },
      }));
    }
    case "contact": {
      const rows = await db
        .select({ contact: contacts, orgName: organizations.name })
        .from(contacts)
        .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
        .orderBy(asc(contacts.name));
      return rows.map(({ contact, orgName }) => ({
        id: contact.id,
        values: {
          name: contact.name,
          role: contact.role,
          organization: contact.organizationId
            ? { id: contact.organizationId, label: orgName ?? `Organization #${contact.organizationId}` }
            : null,
          email: contact.email,
          phone: contact.phone,
          mobile: contact.mobile,
          website: contact.website,
          address: contact.address,
          city: contact.city,
          region: contact.region,
          postalCode: contact.postalCode,
          country: contact.country,
        },
      }));
    }
    case "organization": {
      const rows = await db.select().from(organizations).orderBy(asc(organizations.name));
      return rows.map((org) => ({
        id: org.id,
        values: {
          name: org.name,
          type: org.type,
          city: org.city,
          address: org.address,
          email: org.email,
          phone: org.phone,
          website: org.website,
          region: org.region,
          postalCode: org.postalCode,
          country: org.country,
        },
      }));
    }
  }
}

export type SavedViewSummary = {
  id: number;
  name: string;
  query: string;
  shared: boolean;
  mine: boolean;
};

export async function loadSavedViews(
  entity: EntityType,
  userId: number | null,
): Promise<SavedViewSummary[]> {
  const db = await getDb();
  const visibility =
    userId != null
      ? or(eq(savedViews.userId, userId), eq(savedViews.shared, true))
      : eq(savedViews.shared, true);
  const rows = await db
    .select()
    .from(savedViews)
    .where(and(eq(savedViews.entity, entity), visibility))
    .orderBy(asc(savedViews.createdAt));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    query: row.query,
    shared: row.shared,
    mine: row.userId === userId,
  }));
}
