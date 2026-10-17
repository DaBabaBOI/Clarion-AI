-- Clarion initial schema
--
-- One school buys Clarion; students and teachers join classes with a code.
-- The core rule from the design brief is enforced here, not in the browser:
-- students can only hand work in, a teacher verifies it, and only that
-- verification writes points to the ledger.

-- ── Types ───────────────────────────────────────────────────────────────────

create type public.user_role as enum ('student', 'teacher', 'admin');
create type public.class_color as enum ('mint', 'sky', 'brand', 'amber');
create type public.submission_status as enum ('submitted', 'verified', 'returned');
create type public.thread_visibility as enum ('public', 'direct');
create type public.redemption_status as enum ('requested', 'approved', 'declined', 'unlocked');
create type public.review_result as enum ('again', 'good');
create type public.ai_role as enum ('user', 'assistant');

-- ── Tables ──────────────────────────────────────────────────────────────────

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  school_id uuid references public.schools (id) on delete set null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  role public.user_role not null default 'student',
  year_group text check (char_length(year_group) <= 20),
  show_on_leaderboard boolean not null default true,
  created_at timestamptz not null default now()
);
create index profiles_school_id_idx on public.profiles (school_id);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color public.class_color not null default 'brand',
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);
create index classes_school_id_idx on public.classes (school_id);

create table public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.user_role not null default 'student' check (role in ('student', 'teacher')),
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index class_members_user_id_idx on public.class_members (user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes (id) on delete cascade,
  owner_id uuid references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  details text check (char_length(details) <= 4000),
  set_on date not null default current_date,
  due_on date not null,
  points integer not null default 0 check (points between 0 and 100),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Class work belongs to a class. A personal reminder belongs to one
  -- student and never pays points.
  constraint tasks_scope check (
    (class_id is not null and owner_id is null)
    or (class_id is null and owner_id is not null and points = 0)
  )
);
create index tasks_class_due_idx on public.tasks (class_id, due_on);
create index tasks_owner_due_idx on public.tasks (owner_id, due_on);
create index tasks_created_by_idx on public.tasks (created_by);

create table public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  student_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status public.submission_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references public.profiles (id) on delete set null,
  unique (task_id, student_id)
);
create index task_submissions_student_idx on public.task_submissions (student_id);
create index task_submissions_verified_by_idx on public.task_submissions (verified_by);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  cost integer not null check (cost > 0),
  needs_teacher boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index rewards_school_id_idx on public.rewards (school_id);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status public.redemption_status not null default 'requested',
  created_at timestamptz not null default now()
);
create index redemptions_reward_idx on public.redemptions (reward_id);
create index redemptions_student_idx on public.redemptions (student_id);

