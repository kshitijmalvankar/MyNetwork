"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EllipsisIcon, LogOutIcon, SearchIcon } from "lucide-react";
import { useCommandMenu } from "@/components/shell/command-menu";
import { ThemeToggle, UserAvatar, type ShellUser } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { dockTabs, isActive, moreNav, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

const TAB =
  "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] font-medium text-muted-foreground outline-none transition-transform duration-300 ease-spring active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/50";

/** The pill behind the active tab's icon; it slides to the new tab when you change section. */
function TabIcon({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      style={active ? { viewTransitionName: "dock-active" } : undefined}
      className={cn(
        "flex h-8 w-12 items-center justify-center rounded-full transition-colors duration-150 [&_svg]:size-[1.375rem]",
        active && "bg-brand-subtle text-brand shadow-glow-sm",
      )}
    >
      {children}
    </span>
  );
}

function Tab({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(TAB, active && "text-foreground")}>
      <TabIcon active={active}>
        <item.icon />
      </TabIcon>
      {item.label}
    </Link>
  );
}

/**
 * Phone navigation: a frosted pill floating above the page, with Scan in the
 * middle and a More sheet for everything else.
 */
export function AppDock({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const moreActive = moreNav.some((item) => isActive(pathname, item.href));
  const Scan = dockTabs.scan;
  const scanActive = isActive(pathname, Scan.href);

  return (
    <>
      <nav aria-label="Primary" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
        <div
          style={{ viewTransitionName: "app-dock" }}
          className="pointer-events-auto mx-auto flex h-16 max-w-md items-center rounded-full bg-card/80 px-1.5 shadow-float backdrop-blur-xl backdrop-saturate-150 dark:bg-card/75"
        >
          {dockTabs.left.map((item) => (
            <Tab key={item.href} item={item} pathname={pathname} />
          ))}
          <Link
            href={Scan.href}
            aria-label={Scan.label}
            aria-current={scanActive ? "page" : undefined}
            className={cn(
              "mx-1 flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-glow outline-none transition-transform duration-300 ease-spring active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/50",
              scanActive && "ring-4 ring-brand/20",
            )}
          >
            <Scan.icon className="size-[1.375rem]" />
          </Link>
          {dockTabs.right.map((item) => (
            <Tab key={item.href} item={item} pathname={pathname} />
          ))}
          <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={cn(TAB, moreActive && "text-foreground")}>
            <TabIcon active={moreActive}>
              <EllipsisIcon />
            </TabIcon>
            More
          </button>
        </div>
      </nav>
      <MoreSheet user={user} open={more} onOpenChange={setMore} pathname={pathname} />
    </>
  );
}

function MoreSheet({ user, open, onOpenChange, pathname }: { user: ShellUser; open: boolean; onOpenChange: (open: boolean) => void; pathname: string }) {
  const search = useCommandMenu();
  const close = () => onOpenChange(false);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {/* A floating panel like the dock, not a sheet stuck to the screen edge. */}
      <DrawerContent className="mx-auto max-w-md bg-popover/90 pb-4 shadow-float backdrop-blur-xl backdrop-saturate-150 data-[vaul-drawer-direction=bottom]:inset-x-3 data-[vaul-drawer-direction=bottom]:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] data-[vaul-drawer-direction=bottom]:rounded-[2rem]">
        <DrawerTitle className="sr-only">More</DrawerTitle>
        <DrawerDescription className="sr-only">Search, other sections and your account</DrawerDescription>
        <div className="space-y-5 overflow-y-auto px-4 pt-4">
          <button
            type="button"
            onClick={() => {
              close();
              search.open();
            }}
            className="flex h-11 w-full items-center gap-2.5 rounded-full bg-muted px-4 text-[15px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <SearchIcon className="size-4" /> Search people…
          </button>

          <ul className="grid grid-cols-3 gap-2">
            {moreNav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl bg-muted/60 px-2 py-3.5 text-sm font-medium outline-none transition-transform duration-300 ease-spring active:scale-95 focus-visible:ring-2 focus-visible:ring-ring/50",
                      active && "bg-brand-subtle text-brand",
                    )}
                  >
                    <item.icon className="size-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="space-y-3 rounded-2xl bg-muted/60 p-3">
            <div className="flex items-center gap-3">
              <UserAvatar user={user} />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-medium">{user.displayName || user.email}</p>
                {user.displayName && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
              </div>
              <form action="/auth/signout" method="post">
                <Button type="submit" variant="ghost" size="sm">
                  <LogOutIcon /> Sign out
                </Button>
              </form>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
