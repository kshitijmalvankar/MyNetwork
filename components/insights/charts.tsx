"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartColumnIcon, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { Row } from "@/lib/chart-rows";

/** One series per chart, so one hue: slot 1 of the validated palette, stepped for each mode. */
const config = {
  count: { label: "People", theme: { light: "#2a78d6", dark: "#3987e5" } },
} satisfies ChartConfig;

function DataTable({ rows, label }: { rows: Row[]; label: string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="py-1.5 font-medium">{label}</th>
          <th className="py-1.5 text-right font-medium">People</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b last:border-0">
            <td className="py-1.5">{r.label}</td>
            <td className="py-1.5 text-right tabular-nums">{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A chart with a switch to the same numbers as a table. */
export function ChartCard({
  title,
  description,
  rows,
  label,
  layout,
  className,
}: {
  title: string;
  description?: string;
  rows: Row[];
  label: string;
  /** "columns" for time and ordered scales; "bars" (horizontal, sorted) for categories. */
  layout: "columns" | "bars";
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const empty = rows.every((r) => r.count === 0);
  return (
    <Card className={className ? `gap-3 shadow-none ${className}` : "gap-3 shadow-none"}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <CardAction>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground"
            aria-label={asTable ? `Show ${title} as a chart` : `Show ${title} as a table`}
            aria-pressed={asTable}
            onClick={() => setAsTable((v) => !v)}
          >
            {asTable ? <ChartColumnIcon /> : <TableIcon />}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : asTable ? (
          <DataTable rows={rows} label={label} />
        ) : layout === "columns" ? (
          <ChartContainer config={config} className="aspect-auto h-52 w-full">
            <BarChart data={rows} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeWidth={1} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} fontSize={10} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={11} />
              <ChartTooltip cursor={{ fillOpacity: 0.06 }} content={<ChartTooltipContent hideIndicator />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ChartContainer>
        ) : (
          <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(120, rows.length * 32 + 8) }}>
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 32, left: 0, bottom: 0 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={120} fontSize={12} />
              <ChartTooltip cursor={{ fillOpacity: 0.06 }} content={<ChartTooltipContent hideIndicator />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} maxBarSize={18}>
                <LabelList dataKey="count" position="right" offset={8} className="fill-muted-foreground" fontSize={12} />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
