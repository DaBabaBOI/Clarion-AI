-- The AI Helper's feedback loop.
--
-- ai_feedback: the person who asked rates each answer helpful (1) or not (-1).
-- class_ai_notes: one note per class that its teachers write for Clarion, such
-- as the test date or the method the class uses.
--
-- The study-helper function reads both with every question (as the asker, so
-- row level security still decides what it sees): the class notes become part
-- of the context, and recent ratings tell the model what to keep doing and
-- what to avoid. Teachers see the ratings on chats they can already review.

-- ── Ratings ─────────────────────────────────────────────────────────────────

create table public.ai_feedback (
  message_id uuid primary key references public.ai_messages (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index ai_feedback_user_idx on public.ai_feedback (user_id, created_at desc);

-- Only the person who asked can rate an answer, and only an answer.
create or replace function private.can_rate_message(target_message uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.ai_messages m
    join public.ai_conversations c on c.id = m.conversation_id
    where m.id = target_message and m.role = 'assistant' and c.user_id = (select auth.uid())
  )
$$;
revoke execute on function private.can_rate_message(uuid) from public, anon;
grant execute on function private.can_rate_message(uuid) to authenticated;

alter table public.ai_feedback enable row level security;
revoke all on public.ai_feedback from anon;
revoke update on public.ai_feedback from authenticated;
grant update (rating, comment) on public.ai_feedback to authenticated;

-- Ratings are visible wherever the rated answer is: to the asker, and to the
-- class teacher for chats about their class.
create policy "Read ratings on answers you can see" on public.ai_feedback
  for select to authenticated
  using (exists (select 1 from public.ai_messages m where m.id = message_id));
create policy "Rate your own answers" on public.ai_feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_rate_message(message_id));
create policy "Change your own ratings" on public.ai_feedback
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Take back your own ratings" on public.ai_feedback
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── Notes for Clarion ───────────────────────────────────────────────────────

create table public.class_ai_notes (
  class_id uuid primary key references public.classes (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create or replace function public.stamp_class_ai_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;
create trigger before_class_ai_note_write
  before insert or update on public.class_ai_notes
  for each row execute function public.stamp_class_ai_note();

alter table public.class_ai_notes enable row level security;
revoke all on public.class_ai_notes from anon;
revoke update on public.class_ai_notes from authenticated;
grant update (body) on public.class_ai_notes to authenticated;

-- Everyone in the class can read the note (the AI reads it as them); only the
-- class's teachers write it.
create policy "Class members read the note" on public.class_ai_notes
  for select to authenticated
  using (private.is_class_member(class_id));
create policy "Class teachers add the note" on public.class_ai_notes
  for insert to authenticated
  with check (private.is_class_teacher(class_id));
create policy "Class teachers edit the note" on public.class_ai_notes
  for update to authenticated
  using (private.is_class_teacher(class_id))
  with check (private.is_class_teacher(class_id));
create policy "Class teachers clear the note" on public.class_ai_notes
  for delete to authenticated
  using (private.is_class_teacher(class_id));
