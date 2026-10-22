import Link from "next/link";
import { LockKeyholeIcon, MessageCircleIcon, NetworkIcon, ScanLineIcon, WaypointsIcon } from "lucide-react";
import { SiteFooter } from "@/components/shell/site-footer";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: ScanLineIcon,
    title: "Scan any card",
    body: "Snap a photo on your phone or drop in a stack on desktop. Names, titles and companies are filled in for you, in any language.",
  },
  {
    icon: MessageCircleIcon,
    title: "Ask your network",
    body: "“Who did I meet from Acme?” “Which engineers mentioned hiring?” Get answers with links to the people.",
  },
  {
    icon: WaypointsIcon,
    title: "See connections",
    body: "A living map of everyone you know, grouped by company, event and similar roles.",
  },
  {
    icon: LockKeyholeIcon,
    title: "Private by design",
    body: "Contact details, notes and card photos are encrypted. AI providers never keep your data.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--brand)_18%,transparent),transparent)]"
      />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <NetworkIcon className="size-4" />
          </span>
          MyNetwork
        </Link>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 pt-16 pb-24 text-center sm:px-6 sm:pt-24">
        <span className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          For people who meet a lot of people
        </span>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Never lose a business card, or a connection, again.
        </h1>
        <p className="mt-5 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
          Scan cards at events, remember what you talked about, and ask your network questions in plain English.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-11 bg-brand px-6 text-brand-foreground hover:bg-brand/90">
            <Link href="/signup">Create your free account</Link>
          </Button>
        </div>

        <div className="mt-20 grid w-full gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card/60 p-5 backdrop-blur">
              <div className="flex size-9 items-center justify-center rounded-xl bg-brand-subtle text-brand">
                <f.icon className="size-4.5" />
              </div>
              <h2 className="mt-4 font-medium">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