-- Append-only. Rows with a submission_id are earned (or reversed) task
-- points; rows with a redemption_id are spending and refunds.
-- Balance = sum(delta). Leaderboards count task points only, so spending
-- never lowers a rank and refunds never raise one.
create table public.points_ledger (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  delta integer not null check (delta <> 0),
  reason text not null,
  submission_id uuid references public.task_submissions (id) on delete set null,
  redemption_id uuid references public.redemptions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index points_ledger_student_idx on public.points_ledger (student_id, created_at);
create index points_ledger_class_idx on public.points_ledger (class_id);
create index points_ledger_submission_idx on public.points_ledger (submission_id);
create index points_ledger_redemption_idx on public.points_ledger (redemption_id);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  -- public: the whole class. direct: the author and the class teachers.
  visibility public.thread_visibility not null default 'public',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  last_post_at timestamptz not null default now()
);
create index threads_class_last_post_idx on public.threads (class_id, last_post_at desc);
create index threads_author_idx on public.threads (author_id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index posts_thread_created_idx on public.posts (thread_id, created_at);
create index posts_author_idx on public.posts (author_id);

create table public.thread_reads (
  thread_id uuid not null references public.threads (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index thread_reads_user_idx on public.thread_reads (user_id);

create table public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  -- Shared decks are visible to the whole class; only teachers can share.
  shared boolean not null default false,
  created_at timestamptz not null default now()
);
create index flashcard_decks_class_idx on public.flashcard_decks (class_id);
create index flashcard_decks_owner_idx on public.flashcard_decks (owner_id);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.flashcard_decks (id) on delete cascade,
  front text not null check (char_length(front) between 1 and 500),
  back text not null check (char_length(back) between 1 and 1000),
  position integer not null default 0
);
create index flashcards_deck_idx on public.flashcards (deck_id, position);

create table public.flashcard_reviews (
  card_id uuid not null references public.flashcards (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  result public.review_result not null,
  reviewed_at timestamptz not null default now(),
  primary key (card_id, user_id)
);
create index flashcard_reviews_user_idx on public.flashcard_reviews (user_id);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  title text not null default 'New chat' check (char_length(title) <= 120),
  created_at timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, created_at desc);
create index ai_conversations_class_idx on public.ai_conversations (class_id);

-- Assistant replies are written by the server with the service role, so a
-- student can never fabricate an answer or its sources.
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role public.ai_role not null,
  content text not null check (char_length(content) between 1 and 20000),
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

-- ── Helper functions (used by policies) ─────────────────────────────────────
-- security definer so policies can read membership without recursing
-- through the same policies; search_path pinned so they cannot be hijacked.

create function public.my_school_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.school_id from public.profiles p where p.id = (select auth.uid())
$$;

create function public.my_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;

create function public.is_class_member(target_class uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.class_members m
    where m.class_id = target_class and m.user_id = (select auth.uid())
  )
$$;

create function public.is_class_teacher(target_class uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.class_members m
    where m.class_id = target_class and m.user_id = (select auth.uid()) and m.role = 'teacher'
  )
$$;

create function public.shares_class_with(other_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.class_members mine
    join public.class_members theirs on theirs.class_id = mine.class_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other_user
  )
$$;

create function public.can_see_thread(target_thread uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.threads t
    where t.id = target_thread
      and public.is_class_member(t.class_id)
      and (
        t.visibility = 'public'
        or t.author_id = (select auth.uid())
        or public.is_class_teacher(t.class_id)
      )
  )
$$;

create function public.can_see_deck(target_deck uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.flashcard_decks d
    where d.id = target_deck
      and (
        d.owner_id = (select auth.uid())
        or (d.shared and d.class_id is not null and public.is_class_member(d.class_id))
      )
  )
$$;

create function public.task_class_teacher(target_task uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = target_task and t.class_id is not null and public.is_class_teacher(t.class_id)
  )
$$;

create function public.can_see_task(target_task uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = target_task
      and (
        t.owner_id = (select auth.uid())
        or (t.class_id is not null and public.is_class_member(t.class_id))
      )
  )
$$;

create function public.owns_conversation(target_conversation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.ai_conversations c
    where c.id = target_conversation and c.user_id = (select auth.uid())
  )
$$;

create function public.can_review_conversation(target_conversation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.ai_conversations c
    where c.id = target_conversation
      and (
        c.user_id = (select auth.uid())
        or (c.class_id is not null and public.is_class_teacher(c.class_id))
      )
  )
$$;

-- ── Triggers ────────────────────────────────────────────────────────────────

-- Every new auth user gets a student profile. Roles are never taken from
-- sign-up metadata; an admin promotes teachers.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The teacher who creates a class becomes its first teacher member.
create function public.add_class_creator()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    insert into public.class_members (class_id, user_id, role)
    values (new.id, (select auth.uid()), 'teacher')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_class_created
  after insert on public.classes
  for each row execute function public.add_class_creator();

-- Stamp who verified a submission and when.
create function public.stamp_verification()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    new.verified_at := now();
    new.verified_by := (select auth.uid());
  elsif new.status <> 'verified' then
    new.verified_at := null;
    new.verified_by := null;
  end if;
  return new;
end;
$$;

create trigger before_submission_update
  before update on public.task_submissions
  for each row execute function public.stamp_verification();

-- The only way points are earned: a teacher verifying a submission. Undoing
-- a verification writes a matching reversal so the ledger stays append-only.
create function public.pay_out_verified_submission()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  task_points integer;
  task_class uuid;
  task_title text;
begin
  select t.points, t.class_id, t.title into task_points, task_class, task_title
  from public.tasks t where t.id = new.task_id;

  if task_class is null or coalesce(task_points, 0) = 0 then
    return new;
  end if;

  if new.status = 'verified' and old.status is distinct from 'verified' then
    insert into public.points_ledger (student_id, class_id, delta, reason, submission_id)
    values (new.student_id, task_class, task_points, task_title, new.id);
  elsif old.status = 'verified' and new.status <> 'verified' then
    insert into public.points_ledger (student_id, class_id, delta, reason, submission_id)
    values (new.student_id, task_class, -task_points, 'Verification undone: ' || task_title, new.id);
  end if;
  return new;
end;
$$;

create trigger after_submission_update
  after update on public.task_submissions
  for each row execute function public.pay_out_verified_submission();

-- A declined reward request gives the points back.
create function public.refund_declined_redemption()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  reward public.rewards%rowtype;
begin
  if new.status = 'declined' and old.status = 'requested' then
    select * into reward from public.rewards r where r.id = new.reward_id;
    insert into public.points_ledger (student_id, delta, reason, redemption_id)
    values (new.student_id, reward.cost, 'Refund: ' || reward.title, new.id);
  end if;
  return new;
end;
$$;

create trigger after_redemption_update
  after update on public.redemptions
  for each row execute function public.refund_declined_redemption();

-- Keep thread ordering current for the inbox.
create function public.touch_thread()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.threads set last_post_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;

create trigger after_post_insert
  after insert on public.posts
  for each row execute function public.touch_thread();

-- ── Row level security ──────────────────────────────────────────────────────

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
alter table public.points_ledger enable row level security;
alter table public.threads enable row level security;
alter table public.posts enable row level security;
alter table public.thread_reads enable row level security;
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

-- Signed-out visitors get nothing.
revoke all on all tables in schema public from anon;

-- schools
create policy "Members read their school" on public.schools
  for select to authenticated using (id = (select public.my_school_id()));

-- profiles
create policy "Read own profile and classmates" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_class_with(id));
create policy "Update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Only these columns are editable by their owner; role and school are not.
revoke update on public.profiles from authenticated;
grant update (full_name, year_group, show_on_leaderboard) on public.profiles to authenticated;

