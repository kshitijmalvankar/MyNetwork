// Tidies one account's companies and industries with the rules new cards
// follow: spellings of one company are merged, and industries are mapped onto
// the shared list. It only shows what would change unless given --apply.
//
//   pnpm data:tidy <email>            show what would change
//   pnpm data:tidy <email> --apply    make those changes
import { groupSameCompanies } from "@/lib/companies";
import { canonicalIndustry } from "@/lib/industries";
import { indexStale, refreshSimilarity } from "@/lib/knowledge/indexer";
import { adminClient } from "@/lib/supabase/admin";

type Company = { id: string; name: string; domain: string | null; industry: string | null; created_at: string; people: number };

const db = adminClient();

async function findAccount(email: string) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email.toLowerCase());
    if (user) return user.id;
    if (data.users.length < 200) return undefined;
  }
}

async function pages<T>(fetch: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetch(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

/** Distinct values, each with how many rows have it, mapped onto the list where possible. */
function industryChanges(values: (string | null)[]) {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  const changes: { from: string; to: string; rows: number }[] = [];
  const unknown: { value: string; rows: number }[] = [];
  for (const [value, rows] of counts) {
    const to = canonicalIndustry(value);
    if (!to) unknown.push({ value, rows });
    else if (to !== value) changes.push({ from: value, to, rows });
  }
  return { changes, unknown };
}

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email || (flag && flag !== "--apply")) throw new Error("Usage: pnpm data:tidy <email> [--apply]");
  const apply = flag === "--apply";
  const userId = await findAccount(email);
  if (!userId) throw new Error(`No account for ${email}.`);

  const companies: Company[] = (
    await pages((from, to) =>
      db.from("companies").select("id, name, domain, industry, created_at, contacts(count)").eq("user_id", userId).order("created_at").range(from, to),
    )
  ).map(({ contacts, ...c }) => ({ ...c, people: (contacts as unknown as { count: number }[])[0]?.count ?? 0 }));
  const overrides = await pages((from, to) =>
    db.from("contacts").select("id, industry_override").eq("user_id", userId).not("industry_override", "is", null).range(from, to),
  );

  // Most people first, then the oldest, so the familiar spelling is the one kept.
  const merges = groupSameCompanies(companies)
    .filter((g) => g.length > 1)
    .map((g) => [...g].sort((a, b) => b.people - a.people || a.created_at.localeCompare(b.created_at)));
  const companyIndustries = industryChanges(companies.map((c) => c.industry));
  const personIndustries = industryChanges(overrides.map((o) => o.industry_override));

  console.log(`${email}: ${companies.length} companies.\n`);
  console.log(merges.length ? `Companies to merge (${merges.length}):` : "No companies to merge.");
  for (const [keep, ...drop] of merges) {
    console.log(`  Keep "${keep.name}" (${people(keep.people)}), and move in ${drop.map((d) => `"${d.name}" (${people(d.people)})`).join(", ")}`);
  }
  for (const [label, { changes, unknown }] of [
    ["Company industries", companyIndustries],
    ["Industries set on a person", personIndustries],
  ] as const) {
    if (changes.length) console.log(`\n${label} to relabel:\n${changes.map((c) => `  ${c.from} → ${c.to} (${c.rows})`).join("\n")}`);
    if (unknown.length) console.log(`\n${label} not on the list, left as they are:\n${unknown.map((u) => `  ${u.value} (${u.rows})`).join("\n")}`);
  }

  const total = merges.length + companyIndustries.changes.length + personIndustries.changes.length;
  if (!apply || total === 0) {
    console.log(total ? "\nNothing changed. Run again with --apply to make these changes." : "\nNothing to change.");
    return;
  }

  const now = new Date().toISOString();
  for (const c of companyIndustries.changes) {
    const { data, error } = await db.from("companies").update({ industry: c.to }).eq("user_id", userId).eq("industry", c.from).select("id");
    if (error) throw error;
    const ids = (data ?? []).map((r) => r.id);
    if (ids.length) await db.from("contacts").update({ index_requested_at: now }).eq("user_id", userId).in("company_id", ids);
  }
  for (const c of personIndustries.changes) {
    const { error } = await db.from("contacts").update({ industry_override: c.to, index_requested_at: now }).eq("user_id", userId).eq("industry_override", c.from);
    if (error) throw error;
  }
  let moved = 0;
  for (const [keep, ...drop] of merges) {
    const { data, error } = await db.rpc("merge_companies", { p_user_id: userId, p_keep: keep.id, p_drop: drop.map((d) => d.id) });
    if (error) throw error;
    moved += data ?? 0;
  }

  const merged = merges.reduce((n, g) => n + g.length - 1, 0);
  const relabelled = companyIndustries.changes.length + personIndustries.changes.length;
  await db.from("audit_log").insert({
    user_id: userId,
    action: "data.tidied",
    metadata: { companiesMerged: merged, peopleMoved: moved, industriesRelabelled: relabelled },
  });

  console.log(
    `\nMerged ${merged} duplicate ${merged === 1 ? "company" : "companies"} into ${merges.length} (${people(moved)} moved) and relabelled ${relabelled} ${relabelled === 1 ? "industry" : "industries"}. Updating search…`,
  );
  for (let round = 0; round < 20; round++) {
    const { indexed, failed } = await indexStale({ userId, limit: 200, concurrency: 6 });
    if (failed) console.error(`${failed} item(s) failed to index; they'll be retried by the next sweep.`);
    if (indexed === 0) break;
  }
  await refreshSimilarity({ userId });
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
