"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, mobileTabs, type NavItem } from "@/lib/nav";

function Tab({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors",
        active && "text-foreground",
      )}
    >
      <item.icon className={cn("size-5", active && "text-brand")} />
      {item.label}
    </Link>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const Scan = mobileTabs.scan;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-safe backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 md:hidden"
    >
      <div className="mx-auto flex max-w-md items-end px-2">
        {mobileTabs.left.map((item) => (
          <Tab key={item.href} item={item} pathname={pathname} />
        ))}
        <div className="flex flex-1 justify-center">
          <Link
            href={Scan.href}
            aria-label={Scan.label}
            className="-mt-5 flex size-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-lg shadow-brand/30 ring-4 ring-background transition-transform active:scale-95"
          >
            <Scan.icon className="size-6" />
          </Link>
        </div>
        {mobileTabs.right.map((item) => (
          <Tab key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}
