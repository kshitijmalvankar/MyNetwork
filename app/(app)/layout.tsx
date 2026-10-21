import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { CommandMenu } from "@/components/shell/command-menu";
import { MobileNav } from "@/components/shell/mobile-nav";
import { getProfile, requireUser } from "@/lib/auth/dal";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  return (
    <SidebarProvider>
      <AppSidebar user={{ email: user.email, displayName: profile?.display_name ?? null }} />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-xl md:rounded-t-xl">
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
          <Separator orientation="vertical" className="mr-1 hidden h-4 md:block" />
          <div className="flex-1 sm:flex-none">
            <CommandMenu />
          </div>
        </header>
        <main className="flex-1 pb-28 md:pb-0">{children}</main>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}
