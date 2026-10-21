-- Contact search, filter facets and event summaries. All are SECURITY INVOKER,
-- so row-level security limits every result to the caller's own data.

create function public.search_contacts(
  p_query text default null,
  p_company_id uuid default null,
  p_role_family text default null,
  p_seniority text default null,
  p_industry text default null,
  p_country text default null,
  p_event_id uuid default null,
  p_sort text default 'recent',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  name_native text,
  title text,
  role_family text,
  seniority text,
  city text,
  country text,
  company_id uuid,
  company_name text,
  industry text,
  last_contacted_at timestamptz,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select nullif(trim(p_query), '') as raw,
           '%' || replace(replace(replace(nullif(trim(p_query), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  ),
  base as (
    select c.id, c.full_name, c.name_native, c.title, c.role_family, c.seniority, c.city, c.country,
           c.company_id, co.name as company_name, coalesce(c.industry_override, co.industry) as industry,
           c.last_contacted_at, c.created_at,
           case when q.raw is null then 0
                else greatest(extensions.similarity(c.full_name, q.raw), extensions.similarity(coalesce(co.name, ''), q.raw))
           end as score
    from public.contacts c
    left join public.companies co on co.id = c.company_id
    cross join q
    where (q.raw is null
           or c.full_name ilike q.pattern
           or c.name_native ilike q.pattern
           or c.title ilike q.pattern
           or co.name ilike q.pattern
           or coalesce(c.industry_override, co.industry) ilike q.pattern
           or c.city ilike q.pattern
           or extensions.similarity(c.full_name, q.raw) > 0.3
           or extensions.similarity(coalesce(co.name, ''), q.raw) > 0.3)
      and (p_company_id is null or c.company_id = p_company_id)
      and (p_role_family is null or c.role_family = p_role_family)
      and (p_seniority is null or c.seniority = p_seniority)
      and (p_industry is null or coalesce(c.industry_override, co.industry) = p_industry)
      and (p_country is null or c.country = p_country)
      and (p_event_id is null or exists (
            select 1 from public.interactions i where i.contact_id = c.id and i.event_id = p_event_id))
  )
  select id, full_name, name_native, title, role_family, seniority, city, country, company_id, company_name, industry,
         last_contacted_at, created_at, count(*) over () as total_count
  from base
  order by
    case when p_sort = 'relevance' then score end desc nulls last,
    case when p_sort = 'name' then lower(full_name) end asc,
    case when p_sort = 'company' then lower(company_name) end asc nulls last,
    case when p_sort = 'contacted' then last_contacted_at end desc nulls last,
    created_at desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

-- Counts for the filter chips.
create function public.contact_facets()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'roleFamilies', coalesce((select jsonb_agg(jsonb_build_object('value', role_family, 'count', n) order by n desc)
      from (select role_family, count(*) n from public.contacts where role_family is not null group by 1) r), '[]'::jsonb),
    'seniorities', coalesce((select jsonb_agg(jsonb_build_object('value', seniority, 'count', n) order by n desc)
      from (select seniority, count(*) n from public.contacts where seniority is not null group by 1) s), '[]'::jsonb),
    'industries', coalesce((select jsonb_agg(jsonb_build_object('value', industry, 'count', n) order by n desc)
      from (select coalesce(c.industry_override, co.industry) industry, count(*) n
            from public.contacts c left join public.companies co on co.id = c.company_id
            where coalesce(c.industry_override, co.industry) is not null group by 1) i), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('value', country, 'count', n) order by n desc)
      from (select country, count(*) n from public.contacts where country is not null group by 1) k), '[]'::jsonb),
    'companies', coalesce((select jsonb_agg(jsonb_build_object('value', id, 'label', name, 'count', n) order by n desc, name)
      from (select co.id, co.name, count(c.id) n from public.companies co join public.contacts c on c.company_id = co.id
            group by co.id, co.name) x), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('value', id, 'label', name, 'count', n) order by starts_on desc nulls last)
      from (select e.id, e.name, e.starts_on, count(distinct i.contact_id) n from public.events e
            join public.interactions i on i.event_id = e.id group by e.id, e.name, e.starts_on) y), '[]'::jsonb)
  );
$$;

-- Events with how many people were met at each.
create function public.event_summaries()
returns table (id uuid, name text, starts_on date, location text, people bigint, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.id, e.name, e.starts_on, e.location, count(distinct i.contact_id) as people, e.created_at
  from public.events e
  left join public.interactions i on i.event_id = e.id
  group by e.id
  order by e.starts_on desc nulls last, e.created_at desc;
$$;

grant execute on function public.search_contacts(text, uuid, text, text, text, text, uuid, text, integer, integer) to authenticated;
grant execute on function public.contact_facets() to authenticated;
grant execute on function public.event_summaries() to authenticated;
revoke execute on function public.search_contacts(text, uuid, text, text, text, text, uuid, text, integer, integer) from anon;
revoke execute on function public.contact_facets() from anon;
revoke execute on function public.event_summaries() from anon;

create index contacts_title_trgm_idx on public.contacts using gin (title extensions.gin_trgm_ops);
create index companies_name_display_trgm_idx on public.companies using gin (name extensions.gin_trgm_ops);
