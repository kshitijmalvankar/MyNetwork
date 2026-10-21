-- Core: extensions, profiles, per-user encryption keys, audit log.
--
-- Conventions for every table in this project:
--   * row-level security is enabled
--   * anon gets nothing; authenticated gets only the grants it needs
--   * tables the browser must never touch (keys, audit writes, metering) have
--     no client grants at all and are written by the server's service role

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user, created by trigger)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  timezone text not null default 'UTC' check (char_length(timezone) <= 64),
  phone_region text not null default 'US' check (phone_region ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, timezone, phone_region) on public.profiles to authenticated;

create policy "profiles: read own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 80));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Per-user data encryption keys, wrapped by the app master key.
-- Server (service role) only: no client grants, no policies.
-- ---------------------------------------------------------------------------

create table public.user_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  wrapped_dek bytea not null,
  key_version smallint not null check (key_version > 0),
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

alter table public.user_keys enable row level security;
revoke all on public.user_keys from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Audit log. Users can read their own entries; only the server writes.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  action text not null check (char_length(action) <= 64),
  target_type text check (char_length(target_type) <= 64),
  target_id text check (char_length(target_id) <= 128),
  ip_hash text,
  user_agent text check (char_length(user_agent) <= 512),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_user_created_idx on public.audit_log (user_id, created_at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create policy "audit_log: read own" on public.audit_log
  for select to authenticated
  using ((select auth.uid()) = user_id);
