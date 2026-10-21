"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Refreshes the page whenever one of the user's scans changes (Supabase
 * Realtime, RLS-filtered). While cards are being read it also polls, in case a
 * realtime message is missed.
 */
export function useScanUpdates(userId: string, { poll = false }: { poll?: boolean } = {}) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`scans:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "scans", filter: `user_id=eq.${userId}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 300);
      })
      .subscribe();
    const interval = poll ? setInterval(() => router.refresh(), 8_000) : undefined;
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [userId, poll, router]);
}
