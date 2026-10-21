import "server-only";
import { headers } from "next/headers";
import { hashIp } from "@/lib/crypto/blind-index";

export type RequestInfo = { ip: string; ipHash: string; userAgent: string | null };

export async function getRequestInfo(): Promise<RequestInfo> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return { ip, ipHash: hashIp(ip), userAgent: h.get("user-agent")?.slice(0, 512) ?? null };
}
