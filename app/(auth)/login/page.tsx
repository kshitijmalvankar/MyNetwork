import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { safeNext } from "@/lib/auth/routes";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const notices: Record<string, string> = {
  confirmed: "Your email is confirmed. Sign in to continue.",
  link: "That link is invalid or has expired. Please try again.",
  "signed-out": "You've been signed out.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? safeNext(params.next) : undefined;
  const notice = typeof params.notice === "string" ? notices[params.notice] : undefined;

  return (
    <>
      <AuthHeading title="Welcome back" description="Sign in to your network." />
      <LoginForm next={next} notice={notice} />
    </>
  );
}
