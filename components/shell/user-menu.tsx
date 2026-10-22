"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { LogOutIcon, MonitorIcon, MoonIcon, SettingsIcon, ShieldCheckIcon, SunIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ShellUser = { email: string; displayName: string | null };

export function UserAvatar({ user, className }: { user: ShellUser; className?: string }) {
  return (
    <Avatar className={cn("size-10", className)}>
      <AvatarFallback className="bg-brand-subtle text-xs font-medium text-brand">{initials(user.displayName || user.email)}</AvatarFallback>
    </Avatar>
  );
}

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

/** Light, dark or follow the device, as a segmented control with the choice raised. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      value={theme}
      onValueChange={(v) => v && setTheme(v)}
      aria-label="Theme"
      className={cn("w-full bg-background/60 p-1 dark:bg-background/40", className)}
    >
      {THEMES.map((t) => (
        <ToggleGroupItem
          key={t.value}
          value={t.value}
          className="h-8 flex-1 gap-1.5 text-muted-foreground hover:bg-transparent data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm dark:data-[state=on]:bg-accent"
        >
          <t.icon /> {t.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** The account button at the foot of the desktop rail: avatar, then name and email when the rail opens. */
export function UserMenu({ user }: { user: ShellUser }) {
  const { theme, setTheme } = useTheme();
  const name = user.displayName || user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account"
          className="flex h-11 w-full items-center gap-3 rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <UserAvatar user={user} className="shrink-0" />
          <span className="rail-label min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" side="right" align="end" sideOffset={16}>
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <SettingsIcon /> Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/security">
              <ShieldCheckIcon /> Security
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <SunIcon /> Theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                {THEMES.map((t) => (
                  <DropdownMenuRadioItem key={t.value} value={t.value}>
                    <t.icon /> {t.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <SignOutItem />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SignOutItem() {
  return (
    <form action="/auth/signout" method="post">
      <DropdownMenuItem asChild>
        <button type="submit" className="w-full">
          <LogOutIcon /> Sign out
        </button>
      </DropdownMenuItem>
    </form>
  );
}
