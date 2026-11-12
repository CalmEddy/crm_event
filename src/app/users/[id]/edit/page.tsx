import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { UserForm } from "@/components/forms/user-form";
import { PageHeader, SubmitButton } from "@/components/ui";
import { getDb, users } from "@/db";
import { deleteUser, updateUser } from "@/lib/actions/users";

export default async function EditUserPage({
  params,
}: PageProps<"/users/[id]/edit">) {
  await connection();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${user.name}`}
        actions={
          <form action={deleteUser.bind(null, id)}>
            <SubmitButton variant="danger">Delete</SubmitButton>
          </form>
        }
      />
      <UserForm user={user} action={updateUser.bind(null, id)} />
    </div>
  );
}
