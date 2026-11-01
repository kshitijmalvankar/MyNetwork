"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * A link to someone's profile. The avatar and name can only fly into the
 * profile if it's ready when you click, and profiles are per-user so nothing
 * loads them ahead of time by default. So this loads one as soon as you show
 * intent: on hover, keyboard focus, or the start of a tap.
 */
export function ContactLink({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const [intent, setIntent] = useState(false);
  const show = () => setIntent(true);
  return (
    <Link
      href={`/contacts/${id}`}
      prefetch={intent}
      transitionTypes={["nav-forward"]}
      onMouseEnter={show}
      onFocus={show}
      onTouchStart={show}
      className={className}
    >
      {children}
    </Link>
  );
}
