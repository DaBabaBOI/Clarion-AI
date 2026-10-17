-- Test school content for the two test accounts:
--   prithu1606@gmail.com          principal (admin) and teacher of every class
--   prithu1606+student@gmail.com  student in every class
-- Create those accounts first (Supabase dashboard → Authentication → Add user),
-- then run this once in the SQL editor. Dates are relative to today (India time),
-- so "Overdue", "Today" and the streak read correctly whenever it is run.

create or replace function pg_temp.school_day(base date, n int)
returns date
language plpgsql
as $f$
declare
  d date := base;
  remaining int := abs(n);
  step int := sign(n);
begin
  while remaining > 0 loop
    d := d + step;
    if extract(isodow from d) < 6 then
      remaining := remaining - 1;
    end if;
  end loop;
  return d;
end
$f$;

do $$
declare
  principal uuid := (select id from auth.users where email = 'prithu1606@gmail.com');
  student uuid := (select id from auth.users where email = 'prithu1606+student@gmail.com');
  today date := (now() at time zone 'Asia/Kolkata')::date;
  test_day text;
  school uuid;
  bio uuid;
  maths uuid;
  eng uuid;
  his uuid;
  t uuid;
  s uuid;
  th uuid;
  d uuid;
  due date;
  rec record;
begin
  if principal is null or student is null then
    raise exception 'Create the two test accounts first';
  end if;
  if exists (select 1 from public.schools where name = 'Clarion Test School') then
    raise notice 'Clarion Test School already exists, nothing to do';
    return;
  end if;

  test_day := to_char(pg_temp.school_day(today, 3), 'FMDay');

  -- School, people and classes
  insert into public.schools (name) values ('Clarion Test School') returning id into school;
  update public.profiles set school_id = school, role = 'admin', full_name = 'Prithu Sharma' where id = principal;
  update public.profiles set school_id = school, role = 'student', full_name = 'Test Student', year_group = 'Year 9' where id = student;

  insert into public.classes (school_id, name, color, join_code) values (school, 'Biology 9', 'mint', '7K2H9B') returning id into bio;
  insert into public.classes (school_id, name, color, join_code) values (school, 'Maths 9', 'sky', 'M9X4QT') returning id into maths;
  insert into public.classes (school_id, name, color, join_code) values (school, 'English 9', 'brand', 'E9R2WK') returning id into eng;
  insert into public.classes (school_id, name, color, join_code) values (school, 'History 9', 'amber', 'H9P7LN') returning id into his;

  insert into public.class_members (class_id, user_id, role)
  select c, principal, 'teacher'::public.user_role from unnest(array[bio, maths, eng, his]) as c
  union all
  select c, student, 'student'::public.user_role from unnest(array[bio, maths, eng, his]) as c;

  -- Work the teacher already verified: four school days in a row (a 4 day
  -- streak) plus older tasks, 240 points in total.
  for rec in
    select * from (values
      (1, 10, 'Algebra warm-up', 'maths'),
      (2, 15, 'Primary source annotations', 'his'),
      (3, 5, 'Lab safety form', 'bio'),
      (4, 10, 'Microscope drawing', 'bio'),
      (6, 40, 'Persuasive paragraph', 'eng'),
      (8, 50, 'Fractions review', 'maths'),
      (11, 35, 'Timeline poster', 'his'),
      (13, 45, 'Plant cell model', 'bio'),
      (16, 30, 'Reading log, week 1', 'eng')
    ) as v(days_back, pts, title, cls)
  loop
    due := pg_temp.school_day(today, -rec.days_back);
    insert into public.tasks (class_id, title, set_on, due_on, points, created_by)
    values (
      case rec.cls when 'bio' then bio when 'maths' then maths when 'eng' then eng else his end,
      rec.title, due - 5, due, rec.pts, principal
    )
    returning id into t;

    insert into public.task_submissions (task_id, student_id, status, submitted_at, verified_at, verified_by)
    values (
      t, student, 'verified',
      ((due - 1)::timestamp + interval '18 hours') at time zone 'Asia/Kolkata',
      (due::timestamp + interval '16 hours') at time zone 'Asia/Kolkata',
      principal
    )
    returning id into s;

    insert into public.points_ledger (student_id, class_id, delta, reason, submission_id, created_at)
    values (
      student,
      case rec.cls when 'bio' then bio when 'maths' then maths when 'eng' then eng else his end,
      rec.pts, rec.title, s,
      (due::timestamp + interval '16 hours') at time zone 'Asia/Kolkata'
    );
  end loop;

  -- Current work
  insert into public.tasks (class_id, title, set_on, due_on, points, created_by) values
    (bio, 'Cell structure worksheet', today - 5, today - 1, 20, principal),
    (bio, 'Read pages 3 to 6 and self check', today - 1, today, 10, principal),
    (bio, 'Photosynthesis revision notes', today - 1, today + 2, 15, principal),
    (maths, 'Quadratics problem set', today - 3, today + 1, 20, principal),
    (maths, 'Completing the square practice', today - 1, today + 5, 15, principal),
    (eng, 'Essay first draft', today - 6, today + 2, 25, principal);

  insert into public.tasks (class_id, title, set_on, due_on, points, created_by)
  values (his, 'Unit 2 source list', today - 9, today - 2, 10, principal)
  returning id into t;
  -- Handed in yesterday, waiting for the teacher to verify.
  insert into public.task_submissions (task_id, student_id, status, submitted_at)
  values (t, student, 'submitted', now() - interval '26 hours');

  -- A personal reminder (never carries points).
  insert into public.tasks (owner_id, title, set_on, due_on, created_by)
  values (student, 'Pack PE kit', today, today + 1, student);

  -- Discussions
  insert into public.threads (class_id, author_id, title, visibility, pinned, created_at)
  values (bio, principal, 'Q and A, Biology 9', 'public', true, now() - interval '3 days')
  returning id into th;
  insert into public.posts (thread_id, author_id, body, created_at) values
    (th, principal, 'Reminder: the ' || test_day || ' test covers cell structure and photosynthesis only. You do not need the light dependent reactions in detail.', now() - interval '10 minutes'),
    (th, student, 'Do we need to memorise the full equation, or is the word equation enough?', now() - interval '8 minutes'),
    (th, principal, 'The word equation is enough for this test. The balanced version comes in unit 4.', now() - interval '5 minutes');
  insert into public.thread_reads (thread_id, user_id, last_read_at) values (th, principal, now());

  insert into public.threads (class_id, author_id, title, visibility, created_at)
  values (maths, student, 'Quadratics help', 'public', now() - interval '40 minutes')
  returning id into th;
  insert into public.posts (thread_id, author_id, body, created_at) values
    (th, student, 'Can someone explain completing the square? I get stuck after halving the x coefficient.', now() - interval '40 minutes');
  insert into public.thread_reads (thread_id, user_id, last_read_at) values (th, student, now());

  insert into public.threads (class_id, author_id, title, visibility, created_at)
  values (eng, principal, 'Essay drafts', 'public', now() - interval '2 hours')
  returning id into th;
  insert into public.posts (thread_id, author_id, body, created_at) values
    (th, principal, 'I have posted feedback on the first drafts. Read the comments before you start the second draft.', now() - interval '2 hours');
  insert into public.thread_reads (thread_id, user_id, last_read_at) values (th, principal, now()), (th, student, now());

  insert into public.threads (class_id, author_id, title, visibility, pinned, created_at)
  values (his, principal, 'Unit 2 sources', 'public', true, now() - interval '1 day')
  returning id into th;
  insert into public.posts (thread_id, author_id, body, created_at) values
    (th, principal, 'Pinned: primary source list for the essay. Use at least three of these.', now() - interval '1 day');
  insert into public.thread_reads (thread_id, user_id, last_read_at) values (th, principal, now()), (th, student, now());

  insert into public.threads (class_id, author_id, title, visibility, created_at)
  values (bio, student, 'Worksheet extension', 'direct', now() - interval '50 hours')
  returning id into th;
  insert into public.posts (thread_id, author_id, body, created_at) values
    (th, student, 'Could I have one more day for the cell structure worksheet? I was out for the match.', now() - interval '50 hours'),
    (th, principal, 'Yes, hand it in as soon as you can. It still counts.', now() - interval '48 hours');
  insert into public.thread_reads (thread_id, user_id, last_read_at) values (th, principal, now()), (th, student, now());

  -- Flashcards shared with each class, plus the student's progress
  for rec in
    select * from (values
      ('bio', 'Photosynthesis', 5, '[
        ["Where does photosynthesis happen?", "In the chloroplasts, mostly in the leaf cells of a plant."],
        ["What is the word equation for photosynthesis?", "Carbon dioxide + water → glucose + oxygen, using light energy."],
        ["Which pigment absorbs the light?", "Chlorophyll."],
        ["What are the two raw materials?", "Carbon dioxide and water."],
        ["How does carbon dioxide get into the leaf?", "By diffusion through the stomata."],
        ["Name one limiting factor.", "Light intensity, carbon dioxide concentration or temperature."],
        ["What happens to the oxygen made?", "It is used in respiration or diffuses out of the leaf."],
        ["Give two uses of the glucose a plant makes.", "Respiration, and making starch for storage or cellulose for cell walls."]
      ]'),
      ('bio', 'Cell structure', 6, '[
        ["What does the nucleus do?", "It holds the genetic material and controls the cell''s activities."],
        ["Where does aerobic respiration happen?", "In the mitochondria."],
        ["What do ribosomes do?", "They make proteins."],
        ["Name three structures found only in plant cells.", "Cell wall, chloroplasts and a permanent vacuole."],
        ["What does the cell membrane do?", "It controls what enters and leaves the cell."],
        ["What is a plant cell wall made of?", "Cellulose."]
      ]'),
      ('bio', 'Enzymes', 0, '[
        ["What is an enzyme?", "A biological catalyst, usually a protein, that speeds up reactions."],
        ["What is the active site?", "The part of the enzyme where the substrate binds."],
        ["What does denatured mean?", "The active site has changed shape, so the substrate no longer fits."],
        ["Which enzyme breaks down starch?", "Amylase."],
        ["Name two factors that affect enzyme activity.", "Temperature and pH."]
      ]'),
      ('maths', 'Quadratics', 2, '[
        ["What is the standard form of a quadratic equation?", "ax² + bx + c = 0, where a is not 0."],
        ["State the quadratic formula.", "x = (−b ± √(b² − 4ac)) / 2a"],
        ["Factorise x² + 5x + 6.", "(x + 2)(x + 3)"],
        ["What does the discriminant b² − 4ac tell you?", "Positive: two real roots. Zero: one repeated root. Negative: no real roots."],
        ["Complete the square for x² + 6x.", "(x + 3)² − 9"],
        ["Solve x² = 49.", "x = 7 or x = −7"]
      ]'),
      ('his', 'Source skills', 0, '[
        ["What is a primary source?", "A source created at the time of the event being studied."],
        ["What is a secondary source?", "A later interpretation or analysis of the event."],
        ["What does provenance mean?", "Who made a source, when, where and why."],
        ["What is corroboration?", "Checking a source against other sources to test how reliable it is."],
        ["Why might a source be biased?", "Its author may favour one side because of their views, job or audience."]
      ]')
    ) as v(cls, title, reviewed, cards)
  loop
    insert into public.flashcard_decks (class_id, owner_id, title, shared)
    values (case rec.cls when 'bio' then bio when 'maths' then maths else his end, principal, rec.title, true)
    returning id into d;

    insert into public.flashcards (deck_id, front, back, position)
    select d, c.value ->> 0, c.value ->> 1, (c.ordinality - 1)::int
    from jsonb_array_elements(rec.cards::jsonb) with ordinality as c;

    insert into public.flashcard_reviews (card_id, user_id, result)
    select f.id, student, 'good'
    from public.flashcards f
    where f.deck_id = d and f.position < rec.reviewed;
  end loop;

  -- Rewards
  insert into public.rewards (school_id, title, cost, needs_teacher) values
    (school, 'Choose the next class game', 80, true),
    (school, 'Homework pass, one task', 150, true),
    (school, 'Custom theme unlock', 300, false);
end
$$;
