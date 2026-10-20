-- Clear Clarion International School back to a blank sheet.
--
-- Keeps the school, all 30 accounts, the 8 classes (with their join codes,
-- teachers and students) and the rewards on offer. Removes everything that
-- has happened since: work, hand-ins and attachments, points, reward
-- requests, discussions, flashcards and AI Helper chats.
--
-- Run it in one go in the SQL editor. Files uploaded to the task-files bucket
-- are not removed here (Supabase only deletes stored files through the
-- Storage API); empty their folders under Storage → task-files if needed.

do $$
declare
  school uuid := (select id from public.schools where name = 'Clarion International School');
begin
  if school is null then
    raise notice 'Clarion International School does not exist, nothing to do';
    return;
  end if;

  create temp table school_people on commit drop as
    select id from public.profiles where school_id = school;
  alter table school_people enable row level security;
  create temp table school_classes on commit drop as
    select id from public.classes where school_id = school;
  alter table school_classes enable row level security;

  -- Work, with its hand-ins and attachments.
  delete from public.tasks
  where class_id in (select id from school_classes) or owner_id in (select id from school_people);

  -- Points and reward requests. The rewards themselves stay on offer.
  delete from public.points_ledger where student_id in (select id from school_people);
  delete from public.redemptions where student_id in (select id from school_people);

  -- Discussions, with their posts and read markers.
  delete from public.threads where class_id in (select id from school_classes);
  delete from public.thread_reads where user_id in (select id from school_people);

  -- Flashcard decks, with their cards and reviews.
  delete from public.flashcard_decks
  where class_id in (select id from school_classes) or owner_id in (select id from school_people);
  delete from public.flashcard_reviews where user_id in (select id from school_people);

  -- AI Helper chats, with their messages.
  delete from public.ai_conversations where user_id in (select id from school_people);
end $$;
