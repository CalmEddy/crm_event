import { connection } from "next/server";
import { UserForm } from "@/components/forms/user-form";
import { PageHeader } from "@/components/ui";
import { requireSignedIn } from "@/lib/auth";

export default async function NewUserPage() {
  await connection();
  await requireSignedIn();
  return (
    <div>
      <PageHeader title="New user" />
      <UserForm />
    </div>
  );
}
