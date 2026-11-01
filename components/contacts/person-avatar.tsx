import { ViewTransition } from "react";
import { initials, personHue } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Someone's initials on their own soft gradient. The color comes from their
 * name, so they look the same on every screen. With `morphId`, the avatar flies
 * between the list and their profile as you navigate; only one element on a page
 * may use a given id.
 */
export function PersonAvatar({ name, morphId, className }: { name: string; morphId?: string; className?: string }) {
  const avatar = (
    <span
      aria-hidden
      style={{ "--hue": personHue(name) } as React.CSSProperties}
      className={cn("person-avatar flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold", className)}
    >
      {initials(name)}
    </span>
  );
  if (!morphId) return avatar;
  return (
    <ViewTransition name={`person-avatar-${morphId}`} share="morph" default="none">
      {avatar}
    </ViewTransition>
  );
}

/**
 * Wraps someone's name so it flies between the list and their profile. The
 * child should hug its text (`w-fit`), or the name would stretch on the way.
 */
export function PersonNameMorph({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <ViewTransition name={`person-name-${id}`} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
