// Notifications for the people behind a record: assignees of tasks and
// events, owners of contacts and organizations.
import { and, eq } from "drizzle-orm";
import { getDb, recordOwners, type EntityType } from "@/db";
import { listEventAssigneeIds, listTaskAssigneeIds } from "@/lib/assignees";
import { getCurrentUserId } from "@/lib/current-user";
import { entityHref, entityTypeLabel, resolveEntityLabel, type EntityRef } from "@/lib/entities";
import { notifyUsers } from "@/lib/notifications/notify";
import { appBaseUrl } from "@/lib/notifications/resend-send";

/** Users who own (contacts, organizations) or are assigned to (tasks, events) a record. */
export async function audienceIds(ref: EntityRef): Promise<number[]> {
  if (ref.type === "task") return listTaskAssigneeIds(ref.id);
  if (ref.type === "event") return listEventAssigneeIds(ref.id);
  const db = await getDb();
  const rows = await db
    .select({ userId: recordOwners.userId })
    .from(recordOwners)
    .where(and(eq(recordOwners.entity, ref.type), eq(recordOwners.entityId, ref.id)));
  return rows.map((row) => row.userId);
}

function recordUrl(ref: EntityRef) {
  return `${appBaseUrl()}${entityHref(ref.type, ref.id)}`;
}

/** Tell the owners of a contact or organization that it was edited or deleted. */
export async function notifyOwnersOfChange(
  entity: Extract<EntityType, "contact" | "organization">,
  id: number,
  action: "updated" | "deleted",
) {
  const ref = { type: entity, id };
  const userIds = await audienceIds(ref);
  if (userIds.length === 0) return;
  const kind = entityTypeLabel(entity);
  const name = await resolveEntityLabel(ref);
  const url = action === "deleted" ? null : recordUrl(ref);
  await notifyUsers({
    kind: "record_change",
    entityType: entity,
    entityId: id,
    userIds,
    subject: `${kind} ${action}: ${name}`,
    body: [
      `${kind === "Organization" ? "An organization" : "A contact"} you own in Greenroom was ${action}.`,
      "",
      `Name: ${name}`,
      ...(url ? ["", `Open: ${url}`] : []),
    ].join("\n"),
    url,
    dedupeKeyPrefix: `record_change:${entity}:${id}:${action}:${Date.now()}`,
    actorUserId: await getCurrentUserId(),
  });
}

/** Tell users they were made an owner of a contact or organization. */
export async function notifyOwnersAdded(
  entity: Extract<EntityType, "contact" | "organization">,
  id: number,
  userIds: number[],
) {
  if (userIds.length === 0) return;
  const ref = { type: entity, id };
  const kind = entityTypeLabel(entity).toLowerCase();
  const name = await resolveEntityLabel(ref);
  const url = recordUrl(ref);
  await notifyUsers({
    kind: "assignment",
    entityType: entity,
    entityId: id,
    userIds,
    subject: `You now own ${kind}: ${name}`,
    body: [`You were made an owner of a ${kind} in Greenroom.`, "", `Name: ${name}`, "", `Open: ${url}`].join("\n"),
    url,
    dedupeKeyPrefix: `assignment:${entity}:${id}:${Date.now()}`,
    actorUserId: await getCurrentUserId(),
  });
}

/** Tell the people behind each record a new note is attached to. One message per person. */
export async function notifyNoteAdded(noteId: number, body: string, targets: EntityRef[]) {
  const actorUserId = await getCurrentUserId();
  const excerpt = body.length > 600 ? `${body.slice(0, 600)}...` : body;
  for (const ref of targets) {
    const userIds = await audienceIds(ref);
    if (userIds.length === 0) continue;
    const name = await resolveEntityLabel(ref);
    const url = recordUrl(ref);
    await notifyUsers({
      kind: "note_added",
      entityType: ref.type,
      entityId: ref.id,
      userIds,
      subject: `New note on ${entityTypeLabel(ref.type).toLowerCase()}: ${name}`,
      body: [`A note was added to ${name} in Greenroom.`, "", excerpt, "", `Open: ${url}`].join("\n"),
      url,
      // Same key for every record the note is on, so nobody hears twice.
      dedupeKeyPrefix: `note_added:${noteId}`,
      actorUserId,
    });
  }
}
