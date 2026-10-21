-- Network data (companies, events, contacts…), card capture (scans, images),
-- encrypted file storage, and AI plans / metering.

-- ---------------------------------------------------------------------------
-- Plans, entitlements and metering (server-written; users can read their own)
-- ---------------------------------------------------------------------------

create table public.plans (
  id text primary key,
  name text not null,
  -- Monthly allowance per feature, e.g. {"scan": 50, "ask": 150}
  limits jsonb not null,
  created_at timestamptz not null default now()
);

insert into public.plans (id, name, limits) values
  ('free', 'Free', '{"scan": 50, "ask": 150, "voice_minutes": 30, "brief": 20}');

alter table public.plans enable row level security;
revoke all on public.plans from anon, authenticated;
grant select on public.plans to authenticated;
create policy "plans: readable" on public.plans for select to authenticated using (true);

create table public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_id text not null default 'free' references public.plans (id),
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;
revoke all on public.entitlements from anon, authenticated;
grant select on public.entitlements to authenticated;
create policy "entitlements: read own" on public.entitlements
  for select to authenticated using ((select auth.uid()) = user_id);

create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  period date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, feature, period)
);

alter table public.usage_counters enable row level security;
revoke all on public.usage_counters from anon, authenticated;
grant select on public.usage_counters to authenticated;
create policy "usage_counters: read own" on public.usage_counters
  for select to authenticated using ((select auth.uid()) = user_id);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  feature text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  latency_ms integer,
  escalated boolean not null default false,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);

create index ai_usage_created_idx on public.ai_usage (created_at);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
create policy "ai_usage: read own" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- Atomically take `amount` from this month's allowance. Server-only.
create function public.consume_quota(p_user_id uuid, p_feature text, p_amount integer default 1)
returns table (allowed boolean, used integer, quota integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quota integer;
  v_period date := date_trunc('month', now())::date;
  v_used integer;
begin
  select coalesce((p.limits ->> p_feature)::integer, 0) into v_quota
  from public.plans p
  where p.id = coalesce((select e.plan_id from public.entitlements e where e.user_id = p_user_id), 'free');

  insert into public.usage_counters (user_id, feature, period)
  values (p_user_id, p_feature, v_period)
  on conflict do nothing;

  update public.usage_counters
  set count = count + p_amount
  where user_id = p_user_id and feature = p_feature and period = v_period and count + p_amount <= v_quota
  returning count into v_used;

  if v_used is null then
    select c.count into v_used from public.usage_counters c
    where c.user_id = p_user_id and c.feature = p_feature and c.period = v_period;
    return query select false, v_used, v_quota;
  else
    return query select true, v_used, v_quota;
  end if;
end;
$$;

-- Give back allowance when the work failed for reasons that are not the user's fault.
create function public.release_quota(p_user_id uuid, p_feature text, p_amount integer default 1)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.usage_counters
  set count = greatest(0, count - p_amount)
  where user_id = p_user_id and feature = p_feature and period = date_trunc('month', now())::date;
$$;

revoke execute on function public.consume_quota(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.release_quota(uuid, text, integer) from public, anon, authenticated;

-- New users start on the free plan.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 80));
  insert into public.entitlements (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

insert into public.entitlements (user_id) select id from auth.users on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Network: companies, events, contacts and what hangs off them.
-- Every table is owned by one user and fully private to them.
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  normalized_name text not null,
  domain text check (char_length(domain) <= 253),
  industry text check (char_length(industry) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create index companies_name_trgm_idx on public.companies using gin (normalized_name extensions.gin_trgm_ops);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  starts_on date,
  location text check (char_length(location) <= 200),
  description_enc bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_user_date_idx on public.events (user_id, starts_on desc nulls last);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 200),
  name_native text check (char_length(name_native) <= 200),
  title text check (char_length(title) <= 200),
  title_native text check (char_length(title_native) <= 200),
  language text check (language ~ '^[a-z]{2,3}$'),
  company_id uuid references public.companies (id) on delete set null,
  website text check (char_length(website) <= 253),
  city text check (char_length(city) <= 120),
  country text check (country ~ '^[A-Z]{2}$'),
  role_family text check (role_family in (
    'Engineering', 'Product', 'Design', 'Data', 'Sales', 'Marketing', 'Finance', 'Operations',
    'HR', 'Legal', 'Executive', 'Founder', 'Consulting', 'Research', 'Healthcare', 'Education', 'Other')),
  seniority text check (seniority in (
    'Intern', 'Junior', 'Mid', 'Senior', 'Lead/Manager', 'Director', 'VP', 'C-level/Founder')),
  industry_override text check (char_length(industry_override) <= 80),
  -- Encrypted with the owner's data key (see lib/crypto).
  emails_enc bytea,
  phones_enc bytea,
  address_enc bytea,
  raw_extraction_enc bytea,
  past_positions jsonb not null default '[]'::jsonb,
  last_contacted_at timestamptz,
  source_scan_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_user_created_idx on public.contacts (user_id, created_at desc);
create index contacts_user_company_idx on public.contacts (user_id, company_id);
create index contacts_user_role_idx on public.contacts (user_id, role_family, seniority);
create index contacts_name_trgm_idx on public.contacts using gin (full_name extensions.gin_trgm_ops);

-- Keyed fingerprints of emails/phones for exact lookups and duplicate detection.
create table public.contact_identifiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  kind text not null check (kind in ('email', 'phone')),
  blind_index text not null,
  created_at timestamptz not null default now(),
  unique (contact_id, kind, blind_index)
);

