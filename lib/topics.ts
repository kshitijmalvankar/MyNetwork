// What someone works on, kept as short lowercase phrases ("warehouse automation")
// so the same topic matches across people. Client-safe.

export const MAX_TOPICS = 12;

export function normalizeTopic(topic: string): string | null {
  const t = topic
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s&+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length >= 2 && t.length <= 40 ? t : null;
}

/** `current` plus anything new from `added`, without repeats, up to MAX_TOPICS. */
export function mergeTopics(current: string[], added: string[]): string[] {
  const out: string[] = [];
  for (const t of [...current, ...added]) {
    const n = normalizeTopic(t);
    if (n && !out.includes(n)) out.push(n);
  }
  return out.slice(0, MAX_TOPICS);
}
