import { connection } from "next/server";
import { PageHeader } from "@/components/ui";
import { ensureSeedData } from "@/db/seed";
import { listTags, tagUsage } from "@/lib/tags";
import { TagManager } from "./tag-manager";

export default async function TagsPage() {
  await connection();
  await ensureSeedData();
  const [tags, usage] = await Promise.all([listTags(), tagUsage()]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tags"
        description="Tags work across events, tasks, contacts and organizations. Add them from any list or record page; rename, recolor or delete them here."
      />
      <TagManager tags={tags.map((tag) => ({ ...tag, uses: usage.get(tag.id) ?? 0 }))} />
    </div>
  );
}