-- classes
create policy "Members read their classes" on public.classes
  for select to authenticated using (public.is_class_member(id));
create policy "Teachers create classes in their school" on public.classes
  for insert to authenticated
  with check (school_id = (select public.my_school_id()) and (select public.my_role()) in ('teacher', 'admin'));
create policy "Class teachers update their class" on public.classes
  for update to authenticated using (public.is_class_teacher(id)) with check (public.is_class_teacher(id));
create policy "Class teachers delete their class" on public.classes
  for delete to authenticated using (public.is_class_teacher(id));

-- class_members (joining goes through join_class())
create policy "Members see their classmates" on public.class_members
  for select to authenticated using (public.is_class_member(class_id));
create policy "Leave a class, or teachers remove members" on public.class_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_class_teacher(class_id));

-- tasks
create policy "Read class work and own reminders" on public.tasks
  for select to authenticated
  using (owner_id = (select auth.uid()) or (class_id is not null and public.is_class_member(class_id)));
create policy "Teachers set class work, students add reminders" on public.tasks
  for insert to authenticated
  with check (
    (class_id is null and owner_id = (select auth.uid()))
    or (class_id is not null and public.is_class_teacher(class_id))
  );
create policy "Edit own reminders or class work you teach" on public.tasks
  for update to authenticated
  using (owner_id = (select auth.uid()) or (class_id is not null and public.is_class_teacher(class_id)))
  with check (
    (class_id is null and owner_id = (select auth.uid()))
    or (class_id is not null and public.is_class_teacher(class_id))
  );
create policy "Delete own reminders or class work you teach" on public.tasks
  for delete to authenticated
  using (owner_id = (select auth.uid()) or (class_id is not null and public.is_class_teacher(class_id)));

-- task_submissions: students hand in, teachers verify
create policy "Students see their own, teachers see their class" on public.task_submissions
  for select to authenticated
  using (student_id = (select auth.uid()) or public.task_class_teacher(task_id));
create policy "Students hand in work" on public.task_submissions
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and status = 'submitted'
    and public.can_see_task(task_id)
    -- Teachers cannot hand in, and so cannot verify, their own work.
    and not public.task_class_teacher(task_id)
  );
create policy "Teachers verify or return work" on public.task_submissions
  for update to authenticated
  using (public.task_class_teacher(task_id)) with check (public.task_class_teacher(task_id));
create policy "Students take back unverified work" on public.task_submissions
  for delete to authenticated
  using (student_id = (select auth.uid()) and status = 'submitted');
