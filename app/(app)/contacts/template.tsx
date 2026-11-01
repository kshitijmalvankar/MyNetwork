import { ViewTransition } from "react";

/**
 * Remounts when moving between the contacts list and a profile. Opening a
 * profile slides the page forward and going back slides it the other way, while
 * the avatar and name fly across between them (see "Page transitions" in
 * globals.css). Links set the direction with `transitionTypes`; anything else,
 * such as a jump from search, uses the plain page transition.
 */
export default function ContactsTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "depth-forward", "nav-back": "depth-back", default: "page-enter" }}
      exit={{ "nav-forward": "depth-forward", "nav-back": "depth-back", default: "page-exit" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
