import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen flex-col items-center px-6 pt-[16vh]">
      <div className="hero-grid absolute inset-0" aria-hidden />
      <div className="relative flex w-full flex-col items-center">
        <Logo />
        <div className="mt-8 w-full max-w-sm rounded-xl border border-edge bg-surface p-7">
          {children}
        </div>
      </div>
    </div>
  );
}
