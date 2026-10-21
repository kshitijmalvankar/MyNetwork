import Link from "next/link";
import type { Metadata } from "next";
import { after } from "next/server";
import { ScanLineIcon, WaypointsIcon } from "lucide-react";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { GraphExplorer } from "@/components/graph/graph-explorer";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { getGraphData, MAX_GRAPH_PEOPLE } from "@/lib/graph";
import { indexBacklog, indexStale } from "@/lib/knowledge/indexer";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Graph" };

const ids = z.array(z.uuid()).max(100);

export default async function GraphPage({ searchParams }: PageProps<"/graph">) {
  const user = await requireUser();
  const supabase = await createClient();
  const params = await searchParams;
  const [data, backlog] = await Promise.all([getGraphData(supabase), indexBacklog(supabase)]);
  // People added or changed recently get their "similar background" matches in the background.
  if (backlog > 0) after(() => indexStale({ userId: user.id, limit: 200 }));

  const focus = typeof params.focus === "string" && z.uuid().safeParse(params.focus).success ? params.focus : undefined;
  const people = ids.safeParse(typeof params.people === "string" ? params.people.split(",") : []);

  return (
    <PageContainer className="max-w-[90rem] space-y-4">
      <PageHeader
        title="Graph"
        description={
          data.truncated
            ? `Showing your ${MAX_GRAPH_PEOPLE.toLocaleString()} most recently added people.`
            : "How the people you've met connect: by company, by event, and by similar background."
        }
      />
      {data.people.length === 0 ? (
        <EmptyState icon={WaypointsIcon} title="Your network map appears here" description="People link up by company, event and similar roles as you add them.">
          <Button asChild>
            <Link href="/scan">
              <ScanLineIcon data-icon="inline-start" />
              Scan cards
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <GraphExplorer data={data} initialFocus={focus} initialPeople={people.success ? people.data : undefined} />
      )}
    </PageContainer>
  );
}
