-- Two-factor enforcement in the database, not only in the app.
--
-- A user who has a verified authenticator must present an aal2 session (they
-- entered a code) before any of their data is readable or writable. The check
-- uses the signed JWT (aal claim) and auth.mfa_factors, never client-supplied
-- data, so editing cookies cannot skip it.

create function public.mfa_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'
  );
$$;

create function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;

revoke execute on function public.mfa_required() from public, anon;
revoke execute on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_required() to authenticated;
grant execute on function public.mfa_satisfied() to authenticated;

-- Restrictive policies are ANDed with the existing owner-only policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'audit_log', 'entitlements', 'usage_counters', 'ai_usage',
    'companies', 'events', 'contacts', 'contact_identifiers', 'interactions',
    'notes', 'reminders', 'scans', 'card_images'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
      t || ': second factor when enrolled', t);
  end loop;
end;
$$;

create policy "vault: second factor when enrolled" on storage.objects
  as restrictive for all to authenticated
  using (bucket_id <> 'vault' or (select public.mfa_satisfied()))
  with check (bucket_id <> 'vault' or (select public.mfa_satisfied()));
