-- A row may only point at a contact, event, company, note or chat thread that
-- belongs to the same user.
--
-- The owner-only policies check the row's own user_id, and plain foreign keys
-- only check that the target exists (ignoring row-level security), so a user
-- who knew another user's contact id could hang a note or reminder off it.
-- Service-role reads that follow a link (an interaction's event, a contact's
-- company) would then cross accounts. Composite keys on (id, user_id) make
-- such rows impossible for everyone, the service role included.

-- Targets: one (id, user_id) key per table that others point at.
do $$
declare
  t text;
begin
  foreach t in array array['companies', 'events', 'contacts', 'notes', 'chat_threads'] loop
    execute format('alter table public.%I add constraint %I unique (id, user_id)', t, t || '_id_user_id_key');
  end loop;
end;
$$;

-- Links: each key now matches on user_id too. Names and delete behavior stay
-- the same; "set null" clears only the link, never the owner.
alter table public.contacts
  drop constraint contacts_company_id_fkey,
  add constraint contacts_company_id_fkey foreign key (company_id, user_id)
    references public.companies (id, user_id) on delete set null (company_id);

alter table public.contact_identifiers
  drop constraint contact_identifiers_contact_id_fkey,
  add constraint contact_identifiers_contact_id_fkey foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete cascade;

alter table public.interactions
  drop constraint interactions_contact_id_fkey,
  drop constraint interactions_event_id_fkey,
  add constraint interactions_contact_id_fkey foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete cascade,
  add constraint interactions_event_id_fkey foreign key (event_id, user_id)
    references public.events (id, user_id) on delete set null (event_id);

alter table public.notes
  drop constraint notes_contact_id_fkey,
  drop constraint notes_event_id_fkey,
  add constraint notes_contact_id_fkey foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete cascade,
  add constraint notes_event_id_fkey foreign key (event_id, user_id)
    references public.events (id, user_id) on delete cascade;

alter table public.reminders
  drop constraint reminders_contact_id_fkey,
  add constraint reminders_contact_id_fkey foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete cascade;

alter table public.scans
  drop constraint scans_contact_id_fkey,
  add constraint scans_contact_id_fkey foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete set null (contact_id);

alter table public.card_images
  drop constraint card_images_contact_id_fkey,
  add constraint card_images_contact_id_fkey foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete cascade;

alter table public.knowledge_chunks
  drop constraint knowledge_chunks_contact_id_fkey,
  drop constraint knowledge_chunks_event_id_fkey,
  drop constraint knowledge_chunks_note_id_fkey,
  add constraint knowledge_chunks_contact_id_fkey foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete cascade,
  add constraint knowledge_chunks_event_id_fkey foreign key (event_id, user_id)
    references public.events (id, user_id) on delete cascade,
  add constraint knowledge_chunks_note_id_fkey foreign key (note_id, user_id)
    references public.notes (id, user_id) on delete cascade;

alter table public.chat_messages
  drop constraint chat_messages_thread_id_fkey,
  add constraint chat_messages_thread_id_fkey foreign key (thread_id, user_id)
    references public.chat_threads (id, user_id) on delete cascade;

alter table public.ai_cache
  drop constraint ai_cache_contact_id_fkey,
  add constraint ai_cache_contact_id_fkey foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete cascade;

alter table public.ai_suggestions
  drop constraint ai_suggestions_contact_id_fkey,
  drop constraint ai_suggestions_note_id_fkey,
  add constraint ai_suggestions_contact_id_fkey foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete cascade,
  add constraint ai_suggestions_note_id_fkey foreign key (note_id, user_id)
    references public.notes (id, user_id) on delete cascade;

alter table public.contact_similarity
  drop constraint contact_similarity_contact_id_fkey,
  drop constraint contact_similarity_similar_id_fkey,
  add constraint contact_similarity_contact_id_fkey foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete cascade,
  add constraint contact_similarity_similar_id_fkey foreign key (similar_id, user_id)
    references public.contacts (id, user_id) on delete cascade;
