"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NetworkIcon, SearchIcon } from "lucide-react";
import { useCommandMenu } from "@/components/shell/command-menu";
import { UserMenu, type ShellUser } from "@/components/shell/user-menu";
import { Kbd } from "@/components/ui/kbd";
import { isActive, primaryNav, secondaryNav, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ROW = "flex h-11 w-full items-center gap-3 rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** A round icon chip; the active one carries the coral highlight that slides between items. */
function Chip({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      style={active ? { viewTransitionName: "rail-active" } : undefined}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 [&_svg]:size-5",
        active ? "bg-brand-subtle text-brand shadow-glow-sm" : "group-hover/row:bg-accent group-hover/row:text-foreground",
      )}
    >
      {children}
    </span>
  );
}

function RailLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(ROW, "group/row")}>
      <Chip active={active}>
        <item.icon />
      </Chip>
      <span className={cn("rail-label truncate text-sm font-medium", active ? "text-foreground" : "text-muted-foreground group-hover/row:text-foreground")}>
        {item.label}
      </span>
    </Link>
  );
}

/**
 * Desktop navigation: a slim floating rail of icons that opens to show labels
 * on hover or keyboard focus. Only clip-path and opacity animate (see
 * `.app-rail` in globals.css), so the page never reflows.
 */
export function AppRail({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const search = useCommandMenu();
  const navRef = useRef<HTMLElement>(null);

  // Open while the pointer is over the rail. This tracks the pointer rather than
  // using :hover, which browsers drop during a page transition: the rail would
  // snap shut and reopen every time you clicked one of its links.
  useEffect(() => {
    const nav = navRef.current;
    const panel = nav?.querySelector<HTMLElement>(".rail-panel");
    if (!nav || !panel) return;
    const setOpen = (open: boolean) => nav.toggleAttribute("data-open", open);
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const rail = nav.getBoundingClientRect();
      const right = rail.left + (nav.hasAttribute("data-open") ? panel.offsetWidth : rail.width);
      setOpen(e.clientX >= rail.left && e.clientX <= right && e.clientY >= rail.top && e.clientY <= rail.bottom);
    };
    const onLeave = () => setOpen(false);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    // Named on the nav, not the clipped panel: a page transition's snapshot of an element ignores
    // that element's own clip-path, which would show the rail fully open for a moment.
    <nav
      ref={navRef}
      aria-label="Primary"
      className="app-rail fixed inset-y-3 left-3 z-40 hidden w-16 md:block"
      style={{ viewTransitionName: "app-rail" }}
    >
      {/* Shadows sit outside the clipped panel: one for the slim rail, one that fades in as it opens.
          Neither takes clicks; the wide one is invisible while the rail is closed but covers the page. */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 rounded-[1.75rem] shadow-float ring-1 ring-(--float-edge)" />
      <div aria-hidden className="rail-wide pointer-events-none absolute inset-y-0 left-0 w-60 rounded-[1.75rem] shadow-float ring-1 ring-(--float-edge)" />

      {/* Opaque, because a named ancestor would stop a backdrop blur from seeing the page behind. */}
      <div className="rail-panel absolute inset-y-0 left-0 flex w-60 flex-col gap-1 rounded-[1.75rem] bg-card p-3 shadow-[inset_0_1px_0_var(--float-highlight)]">
        <Link href="/home" className={cn(ROW, "mb-2")}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-glow-sm">
            <NetworkIcon className="size-5" />
          </span>
          <span className="rail-label text-[15px] font-semibold tracking-tight">MyNetwork</span>
        </Link>

        <button type="button" onClick={search.open} className={cn(ROW, "group/row")}>
          <Chip>
            <SearchIcon />
          </Chip>
          <span className="rail-label flex flex-1 items-center justify-between pr-2 text-sm font-medium text-muted-foreground group-hover/row:text-foreground">
            Search <Kbd>⌘K</Kbd>
          </span>
        </button>

        <div className="-mx-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 [scrollbar-width:none]">
          {primaryNav.map((item) => (
            <RailLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        {secondaryNav.map((item) => (
          <RailLink key={item.href} item={item} pathname={pathname} />
        ))}
        <UserMenu user={user} />
      </div>
    </nav>
  );
}
