-- Keep contacts.last_contacted_at correct when history is removed or edited.
create or replace function public.touch_last_contacted()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_contact uuid := coalesce(new.contact_id, old.contact_id);
begin
  update public.contacts
  set last_contacted_at = (select max(i.occurred_at) from public.interactions i where i.contact_id = v_contact)
  where id = v_contact;
  return null;
end;
$$;

drop trigger interactions_touch_contact on public.interactions;
create trigger interactions_touch_contact
  after insert or update or delete on public.interactions
  for each row execute function public.touch_last_contacted();
