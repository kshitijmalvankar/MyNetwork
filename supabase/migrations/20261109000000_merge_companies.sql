-- Merges spellings of one company: everyone at the duplicates moves to the kept
-- record, which keeps any domain or industry it lacked, and the duplicates are
-- deleted. All in one transaction. Used by `pnpm data:tidy`. Server-only.
create function public.merge_companies(p_user_id uuid, p_keep uuid, p_drop uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moved integer;
begin
  if not exists (select 1 from public.companies where id = p_keep and user_id = p_user_id) then
    raise exception 'Company % not found for this user', p_keep;
  end if;

  update public.companies k
  set domain = coalesce(k.domain, d.domain),
      industry = coalesce(k.industry, d.industry),
      updated_at = now()
  from (
    select (array_agg(domain order by created_at) filter (where domain is not null))[1] as domain,
           (array_agg(industry order by created_at) filter (where industry is not null))[1] as industry
    from public.companies
    where user_id = p_user_id and id = any(p_drop) and id <> p_keep
  ) d
  where k.id = p_keep;

  -- Their profiles name the company, so they are re-indexed.
  update public.contacts
  set company_id = p_keep, index_requested_at = now()
  where user_id = p_user_id and company_id = any(p_drop) and company_id <> p_keep;
  get diagnostics v_moved = row_count;

  delete from public.companies where user_id = p_user_id and id = any(p_drop) and id <> p_keep;
  return v_moved;
end;
$$;

revoke execute on function public.merge_companies(uuid, uuid, uuid[]) from public, anon, authenticated;
