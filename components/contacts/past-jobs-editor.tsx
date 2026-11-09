"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PastJobRow = { company: string; title: string; until: string };

/** Past jobs: company, title and, if known, the month they left. Former colleagues are found from these. */
export function PastJobsEditor({ values, onChange }: { values: PastJobRow[]; onChange: (v: PastJobRow[]) => void }) {
  const update = (i: number, patch: Partial<PastJobRow>) => onChange(values.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  return (
    <div className="space-y-4">
      {values.map((job, i) => (
        <div key={i} className="space-y-2">
          <div className="flex gap-2">
            <Input value={job.company} onChange={(e) => update(i, { company: e.target.value })} placeholder="Company" aria-label="Past company" className="h-10" />
            <Button type="button" variant="ghost" size="icon-lg" aria-label="Remove this job" onClick={() => onChange(values.filter((_, j) => j !== i))}>
              <XIcon />
            </Button>
          </div>
          <div className="grid grid-cols-[1fr_9.5rem] gap-2 pr-13">
            <Input value={job.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Job title" aria-label="Past job title" className="h-10" />
            <Input type="month" value={job.until} onChange={(e) => update(i, { until: e.target.value })} aria-label="Left in" className="h-10" />
          </div>
        </div>
      ))}
      {values.length < 20 && (
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange([...values, { company: "", title: "", until: "" }])}>
          <PlusIcon /> Add a past job
        </Button>
      )}
    </div>
  );
}
