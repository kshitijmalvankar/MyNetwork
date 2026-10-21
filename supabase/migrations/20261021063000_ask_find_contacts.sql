-- Structured people search for "Ask my network". Every filter is optional and
-- forgiving (substring + trigram), because the model passes what the user
-- typed: "XYZ" should find "XYZ Technologies Pvt Ltd". SECURITY INVOKER, so
-- row-level security limits results to the caller's own contacts.

create function public.like_pattern(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select '%' || replace(replace(replace(p, '\', '\\'), '%', '\%'), '_', '\_') || '%';
$$;

create function public.ask_find_contacts(
  p_name text default null,
  p_company text default null,
  p_company_normalized text default null,
  p_title text default null,
  p_role_family text default null,
  p_seniority text default null,
  p_industry text default null,
  p_city text default null,
  p_country text default null,
  p_event text default null,
  p_met_after date default null,
  p_met_before date default null,
  p_limit integer default 25
)
returns table (
  id uuid,
  full_name text,
  title text,
  company text,
  industry text,
  role_family text,
  seniority text,
  city text,
  country text,
  first_met date,
  last_contacted date,
  events text[],
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with f as (
    select nullif(trim(p_name), '') as name,
           nullif(trim(p_company), '') as company,
           nullif(trim(p_company_normalized), '') as company_norm,
           nullif(trim(p_title), '') as title,
           nullif(trim(p_industry), '') as industry,
           nullif(trim(p_city), '') as city,
           nullif(upper(trim(p_country)), '') as country,
           nullif(trim(p_event), '') as event
  ),
  base as (
    select c.id, c.full_name, c.title, co.name as company, coalesce(c.industry_override, co.industry) as industry,
           c.role_family, c.seniority, c.city, c.country, c.created_at, c.last_contacted_at
    from public.contacts c
    left join public.companies co on co.id = c.company_id
    cross join f
    where (f.name is null
           or c.full_name ilike public.like_pattern(f.name)
           or c.name_native ilike public.like_pattern(f.name)
           or extensions.similarity(c.full_name, f.name) > 0.35)
      and (f.company is null
           or co.name ilike public.like_pattern(f.company)
           or co.domain ilike public.like_pattern(f.company)
           or (f.company_norm is not null and co.normalized_name ilike public.like_pattern(f.company_norm))
           or extensions.similarity(co.normalized_name, coalesce(f.company_norm, lower(f.company))) > 0.4)
      and (f.title is null or c.title ilike public.like_pattern(f.title) or c.title_native ilike public.like_pattern(f.title))
      and (p_role_family is null or c.role_family = p_role_family)
      and (p_seniority is null or c.seniority = p_seniority)
      and (f.industry is null or coalesce(c.industry_override, co.industry) ilike public.like_pattern(f.industry))
      and (f.city is null or c.city ilike public.like_pattern(f.city))
      and (f.country is null or c.country = f.country)
      and (f.event is null or exists (
            select 1 from public.interactions i join public.events e on e.id = i.event_id
            where i.contact_id = c.id
              and (e.name ilike public.like_pattern(f.event) or extensions.similarity(e.name, f.event) > 0.35)))
      and (p_met_after is null and p_met_before is null or exists (
            -- When you met someone: any logged interaction, or when they were added if none.
            select 1
            from (select i.occurred_at as at from public.interactions i where i.contact_id = c.id
                  union all
                  select c.created_at where not exists (select 1 from public.interactions i where i.contact_id = c.id)) d
            where (p_met_after is null or d.at >= p_met_after)
              and (p_met_before is null or d.at < p_met_before + 1)))
  )
  select b.id, b.full_name, b.title, b.company, b.industry, b.role_family, b.seniority, b.city, b.country,
         coalesce((select min(i.occurred_at) from public.interactions i where i.contact_id = b.id), b.created_at)::date as first_met,
         b.last_contacted_at::date as last_contacted,
         coalesce((select array_agg(distinct e.name) from public.interactions i join public.events e on e.id = i.event_id
                   where i.contact_id = b.id), '{}') as events,
         count(*) over () as total_count
  from base b
  order by b.last_contacted_at desc nulls last, b.full_name
  limit least(greatest(p_limit, 1), 1000);
$$;

grant execute on function public.like_pattern(text) to authenticated;
grant execute on function public.ask_find_contacts(text, text, text, text, text, text, text, text, text, text, date, date, integer) to authenticated;
revoke execute on function public.ask_find_contacts(text, text, text, text, text, text, text, text, text, text, date, date, integer) from public, anon;
