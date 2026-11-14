import { and, eq } from "drizzle-orm";
import {
  eventAssignees,
  getDb,
  recordOwners,
  taskAssignees,
  users,
  type EntityType,
} from "@/db";
import { getCurrentUserId, listActiveUsers } from "@/lib/current-user";
import { listTags, loadRecordTags } from "@/lib/tags";
import { RecordMetaEditor } from "./record-meta-editor";

async function loadPeople(entity: EntityType, id: number) {
  const db = await getDb();
  if (entity === "task") {
    return db
      .select({ id: users.id, label: users.name })
      .from(taskAssignees)
      .innerJoin(users, eq(users.id, taskAssignees.userId))
      .where(eq(taskAssignees.taskId, id));
  }
  if (entity === "event") {
    return db
      .select({ id: users.id, label: users.name })
      .from(eventAssignees)
      .innerJoin(users, eq(users.id, eventAssignees.userId))
      .where(eq(eventAssignees.eventId, id));
  }
  return db
    .select({ id: users.id, label: users.name })
    .from(recordOwners)
    .innerJoin(users, eq(users.id, recordOwners.userId))
    .where(and(eq(recordOwners.entity, entity), eq(recordOwners.entityId, id)));
}

/** Tags and people (assignees for events/tasks, owners for contacts/orgs). */
export async function RecordMetaPanel({ entity, id }: { entity: EntityType; id: number }) {
  const [allTags, tagMap, activeUsers, currentUserId, people] = await Promise.all([
    listTags(),
    loadRecordTags(entity, [id]),
    listActiveUsers(),
    getCurrentUserId(),
    loadPeople(entity, id),
  ]);
  return (
    <RecordMetaEditor
      entity={entity}
      id={id}
      tags={tagMap.get(id) ?? []}
      allTags={allTags}
      people={people}
      peopleLabel={entity === "task" || entity === "event" ? "Assignees" : "Owners"}
      users={activeUsers.map((u) => ({ id: u.id, label: u.name }))}
      currentUserId={currentUserId}
    />
  );
}
