import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Section } from "@/components/ui";
import type { EntityType } from "@/db";
import { listActivity, type ActivityItem } from "@/lib/activity";
import { entityHref } from "@/lib/entities";
import { VIEW_CONFIGS } from "@/lib/views/fields";

const VERB: Record<string, string> = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  assigned: "assigned",
  unassigned: "unassigned",
};

export function ActivityList({ items, showRecord }: { items: ActivityItem[]; showRecord?: boolean }) {
  if (items.length === 0) {
    return <p className="py-4 text-sm text-[color:var(--muted)]">No activity yet.</p>;
  }
  return (
    <ol className="space-y-3 border-l border-[color:var(--line)] pl-4 text-sm">
      {items.map((item) => {
        const config = VIEW_CONFIGS[item.entity];
        return (
          <li key={item.id} className="relative">
            <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-[color:var(--accent)]" aria-hidden />
            <div>
              <span className="font-medium">{item.userName ?? "System"}</span>{" "}
              {VERB[item.action] ?? item.action}{" "}
              {showRecord ? (
                <>
                  {config.label.toLowerCase()}{" "}
                  {item.action === "deleted" ? (
                    <span className="font-medium">{item.label}</span>
                  ) : (
                    <Link href={entityHref(item.entity, item.entityId)} className="font-medium text-[color:var(--accent)]">
                      {item.label || `#${item.entityId}`}
                    </Link>
                  )}
                </>
              ) : null}
              {item.action === "assigned" || item.action === "unassigned" ? (
                <span className="text-[color:var(--muted)]"> {item.action === "assigned" ? "→" : "✕"} {item.detail}</span>
              ) : null}
            </div>
            {item.action === "updated" && item.detail ? (
              <div className="text-[color:var(--muted)]">{item.detail}</div>
            ) : null}
            <time
              dateTime={item.createdAt.toISOString()}
              title={item.createdAt.toLocaleString()}
              className="text-xs text-[color:var(--muted)]"
            >
              {formatDistanceToNow(item.createdAt, { addSuffix: true })}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

/** History panel for a record's detail page. */
export async function ActivityTimeline({ entity, id }: { entity: EntityType; id: number }) {
  const items = await listActivity({ entity, entityId: id }, 50);
  return (
    <Section title="Activity">
      <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
        <ActivityList items={items} />
      </div>
    </Section>
  );
}
