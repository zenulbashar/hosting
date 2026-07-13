import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPlan } from "@/lib/billing";
import { DashboardNav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="border-b border-forest-edge bg-forest">
        <DashboardNav userName={user.name} email={user.email} planName={getPlan(user.id).name} />
      </header>
      {children}
    </div>
  );
}
