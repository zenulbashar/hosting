import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { computeUsage, getPlan, listInvoices } from "@/lib/billing";
import { UsageView } from "@/components/usage-view";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Usage & Billing" };
export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Usage & Billing"
        description="Resource consumption across all of your projects, and your plan."
      />
      <UsageView
        plan={await getPlan(user.id)}
        usage={await computeUsage(user.id)}
        invoices={await listInvoices(user.id, user.created_at)}
      />
    </main>
  );
}
