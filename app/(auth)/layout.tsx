import Link from "next/link";
import { LockKeyholeIcon, NetworkIcon } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden border-r bg-muted/30 lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-32 size-[520px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--brand)_22%,transparent),transparent_70%)]"
        />
        <Link href="/" className="relative flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <NetworkIcon className="size-4" />
          </span>
          MyNetwork
        </Link>
        <div className="relative max-w-md space-y-4">
          <p className="text-3xl font-semibold tracking-tight text-balance">
            Every card you collect, every conversation you had, in one private place.
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LockKeyholeIcon className="size-4" />
            Contact details and notes are encrypted before they are stored.
          </p>
        </div>
        <p className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} MyNetwork</p>
      </aside>

      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-6">
        <Link href="/" className="mb-8 flex items-center gap-2 font-semibold tracking-tight lg:hidden">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <NetworkIcon className="size-4" />
          </span>
          MyNetwork
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
