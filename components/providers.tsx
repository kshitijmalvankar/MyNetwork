"use client";

import { createContext, use } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const NonceContext = createContext<string | undefined>(undefined);

/** The per-request CSP nonce, for client components that load third-party scripts. */
export function useNonce() {
  return use(NonceContext);
}

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <NonceContext value={nonce}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </TooltipProvider>
      </ThemeProvider>
    </NonceContext>
  );
}
