-- One account's AI spend since midnight UTC, for the per-account daily cap, so
-- no single account can use up the global budget. Server-only.
create function public.ai_user_spend_today(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(cost_usd), 0)
  from public.ai_usage
  where user_id = p_user_id and created_at >= date_trunc('day', now() at time zone 'utc')
$$;

revoke execute on function public.ai_user_spend_today(uuid) from public, anon, authenticated;
