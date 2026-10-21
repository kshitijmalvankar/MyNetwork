/** Today's date (YYYY-MM-DD) in the user's time zone. */
export function todayIn(timeZone: string | null | undefined) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function formatDay(isoDate: string) {
  return new Date(`${isoDate.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}
