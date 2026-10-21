// Chart rows, shared by server pages and client charts.
export type Row = { label: string; count: number };

/** Keeps the biggest few and folds the rest into "Other", so bars stay readable. */
export function topWithOther(rows: { value: string; count: number }[], keep = 7): Row[] {
  const head = rows.slice(0, keep).map((r) => ({ label: r.value, count: r.count }));
  const rest = rows.slice(keep).reduce((sum, r) => sum + r.count, 0);
  return rest > 0 ? [...head, { label: "Other", count: rest }] : head;
}
