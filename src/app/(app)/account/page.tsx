import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, listApiTokens } from "@/lib/auth";
import { AccountSettings } from "@/components/account-forms";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader title="Account Settings" />
      <AccountSettings
        initialName={user.name}
        email={user.email}
        initialTokens={await listApiTokens(user.id)}
      />
    </main>
  );
}
