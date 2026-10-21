import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <AuthHeading title="Create your account" description="Start keeping track of everyone you meet." />
      <SignupForm />
    </>
  );
}
