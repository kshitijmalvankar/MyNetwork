import type { Metadata } from "next";
import { getProfile, requireUser } from "@/lib/auth/dal";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  return (
    <ProfileForm
      email={user.email}
      displayName={profile?.display_name ?? ""}
      timezone={profile?.timezone ?? "UTC"}
      phoneRegion={profile?.phone_region ?? "US"}
    />
  );
}
