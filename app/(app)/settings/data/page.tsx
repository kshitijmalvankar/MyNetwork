import Link from "next/link";
import type { Metadata } from "next";
import { LockKeyholeIcon } from "lucide-react";
import { ExportButton } from "@/components/contacts/export-button";
import { StepUpBoundary } from "@/components/security/step-up-boundary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { DeleteAccountCard } from "./delete-account-card";

export const metadata: Metadata = { title: "Your data" };

export default async function DataPage() {
  await requireUser();
  const supabase = await createClient();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const head = { count: "exact", head: true } as const;

  const [contacts, events, notes, voiceNotes, scans, chats] = await Promise.all([
    count(supabase.from("contacts").select("id", head)),
    count(supabase.from("events").select("id", head)),
    count(supabase.from("notes").select("id", head).is("audio_path", null)),
    count(supabase.from("notes").select("id", head).not("audio_path", "is", null)),
    count(supabase.from("scans").select("id", head)),
    count(supabase.from("chat_threads").select("id", head)),
  ]);
  const stats = [
    { label: "Contacts", value: contacts },
    { label: "Events", value: events },
    { label: "Notes", value: notes },
    { label: "Voice notes", value: voiceNotes },
    { label: "Card scans", value: scans },
    { label: "Ask chats", value: chats },
  ];

  return (
    <StepUpBoundary>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyholeIcon className="size-4 text-brand" /> What you&apos;ve stored
          </CardTitle>
          <CardDescription>
            Email addresses, phone numbers, notes, voice notes, card photos and chats are encrypted before they&apos;re
            saved. See the{" "}
            <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">
              privacy policy
            </Link>{" "}
            for details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{s.value.toLocaleString("en")}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Download your contacts</CardTitle>
          <CardDescription>
            A spreadsheet (CSV) of every contact with their details and the events you met them at. Opens in Excel,
            Numbers or Google Sheets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportButton label="Download CSV" compact={false} />
        </CardContent>
      </Card>

      <DeleteAccountCard />
    </StepUpBoundary>
  );
}
