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
