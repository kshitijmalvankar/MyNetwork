-- Suggestions can now also propose what a note says about someone, added only
-- when the user accepts:
--   connection  other_id introduced them, was introduced by them, or knows them
--   past_job    a company they used to work at
--   topics      what they work on
-- The details are in payload_enc (encrypted JSON), like the note they came from.
alter table public.ai_suggestions
  drop constraint ai_suggestions_kind_check,
  add constraint ai_suggestions_kind_check check (kind in ('follow_up', 'reconnect', 'connection', 'past_job', 'topics')),
  add column other_id uuid,
  add column payload_enc bytea,
  -- The other person must belong to the same user, like everything else.
  add constraint ai_suggestions_other_id_fkey foreign key (other_id, user_id)
    references public.contacts (id, user_id) on delete cascade,
  add constraint ai_suggestions_connection_other check (kind <> 'connection' or other_id is not null);

create index ai_suggestions_other_idx on public.ai_suggestions (other_id) where other_id is not null;

-- What someone works on, as short phrases ("warehouse automation"). Encrypted,
-- because they come from the user's notes.
alter table public.contacts add column topics_enc bytea;
