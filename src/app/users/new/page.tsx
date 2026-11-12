import { connection } from "next/server";
import { UserForm } from "@/components/forms/user-form";
import { PageHeader } from "@/components/ui";
import { createUser } from "@/lib/actions/users";

export default async function NewUserPage() {
  await connection();
  return (
    <div>
      <PageHeader title="New user" />
      <UserForm action={createUser} />
    </div>
  );
}