create index contact_identifiers_lookup_idx on public.contact_identifiers (user_id, kind, blind_index);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  type text not null check (type in ('met', 'email', 'call', 'meeting', 'message')),
  event_id uuid references public.events (id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index interactions_contact_idx on public.interactions (contact_id, occurred_at desc);
create index interactions_event_idx on public.interactions (user_id, event_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'voice', 'draft', 'brief')),
  body_enc bytea not null,
  summary_enc bytea,
  audio_path text,
  duration_s integer check (duration_s between 0 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contact_id is not null or event_id is not null)
);

create index notes_contact_idx on public.notes (contact_id, created_at desc);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  due_at timestamptz not null,
  note_enc bytea,
  done_at timestamptz,
  source text not null default 'user' check (source in ('user', 'ai')),
  created_at timestamptz not null default now()
);

create index reminders_due_idx on public.reminders (user_id, done_at, due_at);

-- ---------------------------------------------------------------------------
-- Capture: scans (processing queue) and stored card images
-- ---------------------------------------------------------------------------

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  batch_id uuid,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'needs_review', 'saved', 'failed', 'discarded')),
  attempts smallint not null default 0,
  claimed_at timestamptz,
  front_path text not null,
  back_path text,
  thumb_path text,
  qr_payload_enc bytea,
  extraction_enc bytea,
  validation jsonb,
  model_used text,
  error text check (char_length(error) <= 500),
  contact_id uuid references public.contacts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scans_user_status_idx on public.scans (user_id, status, created_at desc);
create index scans_queue_idx on public.scans (status, claimed_at) where status in ('uploaded', 'processing');

create table public.card_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  side text not null check (side in ('front', 'back')),
  path text not null,
  thumb_path text,
  created_at timestamptz not null default now()
);

create index card_images_contact_idx on public.card_images (contact_id);

-- Atomically claim a scan for processing (one worker wins). Server-only.
create function public.claim_scan(p_scan_id uuid, p_stale_after interval default '2 minutes')
returns setof public.scans
language sql
security definer
set search_path = ''
as $$
  update public.scans
  set status = 'processing', claimed_at = now(), attempts = attempts + 1, updated_at = now()
  where id = p_scan_id
    and attempts < 3
    and (status = 'uploaded' or (status = 'processing' and claimed_at < now() - p_stale_after))
  returning *;
$$;

revoke execute on function public.claim_scan(uuid, interval) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Shared plumbing: updated_at triggers, last-contacted tracking, RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['companies', 'events', 'contacts', 'notes', 'scans'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end;
$$;

create function public.touch_last_contacted()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.contacts
  set last_contacted_at = greatest(coalesce(last_contacted_at, new.occurred_at), new.occurred_at)
  where id = new.contact_id;
  return new;
end;
$$;

create trigger interactions_touch_contact
  after insert on public.interactions
  for each row execute function public.touch_last_contacted();

-- Owner-only access for every user-content table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'events', 'contacts', 'contact_identifiers', 'interactions',
    'notes', 'reminders', 'scans', 'card_images'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || ': owner only', t);
  end loop;
end;
$$;

-- Live status updates on the review queue.
alter publication supabase_realtime add table public.scans;

-- ---------------------------------------------------------------------------
-- Encrypted file storage. Objects are AES-GCM blobs under "<user_id>/…".
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vault', 'vault', false, 6291456, array['application/octet-stream'])
on conflict (id) do nothing;

create policy "vault: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "vault: owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "vault: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);
