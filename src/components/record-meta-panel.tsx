import { and, eq } from "drizzle-orm";
import { getDb, recordOwners, users, type EntityType } from "@/db";
import { getCurrentUserId, listActiveUsers } from "@/lib/current-user";
import { listTags, loadRecordTags } from "@/lib/tags";
import { RecordMetaEditor } from "./record-meta-editor";

/** Tags (all records) and owners (contacts, organizations) on detail pages. */
export async function RecordMetaPanel({ entity, id }: { entity: EntityType; id: number }) {
  const withOwners = entity === "contact" || entity === "organization";
  const db = await getDb();
  const [allTags, tagMap, activeUsers, currentUserId, owners] = await Promise.all([
    listTags(),
    loadRecordTags(entity, [id]),
    withOwners ? listActiveUsers() : Promise.resolve([]),
    getCurrentUserId(),
    withOwners
      ? db
          .select({ id: users.id, label: users.name })
          .from(recordOwners)
          .innerJoin(users, eq(users.id, recordOwners.userId))
          .where(and(eq(recordOwners.entity, entity), eq(recordOwners.entityId, id)))
      : Promise.resolve([]),
  ]);
  return (
    <RecordMetaEditor
      entity={entity}
      id={id}
      tags={tagMap.get(id) ?? []}
      allTags={allTags}
      owners={withOwners ? owners : null}
      users={activeUsers.map((u) => ({ id: u.id, label: u.name }))}
      currentUserId={currentUserId}
    />
  );
}
