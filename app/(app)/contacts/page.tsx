import Link from "next/link";
import type { Metadata } from "next";
import { ScanLineIcon, UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { initials, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage() {
  await requireUser();
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, full_name, title, role_family, created_at, companies(name)")
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <PageContainer>
      <PageHeader
        title="Contacts"
        description={contacts?.length ? `${contacts.length} ${contacts.length === 1 ? "person" : "people"} in your network.` : "Everyone you've met."}
        actions={
          <Button asChild variant="outline">
            <Link href="/scan">
              <ScanLineIcon /> Scan a card
            </Link>
          </Button>
        }
      />
      {!contacts?.length ? (
        <EmptyState icon={UsersIcon} title="No contacts yet" description="Scan your first business card and the person will appear here.">
          <Button asChild>
            <Link href="/scan">
              <ScanLineIcon /> Scan a card
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((c) => {
            const company = (c.companies as { name: string } | null)?.name;
            return (
              <li key={c.id} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-brand-subtle text-brand">{initials(c.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-medium">{c.full_name}</p>
                  <p className="truncate text-sm text-muted-foreground">{[c.title, company].filter(Boolean).join(" · ") || "—"}</p>
                  <div className="flex items-center gap-2 pt-1">
                    {c.role_family && <Badge variant="secondary">{c.role_family}</Badge>}
                    <span className="text-xs text-muted-foreground">Added {timeAgo(c.created_at)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
