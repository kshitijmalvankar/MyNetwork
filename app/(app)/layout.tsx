import { AppDock } from "@/components/shell/app-dock";
import { AppRail } from "@/components/shell/app-rail";
import { CommandMenuProvider } from "@/components/shell/command-menu";
import { getProfile, requireUser } from "@/lib/auth/dal";

/**
 * The signed-in shell: a floating rail on desktop and a floating dock on
 * phones, with no header, so pages start right at the top. Search lives in the
 * rail, the phone's More sheet and ⌘K.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const shellUser = { email: user.email, displayName: profile?.display_name ?? null };

  return (
    <CommandMenuProvider>
      <div aria-hidden className="app-glow pointer-events-none fixed inset-x-0 top-0 -z-10 h-[40rem]" />
      <AppRail user={shellUser} />
      <main className="flex min-h-svh flex-1 flex-col pt-safe pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-[5.5rem]">{children}</main>
      <AppDock user={shellUser} />
    </CommandMenuProvider>
  );
}
