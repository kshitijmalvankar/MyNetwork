import { ViewTransition } from "react";

/**
 * Templates remount on every navigation between sections, unlike layouts, so
 * the old page can fade out and the new one rise in (see "Page transitions" in
 * globals.css). Moves within a section, like a list to a detail page, keep the
 * template and don't animate here.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
