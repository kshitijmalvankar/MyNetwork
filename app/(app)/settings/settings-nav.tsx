"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/settings", label: "Profile" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/usage", label: "Usage" },
  { href: "/settings/data", label: "Your data" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="flex gap-1 border-b">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
              active && "border-brand font-medium text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
