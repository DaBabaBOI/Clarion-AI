-- Move the row level security helpers out of the API schema.
--
-- Policies need these functions, but students should not be able to call
-- them directly through /rest/v1/rpc. Functions in a schema PostgREST does
-- not expose stay usable from policies and invisible to the API. Policies
-- reference functions by id, so they keep working after the move; function
-- bodies reference them by name, so those are recreated below.

create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.my_school_id() set schema private;
alter function public.my_role() set schema private;
alter function public.is_class_member(uuid) set schema private;
alter function public.is_class_teacher(uuid) set schema private;
alter function public.shares_class_with(uuid) set schema private;
alter function public.can_see_thread(uuid) set schema private;
alter function public.can_see_deck(uuid) set schema private;
alter function public.task_class_teacher(uuid) set schema private;
alter function public.can_see_task(uuid) set schema private;
alter function public.owns_conversation(uuid) set schema private;
alter function public.can_review_conversation(uuid) set schema private;

create or replace function private.can_see_thread(target_thread uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.threads t
    where t.id = target_thread
      and private.is_class_member(t.class_id)
      and (
        t.visibility = 'public'
        or t.author_id = (select auth.uid())
        or private.is_class_teacher(t.class_id)
      )
  )
$$;

create or replace function private.can_see_deck(target_deck uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.flashcard_decks d
    where d.id = target_deck
      and (
        d.owner_id = (select auth.uid())
        or (d.shared and d.class_id is not null and private.is_class_member(d.class_id))
      )
  )
$$;

create or replace function private.task_class_teacher(target_task uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = target_task and t.class_id is not null and private.is_class_teacher(t.class_id)
  )
$$;

create or replace function private.can_see_task(target_task uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = target_task
      and (
        t.owner_id = (select auth.uid())
        or (t.class_id is not null and private.is_class_member(t.class_id))
      )
  )
$$;

create or replace function private.can_review_conversation(target_conversation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.ai_conversations c
    where c.id = target_conversation
      and (
        c.user_id = (select auth.uid())
        or (c.class_id is not null and private.is_class_teacher(c.class_id))
      )
  )
$$;

-- The public RPCs that used the helpers by name.

create or replace function public.redeem_reward(target_reward uuid)
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
  where r.id = target_reward and r.active and r.school_id = private.my_school_id();
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

create or replace function public.class_leaderboard(target_class uuid)
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
  where private.is_class_member(target_class)
  order by 1, 2
$$;

create or replace function public.school_leaderboard()
returns table (rank bigint, display_name text, year_group text, points bigint, is_me boolean)
language sql stable security definer set search_path = ''
as $$
  with totals as (
    select p.id, p.full_name, p.year_group, coalesce(sum(l.delta) filter (where l.submission_id is not null), 0) as points
    from public.profiles p
    left join public.points_ledger l on l.student_id = p.id
    where p.school_id = private.my_school_id() and p.role = 'student'
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

-- Trigger functions only ever run as triggers.
revoke execute on function
  public.handle_new_user(),
  public.add_class_creator(),
  public.stamp_verification(),
  public.pay_out_verified_submission(),
  public.refund_declined_redemption(),
  public.touch_thread()
from public, anon, authenticated;
