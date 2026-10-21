export function initials(name: string) {
  const parts = name
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(date: Date | string, now = new Date()) {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relative.format(seconds, "second");
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return relative.format(Math.round(seconds / 86400), "day");
  if (abs < 86400 * 365) return relative.format(Math.round(seconds / (86400 * 30)), "month");
  return relative.format(Math.round(seconds / (86400 * 365)), "year");
}
