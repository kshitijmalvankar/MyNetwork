"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { industriesIn, isIndustry, SECTORS } from "@/lib/industries";

// Select items can't have an empty value, so "nothing chosen" needs its own.
const NONE = "__none__";

/**
 * Picks from the shared industry list, grouped by sector. A label typed before
 * the list existed stays selectable, so opening the form never loses it.
 */
export function IndustrySelect({ id, value, onChange, emptyLabel }: { id: string; value: string; onChange: (value: string) => void; emptyLabel: string }) {
  const legacy = value && !isIndustry(value) ? value : null;
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={id} className="h-10 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{emptyLabel}</SelectItem>
        {legacy && <SelectItem value={legacy}>{legacy}</SelectItem>}
        {SECTORS.map((sector) => (
          <SelectGroup key={sector}>
            <SelectLabel>{sector}</SelectLabel>
            {industriesIn(sector).map((industry) => (
              <SelectItem key={industry} value={industry}>
                {industry}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
