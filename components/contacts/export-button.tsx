"use client";

import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStepUp } from "@/components/security/step-up";

/** Downloads every contact as CSV after the user confirms it's them. */
export function ExportButton({ label = "Export", compact = true }: { label?: string; compact?: boolean }) {
  const { withStepUp, expire } = useStepUp();
  const download = () =>
    withStepUp(async () => {
      const res = await fetch("/api/export/contacts");
      if (!res.ok) {
        if (res.status === 403) expire();
        toast.error(res.status === 403 ? "Please confirm it's you again." : await res.text());
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "contacts.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    });
  return (
    <Button variant="outline" onClick={download}>
      <DownloadIcon /> <span className={compact ? "hidden sm:inline" : undefined}>{label}</span>
    </Button>
  );
}
