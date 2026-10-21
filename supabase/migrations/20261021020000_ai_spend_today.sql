-- Total AI spend since midnight UTC, for the global daily circuit breaker.
-- (PostgREST aggregates are disabled, so this is a function.) Server-only.
create function public.ai_spend_today()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(cost_usd), 0) from public.ai_usage where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
$$;

revoke execute on function public.ai_spend_today() from public, anon, authenticated;
