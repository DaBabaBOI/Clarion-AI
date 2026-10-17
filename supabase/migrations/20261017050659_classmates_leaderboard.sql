-- Leaderboard of everyone who shares a class with the caller, by task points
-- earned across all classes. Students who opted out appear as "Hidden student"
-- to everyone but themselves.
create function public.classmates_leaderboard()
returns table (rank bigint, display_name text, points bigint, is_me boolean)
language sql stable security definer set search_path = ''
as $$
  with mates as (
    select distinct theirs.user_id
    from public.class_members mine
    join public.class_members theirs on theirs.class_id = mine.class_id and theirs.role = 'student'
    where mine.user_id = (select auth.uid())
  ),
  totals as (
    select m.user_id, coalesce(sum(l.delta) filter (where l.submission_id is not null), 0) as points
    from mates m
    left join public.points_ledger l on l.student_id = m.user_id
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
  order by 1, 2
  limit 50
$$;

revoke execute on function public.classmates_leaderboard() from public, anon;
grant execute on function public.classmates_leaderboard() to authenticated;
