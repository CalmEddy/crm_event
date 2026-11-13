import { PageHeader } from "@/components/ui";

export default function SignedOutPage() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <PageHeader
        title="Sign in required"
        description="Greenroom is a private staff CRM. Sign in with Cursor to continue."
      />
    </div>
  );
}
