import type { Metadata } from "next";
import { WifiOffIcon } from "lucide-react";

export const metadata: Metadata = { title: "Offline" };

/**
 * Shown by the service worker when a page can't load without a connection.
 * It's cached ahead of time, so it must work without JavaScript and hold no user data.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-subtle text-brand">
        <WifiOffIcon className="size-6" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">You&apos;re offline</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        MyNetwork needs a connection to load your contacts. Check your Wi-Fi or mobile data, then try again.
      </p>
      {/* A plain link, so it works even when the app's scripts aren't available. */}
      <a
        href="/home"
        className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Try again
      </a>
    </main>
  );
}
