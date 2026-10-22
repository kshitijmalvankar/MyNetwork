import Link from "next/link";
import { cn } from "@/lib/utils";

/** Footer for public pages: copyright and the legal links. */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:px-6", className)}>
      <span>© {new Date().getFullYear()} MyNetwork</span>
      <nav aria-label="Legal" className="flex gap-4">
        <Link href="/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          Terms
        </Link>
      </nav>
    </footer>
  );
}
