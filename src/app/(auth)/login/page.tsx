import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Log In" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-center text-xl font-semibold tracking-tight">
        Log in to Zale
      </h1>
      <AuthForm mode="login" />
    </>
  );
}