revoke update on public.task_submissions from authenticated;
grant update (status) on public.task_submissions to authenticated;

-- points_ledger: read-only for clients; written by triggers and redeem_reward()
create policy "Students read their own points" on public.points_ledger
  for select to authenticated using (student_id = (select auth.uid()));

-- rewards
create policy "Read rewards in your school" on public.rewards
  for select to authenticated using (school_id = (select public.my_school_id()));
create policy "Admins manage rewards" on public.rewards
  for all to authenticated
  using (school_id = (select public.my_school_id()) and (select public.my_role()) = 'admin')
  with check (school_id = (select public.my_school_id()) and (select public.my_role()) = 'admin');

-- redemptions (created through redeem_reward())
create policy "Students see theirs, staff see their school" on public.redemptions
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (
      (select public.my_role()) in ('teacher', 'admin')
      and exists (select 1 from public.rewards r where r.id = reward_id and r.school_id = (select public.my_school_id()))
    )
  );
create policy "Staff approve or decline" on public.redemptions
  for update to authenticated
  using (
    (select public.my_role()) in ('teacher', 'admin')
    and exists (select 1 from public.rewards r where r.id = reward_id and r.school_id = (select public.my_school_id()))
  )
  with check (
    (select public.my_role()) in ('teacher', 'admin')
    and exists (select 1 from public.rewards r where r.id = reward_id and r.school_id = (select public.my_school_id()))
  );
revoke update on public.redemptions from authenticated;
grant update (status) on public.redemptions to authenticated;

-- threads
create policy "Read visible threads" on public.threads
  for select to authenticated using (public.can_see_thread(id));
create policy "Members start threads" on public.threads
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_class_member(class_id)
    and (pinned = false or public.is_class_teacher(class_id))
  );
create policy "Teachers pin and edit threads" on public.threads
  for update to authenticated
  using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
create policy "Authors or teachers delete threads" on public.threads
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_class_teacher(class_id));

-- posts
create policy "Read posts in visible threads" on public.posts
  for select to authenticated using (public.can_see_thread(thread_id));
create policy "Reply in visible threads" on public.posts
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_see_thread(thread_id));
create policy "Edit own posts" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Authors or teachers delete posts" on public.posts
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (select 1 from public.threads t where t.id = thread_id and public.is_class_teacher(t.class_id))
  );
revoke update on public.posts from authenticated;
grant update (body) on public.posts to authenticated;

-- thread_reads
create policy "Own read markers" on public.thread_reads
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_see_thread(thread_id));

-- flashcard_decks
create policy "Read own and shared decks" on public.flashcard_decks
  for select to authenticated
  using (owner_id = (select auth.uid()) or (shared and class_id is not null and public.is_class_member(class_id)));
create policy "Create own decks" on public.flashcard_decks
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (class_id is null or public.is_class_member(class_id))
    and (not shared or (class_id is not null and public.is_class_teacher(class_id)))
  );
create policy "Edit own decks" on public.flashcard_decks
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (not shared or (class_id is not null and public.is_class_teacher(class_id)))
  );
create policy "Delete own decks" on public.flashcard_decks
  for delete to authenticated using (owner_id = (select auth.uid()));

-- flashcards
create policy "Read cards in visible decks" on public.flashcards
  for select to authenticated using (public.can_see_deck(deck_id));
create policy "Deck owners manage cards" on public.flashcards
  for all to authenticated
  using (exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.owner_id = (select auth.uid())));

-- flashcard_reviews
create policy "Own reviews" on public.flashcard_reviews
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.flashcards c where c.id = card_id and public.can_see_deck(c.deck_id))
  );

-- ai_conversations: private, but class teachers can review for safety
create policy "Owners and class teachers read chats" on public.ai_conversations
  for select to authenticated using (public.can_review_conversation(id));
create policy "Start own chats" on public.ai_conversations
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (class_id is null or public.is_class_member(class_id)));
create policy "Rename own chats" on public.ai_conversations
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Delete own chats" on public.ai_conversations
  for delete to authenticated using (user_id = (select auth.uid()));

-- ai_messages
create policy "Read messages in reviewable chats" on public.ai_messages
  for select to authenticated using (public.can_review_conversation(conversation_id));
create policy "Students write their own questions" on public.ai_messages
  for insert to authenticated
  with check (role = 'user' and public.owns_conversation(conversation_id));

