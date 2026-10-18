-- Files and links on tasks.
--
-- Teachers attach resources to class work (worksheets, slides, links) and
-- students attach the work they hand in, so the teacher can look at it before
-- verifying. Files live in the private task-files bucket. A row here is what
-- grants access to its file, so storage follows the same rules as the table.

create type public.attachment_kind as enum ('file', 'link');

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  -- Null: a resource for everyone on the task. Set: work this student handed
  -- in, which only they and the class teachers can see.
  student_id uuid references public.profiles (id) on delete cascade,
  kind public.attachment_kind not null,
  title text not null check (char_length(title) between 1 and 200),
  url text check (url ~* '^https?://' and char_length(url) <= 2000),
  storage_path text unique,
  mime_type text check (char_length(mime_type) <= 200),
  size_bytes integer check (size_bytes between 0 and 10485760),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint task_attachments_shape check (
    (kind = 'link' and url is not null and storage_path is null)
    or (kind = 'file' and url is null and storage_path like (task_id::text || '/%'))
  )
);
create index task_attachments_task_idx on public.task_attachments (task_id);
create index task_attachments_student_idx on public.task_attachments (student_id);
create index task_attachments_created_by_idx on public.task_attachments (created_by);

create function private.owns_task(target_task uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = target_task and t.owner_id = (select auth.uid())
  )
$$;

-- True once the signed-in student's work on this task has been verified.
create function private.work_verified(target_task uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.task_submissions s
    where s.task_id = target_task and s.student_id = (select auth.uid()) and s.status = 'verified'
  )
$$;

revoke execute on function private.owns_task(uuid), private.work_verified(uuid) from public, anon;
grant execute on function private.owns_task(uuid), private.work_verified(uuid) to authenticated;

alter table public.task_attachments enable row level security;
revoke all on public.task_attachments from anon;
revoke update on public.task_attachments from authenticated;

create policy "See resources on your tasks, and your own work" on public.task_attachments
  for select to authenticated
  using (
    (student_id is null and private.can_see_task(task_id))
    or student_id = (select auth.uid())
    or private.task_class_teacher(task_id)
  );

create policy "Teachers share resources, students attach their work" on public.task_attachments
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      -- Resources: the class teachers, or the owner of a personal reminder.
      (student_id is null and (private.task_class_teacher(task_id) or private.owns_task(task_id)))
      -- Work: your own, on class work you can see, until it is verified.
      or (
        student_id = (select auth.uid())
        and private.can_see_task(task_id)
        and not private.task_class_teacher(task_id)
        and not private.work_verified(task_id)
      )
    )
  );

create policy "Remove what you attached" on public.task_attachments
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    -- Verified work stays as the record of what the teacher checked.
    and (student_id is null or not private.work_verified(task_id))
  );

-- Work a teacher returned can be handed in again, and only back to "submitted".
create policy "Students hand returned work back in" on public.task_submissions
  for update to authenticated
  using (student_id = (select auth.uid()) and status = 'returned')
  with check (student_id = (select auth.uid()) and status = 'submitted');

create or replace function public.stamp_verification()
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
  -- Handing returned work back in counts as a new hand-in.
  if new.status = 'submitted' and old.status = 'returned' then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

-- Storage: a private bucket, 10 MB per file, everyday school formats only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-files',
  'task-files',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.presentation',
    'application/vnd.oasis.opendocument.spreadsheet',
    'audio/mpeg', 'audio/mp4', 'video/mp4'
  ]
)
on conflict (id) do nothing;

-- The attachment row is the permission: these subqueries run under the
-- table's own row level security above.
create policy "Open files on attachments you can see" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-files'
    and exists (select 1 from public.task_attachments a where a.storage_path = objects.name)
  );

create policy "Upload the file for your own attachment" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-files'
    and exists (
      select 1 from public.task_attachments a
      where a.storage_path = objects.name and a.created_by = (select auth.uid())
    )
  );

create policy "Delete files you attached" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-files'
    and exists (
      select 1 from public.task_attachments a
      where a.storage_path = objects.name and a.created_by = (select auth.uid())
    )
  );
