-- Coordinators (admins) see every class in their school at a glance. It
-- returns counts only, never names or work, so it opens no one's data.
create function public.school_overview()
returns table (
  class_id uuid,
  name text,
  color public.class_color,
  teachers text,
  students bigint,
  due_this_week bigint,
  waiting bigint,
  oldest_waiting timestamptz,
  missing bigint,
  verified_this_week bigint,
  is_member boolean
)
language sql stable security definer set search_path = ''
as $$
  select
    c.id,
    c.name,
    c.color,
    coalesce((
      select string_agg(p.full_name, ', ' order by p.full_name)
      from public.class_members m join public.profiles p on p.id = m.user_id
      where m.class_id = c.id and m.role = 'teacher'
    ), ''),
    (select count(*) from public.class_members m where m.class_id = c.id and m.role = 'student'),
    (
      select count(*) from public.tasks t
      where t.class_id = c.id
        and t.due_on between date_trunc('week', current_date)::date and date_trunc('week', current_date)::date + 6
    ),
    (
      select count(*) from public.task_submissions s join public.tasks t on t.id = s.task_id
      where t.class_id = c.id and s.status = 'submitted'
    ),
    (
      select min(s.submitted_at) from public.task_submissions s join public.tasks t on t.id = s.task_id
      where t.class_id = c.id and s.status = 'submitted'
    ),
    -- Work due in the last two weeks that a student has not handed in (or had returned).
    (
      select count(*) from public.tasks t
      join public.class_members m on m.class_id = t.class_id and m.role = 'student'
      where t.class_id = c.id and t.due_on >= current_date - 14 and t.due_on < current_date
        and not exists (
          select 1 from public.task_submissions s
          where s.task_id = t.id and s.student_id = m.user_id and s.status in ('submitted', 'verified')
        )
    ),
    (
      select count(*) from public.task_submissions s join public.tasks t on t.id = s.task_id
      where t.class_id = c.id and s.status = 'verified' and s.verified_at >= date_trunc('week', current_date)
    ),
    private.is_class_member(c.id)
  from public.classes c
  where c.school_id = private.my_school_id() and private.my_role() = 'admin'
  order by c.name
$$;

revoke execute on function public.school_overview() from public, anon;
grant execute on function public.school_overview() to authenticated;
