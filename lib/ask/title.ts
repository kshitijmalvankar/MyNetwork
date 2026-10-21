// Shared by the server (stored titles) and the Ask page (optimistic titles).
export type ThreadSummary = { id: string; title: string; updatedAt: string };

export const threadTitle = (text: string) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 80 ? `${flat.slice(0, 77)}…` : flat;
};