-- ── RPCs ────────────────────────────────────────────────────────────────────

-- Join a class with its six character code. A student's first class sets
-- their school; codes from another school are rejected.
create function public.join_class(code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  target public.classes%rowtype;
  me uuid := (select auth.uid());
  my_school uuid;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;

  select * into target from public.classes c where c.join_code = upper(trim(code));
  if not found then
    raise exception 'No class has that code' using errcode = 'P0002';
  end if;

  select p.school_id into my_school from public.profiles p where p.id = me;
  if my_school is null then
    update public.profiles set school_id = target.school_id where id = me;
  elsif my_school <> target.school_id then
    raise exception 'That class belongs to another school' using errcode = '42501';
  end if;

  insert into public.class_members (class_id, user_id, role)
  values (target.id, me, 'student')
  on conflict do nothing;

  return target.id;
end;
$$;

-- Spend points. Locks per student so two taps cannot double spend.
create function public.redeem_reward(target_reward uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  reward public.rewards%rowtype;
  available bigint;
  redemption uuid;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;

  select * into reward from public.rewards r
  where r.id = target_reward and r.active and r.school_id = public.my_school_id();
  if not found then
    raise exception 'Reward not available' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));
  select coalesce(sum(delta), 0) into available from public.points_ledger where student_id = me;
  if available < reward.cost then
    raise exception 'Not enough points' using errcode = 'P0001';
  end if;

  insert into public.redemptions (reward_id, student_id, status)
  values (reward.id, me, case when reward.needs_teacher then 'requested' else 'unlocked' end)
  returning id into redemption;

  insert into public.points_ledger (student_id, delta, reason, redemption_id)
  values (me, -reward.cost, reward.title, redemption);

  return redemption;
end;
$$;

-- Class leaderboard: points earned in this class. Students who opted out
-- appear as "Hidden student" to everyone but themselves.
create function public.class_leaderboard(target_class uuid)
returns table (rank bigint, display_name text, points bigint, is_me boolean)
language sql stable security definer set search_path = ''
as $$
  with totals as (
    select m.user_id, coalesce(sum(l.delta) filter (where l.submission_id is not null), 0) as points
    from public.class_members m
    left join public.points_ledger l on l.student_id = m.user_id and l.class_id = m.class_id
    where m.class_id = target_class and m.role = 'student'
    group by m.user_id
  )
  select
    rank() over (order by t.points desc),
    case
      when t.user_id = (select auth.uid()) or p.show_on_leaderboard then p.full_name
      else 'Hidden student'
    end,
    t.points,
    t.user_id = (select auth.uid())
  from totals t
  join public.profiles p on p.id = t.user_id
  where public.is_class_member(target_class)
  order by 1, 2
$$;

-- School leaderboard: anonymised by default, only your own row has a name.
create function public.school_leaderboard()
returns table (rank bigint, display_name text, year_group text, points bigint, is_me boolean)
language sql stable security definer set search_path = ''
as $$
  with totals as (
    select p.id, p.full_name, p.year_group, coalesce(sum(l.delta) filter (where l.submission_id is not null), 0) as points
    from public.profiles p
    left join public.points_ledger l on l.student_id = p.id
    where p.school_id = public.my_school_id() and p.role = 'student'
    group by p.id
  )
  select
    rank() over (order by t.points desc),
    case when t.id = (select auth.uid()) then t.full_name else 'Student' end,
    t.year_group,
    t.points,
    t.id = (select auth.uid())
  from totals t
  order by 1
  limit 50
$$;

-- Functions are for signed-in users only.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.my_school_id(),
  public.my_role(),
  public.is_class_member(uuid),
  public.is_class_teacher(uuid),
  public.shares_class_with(uuid),
  public.can_see_thread(uuid),
  public.can_see_deck(uuid),
  public.task_class_teacher(uuid),
  public.can_see_task(uuid),
  public.owns_conversation(uuid),
  public.can_review_conversation(uuid),
  public.join_class(text),
  public.redeem_reward(uuid),
  public.class_leaderboard(uuid),
  public.school_leaderboard()
to authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────────
-- Discussion replies should reach other devices within seconds (spec: under
-- 10 s). RLS still applies to realtime subscribers.
alter publication supabase_realtime add table public.posts, public.threads;
