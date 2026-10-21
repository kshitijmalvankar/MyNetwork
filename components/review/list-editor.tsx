"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Edit a short list of strings (emails, phone numbers). */
export function ListEditor({
  id,
  values,
  onChange,
  type,
  addLabel,
  placeholder,
}: {
  id: string;
  values: string[];
  onChange: (v: string[]) => void;
  type: "email" | "tel";
  addLabel: string;
  placeholder: string;
}) {
  const rows = values.length ? values : [""];
  return (
    <div className="space-y-2">
      {rows.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input
            id={i === 0 ? id : undefined}
            type={type}
            inputMode={type === "tel" ? "tel" : "email"}
            value={v}
            placeholder={placeholder}
            className="h-10"
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? e.target.value : x)))}
          />
          {rows.length > 1 && (
            <Button type="button" variant="ghost" size="icon-lg" aria-label="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <XIcon />
            </Button>
          )}
        </div>
      ))}
      {rows.length < 10 && (
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange([...rows, ""])}>
          <PlusIcon /> {addLabel}
        </Button>
      )}
    </div>
  );
}
