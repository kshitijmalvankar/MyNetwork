-- Deleting a user cascades to their interactions, and this trigger then ran as
-- the role deleting the user (Supabase Auth's), which has no access to
-- contacts. So any account with a logged meeting or call couldn't be deleted,
-- from the app or the dashboard. Run it as its owner instead, and only ever
-- touch the interaction owner's own contact.
create or replace function public.touch_last_contacted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact uuid := coalesce(new.contact_id, old.contact_id);
  v_user uuid := coalesce(new.user_id, old.user_id);
begin
  update public.contacts c
  set last_contacted_at = (
    select max(i.occurred_at) from public.interactions i where i.contact_id = v_contact and i.user_id = v_user
  )
  where c.id = v_contact and c.user_id = v_user;
  return null;
end;
$$;

revoke execute on function public.touch_last_contacted() from public, anon, authenticated;
