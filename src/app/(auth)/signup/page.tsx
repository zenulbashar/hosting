import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign Up" };

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-6 text-center text-xl font-semibold tracking-tight">
        Create your account
      </h1>
      <AuthForm mode="signup" />
    </>
  );
}
