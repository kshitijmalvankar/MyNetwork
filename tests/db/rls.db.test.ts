// Row-level security checks against the linked database. Each test runs in a
// transaction that is rolled back, so nothing is left behind.
// Run with: pnpm test:db
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

process.loadEnvFile?.(".env.local");

const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
const sql = postgres({
  host: process.env.SUPABASE_DB_HOST,
  port: 5432,
  user: `postgres.${ref}`,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: "require",
  max: 1,
  onnotice: () => {},
});

afterAll(() => sql.end());

class Rollback extends Error {}

/** Creates two users, runs `fn`, then rolls everything back. */
async function scenario(fn: (tx: postgres.TransactionSql, a: string, b: string) => Promise<void>) {
  const a = randomUUID();
  const b = randomUUID();
  try {
    await sql.begin(async (tx) => {
      for (const id of [a, b]) {
        await tx`insert into auth.users (id, email, aud, role, instance_id)
                 values (${id}, ${`rls-${id}@example.com`}, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')`;
      }
      await tx`insert into public.user_keys (user_id, wrapped_dek, key_version) values (${a}, '\\x00', 1)`;
      await tx`insert into public.audit_log (user_id, action) values (${a}, 'auth.login'), (${b}, 'auth.login')`;
      await fn(tx, a, b);
      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  }
}

async function as(tx: postgres.TransactionSql, userId: string | null, aal: "aal1" | "aal2" = "aal1") {
  if (userId) {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated", aal })}, true)`;
    await tx`set local role authenticated`;
  } else {
    await tx`set local role anon`;
  }
}

/** Runs a statement that should be rejected, inside a savepoint so the transaction survives. */
async function rejects(tx: postgres.TransactionSql, run: (sp: postgres.TransactionSql) => Promise<unknown>) {
  try {
    await tx.savepoint((sp) => run(sp));
    return false;
  } catch {
    return true;
  }
}

describe("profiles", () => {
  it("are created for new users and readable only by their owner", () =>
    scenario(async (tx, a, b) => {
      await as(tx, a);
      const own = await tx`select id from public.profiles`;
      expect(own.map((r) => r.id)).toEqual([a]);
      const other = await tx`select id from public.profiles where id = ${b}`;
      expect(other).toHaveLength(0);
    }));

  it("can be updated by the owner, but not someone else's", () =>
    scenario(async (tx, a, b) => {
      await as(tx, a);
      await tx`update public.profiles set display_name = 'Mine' where id = ${a}`;
      const changed = await tx`update public.profiles set display_name = 'Hacked' where id = ${b} returning id`;
      expect(changed).toHaveLength(0);
      expect(await rejects(tx, (sp) => sp`update public.profiles set id = ${randomUUID()} where id = ${a}`)).toBe(true);
    }));

  it("are invisible to anonymous visitors", () =>
    scenario(async (tx) => {
      await as(tx, null);
      expect(await rejects(tx, (sp) => sp`select * from public.profiles`)).toBe(true);
    }));
});

describe("user_keys", () => {
  it("cannot be read or written by signed-in users", () =>
    scenario(async (tx, a) => {
      await as(tx, a);
      expect(await rejects(tx, (sp) => sp`select * from public.user_keys`)).toBe(true);
      expect(
        await rejects(tx, (sp) => sp`insert into public.user_keys (user_id, wrapped_dek, key_version) values (${a}, '\\x01', 1)`),
      ).toBe(true);
    }));
});

describe("audit_log", () => {
  it("shows users only their own entries and cannot be written from the client", () =>
    scenario(async (tx, a) => {
      await as(tx, a);
      const rows = await tx`select user_id from public.audit_log`;
      expect(rows.every((r) => r.user_id === a)).toBe(true);
      expect(rows.length).toBe(1);
      expect(await rejects(tx, (sp) => sp`insert into public.audit_log (user_id, action) values (${a}, 'auth.login')`)).toBe(
        true,
      );
      expect(await rejects(tx, (sp) => sp`delete from public.audit_log`)).toBe(true);
    }));
});

describe("network tables", () => {
  it("keep contacts, companies and scans private to their owner", () =>
    scenario(async (tx, a, b) => {
      await tx`insert into public.companies (user_id, name, normalized_name) values (${a}, 'Acme', 'acme')`;
      await tx`insert into public.contacts (user_id, full_name) values (${a}, 'Owned by A')`;
      await tx`insert into public.scans (user_id, front_path) values (${a}, ${`${a}/cards/x/front`})`;
      await as(tx, b);
      expect(await tx`select id from public.contacts`).toHaveLength(0);
      expect(await tx`select id from public.companies`).toHaveLength(0);
      expect(await tx`select id from public.scans`).toHaveLength(0);
      expect(await tx`update public.contacts set full_name = 'Hacked' returning id`).toHaveLength(0);
      expect(await rejects(tx, (sp) => sp`insert into public.contacts (user_id, full_name) values (${a}, 'Planted')`)).toBe(true);
    }));

  it("lets owners manage their own rows", () =>
    scenario(async (tx, a) => {
      await as(tx, a);
      const [c] = await tx`insert into public.contacts (user_id, full_name) values (${a}, 'Mine') returning id`;
      await tx`insert into public.interactions (user_id, contact_id, type) values (${a}, ${c.id}, 'met')`;
      const [row] = await tx`select last_contacted_at from public.contacts where id = ${c.id}`;
      expect(row.last_contacted_at).not.toBeNull();
    }));

  it("keep last contacted up to date, and never change someone else's contact", () =>
    scenario(async (tx, a, b) => {
      const [c] = await tx`insert into public.contacts (user_id, full_name) values (${a}, 'Owned by A') returning id`;
      await tx`insert into public.interactions (user_id, contact_id, type, occurred_at) values (${a}, ${c.id}, 'met', '2026-09-01')`;
      // B can't log a meeting with A's contact, so A's contact is untouched.
      await as(tx, b);
      expect(
        await rejects(tx, (sp) => sp`insert into public.interactions (user_id, contact_id, type, occurred_at) values (${b}, ${c.id}, 'call', '2026-10-01')`),
      ).toBe(true);
      await tx`reset role`;
      const [after] = await tx`select last_contacted_at from public.contacts where id = ${c.id}`;
      expect(after.last_contacted_at.toISOString().slice(0, 10)).toBe("2026-09-01");
      await tx`delete from public.interactions where contact_id = ${c.id} and user_id = ${a}`;
      const [cleared] = await tx`select last_contacted_at from public.contacts where id = ${c.id}`;
      expect(cleared.last_contacted_at).toBeNull();
    }));

  it("go with their owner when the user is deleted", () =>
    scenario(async (tx, a) => {
      const [co] = await tx`insert into public.companies (user_id, name, normalized_name) values (${a}, 'Acme', 'acme') returning id`;
      const [e] = await tx`insert into public.events (user_id, name) values (${a}, 'Expo') returning id`;
      const [c] = await tx`insert into public.contacts (user_id, full_name, company_id) values (${a}, 'Owned by A', ${co.id}) returning id`;
      await tx`insert into public.interactions (user_id, contact_id, type, event_id) values (${a}, ${c.id}, 'met', ${e.id})`;
      await tx`insert into public.scans (user_id, front_path, contact_id) values (${a}, ${`${a}/cards/x/front`}, ${c.id})`;
      await tx`delete from auth.users where id = ${a}`;
      expect(await tx`select id from public.contacts where user_id = ${a}`).toHaveLength(0);
      expect(await tx`select id from public.interactions where user_id = ${a}`).toHaveLength(0);
      expect(await tx`select id from public.scans where user_id = ${a}`).toHaveLength(0);
      expect(await tx`select user_id from public.user_keys where user_id = ${a}`).toHaveLength(0);
      // The trigger that broke deletion must run as its owner, not as the role deleting the user.
      const [fn] = await tx`select prosecdef from pg_proc where proname = 'touch_last_contacted'`;
      expect(fn.prosecdef).toBe(true);
    }));
});

describe("links between rows", () => {
  /** A small network for one user: the rows other rows can point at. */
  async function network(tx: postgres.TransactionSql, owner: string) {
    const [{ id: company }] = await tx`insert into public.companies (user_id, name, normalized_name) values (${owner}, 'Acme', 'acme') returning id`;
    const [{ id: contact }] = await tx`insert into public.contacts (user_id, full_name) values (${owner}, 'Someone') returning id`;
    const [{ id: event }] = await tx`insert into public.events (user_id, name) values (${owner}, 'Expo') returning id`;
    const [{ id: note }] = await tx`insert into public.notes (user_id, contact_id, body_enc) values (${owner}, ${contact}, '\\x00') returning id`;
    const [{ id: thread }] = await tx`insert into public.chat_threads (user_id) values (${owner}) returning id`;
    return { company, contact, event, note, thread } as Record<"company" | "contact" | "event" | "note" | "thread", string>;
  }
  type Network = Awaited<ReturnType<typeof network>>;

  /** Every way a signed-in user can point one of their rows at `target`'s rows. */
  const links = (me: string, own: Network, target: Network): [string, (sp: postgres.TransactionSql) => Promise<unknown>][] => [
    ["note on a contact", (sp) => sp`insert into public.notes (user_id, contact_id, body_enc) values (${me}, ${target.contact}, '\\x00')`],
    ["note on an event", (sp) => sp`insert into public.notes (user_id, event_id, body_enc) values (${me}, ${target.event}, '\\x00')`],
    ["interaction", (sp) => sp`insert into public.interactions (user_id, contact_id, type) values (${me}, ${target.contact}, 'met')`],
    ["event link", (sp) => sp`insert into public.interactions (user_id, contact_id, type, event_id) values (${me}, ${own.contact}, 'met', ${target.event})`],
    ["reminder", (sp) => sp`insert into public.reminders (user_id, contact_id, due_at) values (${me}, ${target.contact}, now())`],
    ["company link", (sp) => sp`update public.contacts set company_id = ${target.company} where id = ${own.contact} returning id`],
    ["new contact at a company", (sp) => sp`insert into public.contacts (user_id, full_name, company_id) values (${me}, 'New', ${target.company})`],
    ["card image", (sp) => sp`insert into public.card_images (user_id, contact_id, side, path) values (${me}, ${target.contact}, 'front', 'x')`],
    ["identifier", (sp) => sp`insert into public.contact_identifiers (user_id, contact_id, kind, blind_index) values (${me}, ${target.contact}, 'email', 'x')`],
    ["scan", (sp) => sp`insert into public.scans (user_id, front_path, contact_id) values (${me}, 'x', ${target.contact})`],
    ["cached brief", (sp) => sp`insert into public.ai_cache (user_id, kind, contact_id, input_hash, payload_enc, model) values (${me}, 'brief', ${target.contact}, 'h', '\\x00', 'm')`],
    ["suggestion", (sp) => sp`insert into public.ai_suggestions (user_id, kind, contact_id) values (${me}, 'follow_up', ${target.contact})`],
    ["suggestion from a note", (sp) => sp`insert into public.ai_suggestions (user_id, kind, contact_id, note_id) values (${me}, 'follow_up', ${own.contact}, ${target.note})`],
    ["chat message", (sp) => sp`insert into public.chat_messages (user_id, thread_id, message_id, role, parts_enc) values (${me}, ${target.thread}, 'm1', 'user', '\\x00')`],
  ];

  it("can't point at another user's contact, event, company, note or chat", () =>
    scenario(async (tx, a, b) => {
      const theirs = await network(tx, a);
      const mine = await network(tx, b);
      await as(tx, b);
      const allowed = [];
      for (const [label, run] of links(b, mine, theirs)) if (!(await rejects(tx, run))) allowed.push(label);
      expect(allowed).toEqual([]);
    }));

  it("still let owners link their own rows", () =>
    scenario(async (tx, a) => {
      const mine = await network(tx, a);
      await as(tx, a);
      const refused = [];
      for (const [label, run] of links(a, mine, mine)) if (await rejects(tx, run)) refused.push(label);
      expect(refused).toEqual([]);
    }));

  it("can't be made by the server either", () =>
    scenario(async (tx, a, b) => {
      // The test connection bypasses row-level security, like the service role.
      const theirs = await network(tx, a);
      const mine = await network(tx, b);
      const vector = `[${Array.from({ length: 1536 }, () => 0).join(",")}]`;
      expect(
        await rejects(
          tx,
          (sp) => sp`insert into public.knowledge_chunks (user_id, source_type, source_id, contact_id, content_enc, content_hash, embedding, embedding_model)
                     values (${b}, 'contact', ${theirs.contact}, ${theirs.contact}, '\\x00', 'x', ${vector}::extensions.vector, 'm')`,
        ),
      ).toBe(true);
      expect(
        await rejects(tx, (sp) => sp`insert into public.contact_similarity (user_id, contact_id, similar_id, score) values (${b}, ${mine.contact}, ${theirs.contact}, 1)`),
      ).toBe(true);
    }));

  it("keep their owner when what they point at is deleted", () =>
    scenario(async (tx, a) => {
      const mine = await network(tx, a);
      await as(tx, a);
      await tx`update public.contacts set company_id = ${mine.company} where id = ${mine.contact}`;
      const [i] = await tx`insert into public.interactions (user_id, contact_id, type, event_id) values (${a}, ${mine.contact}, 'met', ${mine.event}) returning id`;
      const [s] = await tx`insert into public.scans (user_id, front_path, contact_id) values (${a}, 'x', ${mine.contact}) returning id`;

      await tx`delete from public.events where id = ${mine.event}`;
      expect(await tx`select user_id, event_id from public.interactions where id = ${i.id}`).toEqual([{ user_id: a, event_id: null }]);
      await tx`delete from public.companies where id = ${mine.company}`;
      expect(await tx`select user_id, company_id from public.contacts where id = ${mine.contact}`).toEqual([{ user_id: a, company_id: null }]);
      await tx`delete from public.contacts where id = ${mine.contact}`;
      expect(await tx`select user_id, contact_id from public.scans where id = ${s.id}`).toEqual([{ user_id: a, contact_id: null }]);
      expect(await tx`select id from public.notes where id = ${mine.note}`).toHaveLength(0);
    }));
});

describe("server-only functions", () => {
  it("cannot be called by signed-in users", () =>
    scenario(async (tx, a) => {
      await as(tx, a);
      expect(await rejects(tx, (sp) => sp`select * from public.consume_quota(${a}, 'scan', -1000)`)).toBe(true);
      expect(await rejects(tx, (sp) => sp`select public.release_quota(${a}, 'scan', 1000)`)).toBe(true);
      expect(await rejects(tx, (sp) => sp`select * from public.claim_scan(gen_random_uuid())`)).toBe(true);
      expect(await rejects(tx, (sp) => sp`select public.ai_spend_today()`)).toBe(true);
      expect(await rejects(tx, (sp) => sp`insert into public.ai_usage (user_id, feature, model) values (${a}, 'scan', 'x')`)).toBe(true);
    }));
});

describe("two-factor enforcement", () => {
  it("hides everything from a session that hasn't entered its code, for users with an authenticator", () =>
    scenario(async (tx, a) => {
      await tx`insert into public.contacts (user_id, full_name) values (${a}, 'Private')`;
      await tx`insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
               values (gen_random_uuid(), ${a}, 'Phone', 'totp', 'verified', now(), now(), 'SECRET')`;

      await as(tx, a, "aal1");
      const [{ required }] = await tx`select public.mfa_required() as required`;
      expect(required).toBe(true);
      expect(await tx`select id from public.contacts`).toHaveLength(0);
      expect(await tx`select id from public.profiles`).toHaveLength(0);
      expect(await rejects(tx, (sp) => sp`insert into public.contacts (user_id, full_name) values (${a}, 'Sneaky')`)).toBe(true);

      await tx`reset role`;
      await as(tx, a, "aal2");
      expect(await tx`select id from public.contacts`).toHaveLength(1);
    }));

  it("doesn't get in the way of users without an authenticator", () =>
    scenario(async (tx, a) => {
      await tx`insert into public.contacts (user_id, full_name) values (${a}, 'Visible')`;
      await as(tx, a, "aal1");
      const [{ required }] = await tx`select public.mfa_required() as required`;
      expect(required).toBe(false);
      expect(await tx`select id from public.contacts`).toHaveLength(1);
    }));
});

describe("ask my network", () => {
  const vector = (x: number) => `[${Array.from({ length: 1536 }, (_, i) => (i === 0 ? x : 0)).join(",")}]`;

  it("only ever searches the caller's own knowledge", () =>
    scenario(async (tx, a, b) => {
      const ids: Record<string, string> = {};
      for (const [owner, label] of [[a, "mine"], [b, "theirs"]] as const) {
        const [{ id }] = await tx`insert into public.contacts (user_id, full_name) values (${owner}, ${label}) returning id`;
        ids[label] = id;
        await tx`insert into public.knowledge_chunks (user_id, source_type, source_id, contact_id, content_enc, content_hash, embedding, embedding_model)
                 values (${owner}, 'contact', ${id}, ${id}, '\\x00', ${label}, ${vector(1)}::extensions.vector, 'test-model')`;
      }

      await as(tx, a);
      const hits = await tx`select contact_id from public.match_chunks(${vector(1)}::extensions.vector, 'test-model', 10)`;
      expect(hits.map((h) => h.contact_id)).toEqual([ids.mine]);
      expect(await tx`select id from public.knowledge_chunks where user_id = ${b}`).toHaveLength(0);
    }));

  it("lets only the server write knowledge chunks", () =>
    scenario(async (tx, a) => {
      const [{ id }] = await tx`insert into public.contacts (user_id, full_name) values (${a}, 'Someone') returning id`;
      await as(tx, a);
      expect(
        await rejects(
          tx,
          (sp) => sp`insert into public.knowledge_chunks (user_id, source_type, source_id, contact_id, content_enc, content_hash, embedding, embedding_model)
                     values (${a}, 'contact', ${id}, ${id}, '\\x00', 'x', ${vector(1)}::extensions.vector, 'test-model')`,
        ),
      ).toBe(true);
    }));

  it("keeps chat threads and messages private to their owner", () =>
    scenario(async (tx, a, b) => {
      const [{ id: thread }] = await tx`insert into public.chat_threads (user_id) values (${b}) returning id`;
      await tx`insert into public.chat_messages (user_id, thread_id, message_id, role, parts_enc) values (${b}, ${thread}, 'm1', 'user', '\\x00')`;

      await as(tx, a);
      expect(await tx`select id from public.chat_threads`).toHaveLength(0);
      expect(await tx`select id from public.chat_messages`).toHaveLength(0);
      expect(await tx`delete from public.chat_threads where id = ${thread} returning id`).toHaveLength(0);
      const [{ id: mine }] = await tx`insert into public.chat_threads (user_id) values (${a}) returning id`;
      expect(await tx`select id from public.chat_threads`).toEqual([{ id: mine }]);
    }));

  it("keeps cached briefs private to their owner", () =>
    scenario(async (tx, a, b) => {
      const [{ id: contact }] = await tx`insert into public.contacts (user_id, full_name) values (${b}, 'Theirs') returning id`;
      await tx`insert into public.ai_cache (user_id, kind, contact_id, input_hash, payload_enc, model) values (${b}, 'brief', ${contact}, 'h', '\\x00', 'm')`;
      await as(tx, a);
      expect(await tx`select id from public.ai_cache`).toHaveLength(0);
      expect(await tx`update public.ai_cache set input_hash = 'x' returning id`).toHaveLength(0);
    }));

  it("searches people only within the caller's contacts", () =>
    scenario(async (tx, a, b) => {
      await tx`insert into public.contacts (user_id, full_name, title) values (${a}, 'Ada Mine', 'Engineer'), (${b}, 'Ada Theirs', 'Engineer')`;
      await as(tx, a);
      const rows = await tx`select full_name from public.ask_find_contacts(p_title => 'engineer')`;
      expect(rows.map((r) => r.full_name)).toEqual(["Ada Mine"]);
    }));
});

describe("suggestions", () => {
  it("are private to their owner", () =>
    scenario(async (tx, a, b) => {
      const [{ id: contact }] = await tx`insert into public.contacts (user_id, full_name) values (${b}, 'Theirs') returning id`;
      await tx`insert into public.ai_suggestions (user_id, kind, contact_id) values (${b}, 'reconnect', ${contact})`;
      await as(tx, a);
      expect(await tx`select id from public.ai_suggestions`).toHaveLength(0);
      expect(await tx`update public.ai_suggestions set status = 'dismissed' returning id`).toHaveLength(0);
      expect(await rejects(tx, (sp) => sp`select public.suggest_reconnects()`)).toBe(true);
    }));

  it("suggest reconnecting with people gone quiet, at most three at a time, never with an open follow-up", () =>
    scenario(async (tx, a) => {
      const quiet = [];
      for (let i = 0; i < 5; i++) {
        const [{ id }] = await tx`insert into public.contacts (user_id, full_name, created_at) values (${a}, ${`Quiet ${i}`}, now() - interval '200 days') returning id`;
        quiet.push(id);
      }
      await tx`insert into public.contacts (user_id, full_name) values (${a}, 'Recent')`;
      await tx`insert into public.reminders (user_id, contact_id, due_at) values (${a}, ${quiet[0]}, now() + interval '1 day')`;

      const [{ added }] = await tx`select public.suggest_reconnects(${a}) as added`;
      expect(added).toBe(3);
      const rows = await tx`select contact_id from public.ai_suggestions where user_id = ${a} and status = 'pending'`;
      expect(rows.map((r) => r.contact_id)).not.toContain(quiet[0]);
      const [{ again }] = await tx`select public.suggest_reconnects(${a}) as again`;
      expect(again).toBe(0);

      // Getting in touch settles the suggestion.
      await tx`insert into public.interactions (user_id, contact_id, type) values (${a}, ${rows[0].contact_id}, 'call')`;
      const [{ status }] = await tx`select status from public.ai_suggestions where contact_id = ${rows[0].contact_id}`;
      expect(status).toBe("accepted");
    }));
});

describe("similar backgrounds", () => {
  const vec = (x: number, y: number) => `[${Array.from({ length: 1536 }, (_, i) => (i === 0 ? x : i === 1 ? y : 0)).join(",")}]`;

  it("match people across companies only, and only within one network", () =>
    scenario(async (tx, a, b) => {
      const [{ id: acme }] = await tx`insert into public.companies (user_id, name, normalized_name) values (${a}, 'Acme', 'acme') returning id`;
      const add = async (owner: string, name: string, v: string, company: string | null = null) => {
        const [{ id }] = await tx`insert into public.contacts (user_id, full_name, company_id, background_embedding, background_model)
                                  values (${owner}, ${name}, ${company}, ${v}::extensions.vector, 'm') returning id`;
        return id as string;
      };
      const me = await add(a, "Me", vec(1, 0), acme);
      const colleague = await add(a, "Colleague", vec(1, 0.01), acme);
      const peer = await add(a, "Peer", vec(1, 0.1));
      await add(a, "Unrelated", vec(0, 1));
      await add(b, "Someone else's", vec(1, 0));

      await tx`select public.refresh_user_similarity(${a})`;
      const mine = await tx`select similar_id from public.contact_similarity where contact_id = ${me}`;
      expect(mine.map((r) => r.similar_id)).toEqual([peer]);
      expect(mine.map((r) => r.similar_id)).not.toContain(colleague);

      await as(tx, b);
      expect(await tx`select contact_id from public.contact_similarity`).toHaveLength(0);
      expect(await rejects(tx, (sp) => sp`select public.refresh_user_similarity()`)).toBe(true);
      expect(await rejects(tx, (sp) => sp`select public.refresh_contact_similarity(${me})`)).toBe(true);
    }));
});

describe("insights", () => {
  it("count only the caller's own network, and keep summaries private", () =>
    scenario(async (tx, a, b) => {
      await tx`insert into public.contacts (user_id, full_name, role_family) values (${a}, 'Mine', 'Engineering'), (${b}, 'Theirs 1', 'Sales'), (${b}, 'Theirs 2', 'Sales')`;
      await tx`insert into public.insight_summaries (user_id, input_hash, payload_enc, model) values (${b}, 'h', '\\x00', 'm')`;

      await as(tx, a);
      const [{ stats }] = await tx`select public.network_insights('Asia/Kolkata') as stats`;
      expect(stats.totals.people).toBe(1);
      expect(stats.roles).toEqual([{ value: "Engineering", count: 1 }]);
      expect(stats.growth).toHaveLength(12);
      expect(await tx`select user_id from public.insight_summaries`).toHaveLength(0);
    }));
});
