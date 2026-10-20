-- Clarion International School, lightly filled: the first days of a fresh start.
--
-- Run it in one go in the SQL editor. It first clears everything that has
-- happened in the school (as clarion_international_clear.sql does), then adds
-- a little activity, dated relative to today:
--
--   17 pieces of work   two or three per class: one due yesterday (most of the
--                       class handed it in and most of that is verified), one
--                       due later this week, and a few set today
--   points              for the verified work, so leaderboards have a start
--   8 discussions       one per class, some with a student question waiting
--   8 flashcard decks   one shared deck per class
--
-- The accounts, classes and rewards are left as they are.
-- Its scratch tables are temporary and have row level security on too, so
-- the SQL editor runs it without a warning.

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

-- A stable number in [0, 1) so the same run always gives the same school.
create or replace function pg_temp.chance(key text)
returns float8
language sql immutable
as $f$ select ((hashtext(key)::bigint & 2147483647) % 1000) / 1000.0 $f$;

-- ── Work ────────────────────────────────────────────────────────────────────

-- set_day and due_day are school days from today (negative is the past, 0 is today).
create temp table fresh_tasks (class_name text, title text, set_day int, due_day int, points int, details text, link_title text, link_url text);
alter table fresh_tasks enable row level security;
insert into fresh_tasks values
  ('Biology 9', 'Cell structure worksheet', -4, -1, 20,
   E'Label the animal and plant cell diagrams on the worksheet, then answer questions 1 to 8.\nUse full sentences for questions 6 to 8.\nHand in a photo or scan of both pages.',
   'Cell (biology), Wikipedia', 'https://en.wikipedia.org/wiki/Cell_(biology)'),
  ('Biology 9', 'Photosynthesis revision notes', -1, 2, 15,
   E'Make one page of revision notes covering:\n- the word and symbol equations\n- where photosynthesis happens in the leaf\n- the three limiting factors',
   'Photosynthesis, Wikipedia', 'https://en.wikipedia.org/wiki/Photosynthesis'),
  ('Biology 9', 'Enzymes practice questions', 0, 5, 15,
   'Answer questions 1 to 6 on enzymes. For question 6, sketch the graph of rate against temperature and explain its shape.',
   'Enzyme, Wikipedia', 'https://en.wikipedia.org/wiki/Enzyme'),

  ('Maths 9', 'Quadratics problem set', -4, -1, 20,
   E'Questions 1 to 12 from the problem set. Show your working for every question.\nQuestions 10 to 12 are stretch questions: try at least one.',
   'Quadratic equation, Wikipedia', 'https://en.wikipedia.org/wiki/Quadratic_equation'),
  ('Maths 9', 'Completing the square practice', -1, 3, 15,
   E'Exercise 4C, odd numbers from 1 to 15.\nCheck each answer by expanding the brackets back out.',
   'Completing the square, Wikipedia', 'https://en.wikipedia.org/wiki/Completing_the_square'),

  ('English 9', 'Reading log, week 1', -4, 0, 10,
   'Fill in this week''s reading log: pages read each day and two sentences on what changed in the story.', null, null),
  ('English 9', 'Essay first draft', -2, 4, 25,
   E'Write the first draft of your persuasive essay on the topic we chose in class.\nAim for 800 to 1,000 words: an introduction with a clear thesis, three body paragraphs with evidence, and a conclusion.',
   'Thesis statement tips, Purdue OWL', 'https://owl.purdue.edu/owl/general_writing/the_writing_process/thesis_statement_tips.html'),

  ('History 9', 'Primary source annotations', -4, -1, 15,
   'Annotate the two primary sources from the lesson: who made it, when, why, and what it tells us.', null, null),
  ('History 9', 'Industrial Revolution essay plan', -1, 4, 20,
   'Plan an essay on the main causes of the Industrial Revolution in Britain: a thesis, three causes with evidence, and a judgement on which mattered most.',
   'Industrial Revolution, Wikipedia', 'https://en.wikipedia.org/wiki/Industrial_Revolution'),

  ('Biology 10', 'Enzyme practical write-up', -4, -1, 20,
   'Write up the enzyme practical: method, results table, graph of rate against temperature, and a conclusion that explains the shape of the graph using the words active site and denatured.',
   'Enzyme, Wikipedia', 'https://en.wikipedia.org/wiki/Enzyme'),
  ('Biology 10', 'Inheritance problem sheet', -1, 3, 15,
   'Questions 1 to 10 on the inheritance sheet. Draw a Punnett square for every cross.',
   'Mendelian inheritance, Wikipedia', 'https://en.wikipedia.org/wiki/Mendelian_inheritance'),

  ('Maths 10', 'Trigonometry basics', -4, -1, 20,
   'Questions 1 to 15 on SOH CAH TOA. Draw and label the triangle for every question.',
   'Trigonometry, Wikipedia', 'https://en.wikipedia.org/wiki/Trigonometry'),
  ('Maths 10', 'Sine rule practice', -1, 3, 15,
   'Exercise 9A, questions 1 to 10. Round answers to 3 significant figures.',
   'Law of sines, Wikipedia', 'https://en.wikipedia.org/wiki/Law_of_sines'),

  ('English 10', 'Macbeth act 1 summary', -4, -1, 15,
   'Summarise each scene of act 1 in three sentences, and pick one key quotation per scene.',
   'Macbeth, Wikipedia', 'https://en.wikipedia.org/wiki/Macbeth'),
  ('English 10', 'Act 2 quotations', 0, 4, 10,
   'Choose eight quotations from act 2 and explain what each one shows about a character or a theme.', null, null),

  ('History 10', 'Cold War key terms', -4, -1, 10,
   'Learn the 12 Cold War key terms on the sheet and write a one-line definition of each.',
   'Cold War, Wikipedia', 'https://en.wikipedia.org/wiki/Cold_War'),
  ('History 10', 'Cuban Missile Crisis timeline', -1, 3, 15,
   'Make a day-by-day timeline of the thirteen days in October 1962 with one sentence on each turning point.',
   'Cuban Missile Crisis, Wikipedia', 'https://en.wikipedia.org/wiki/Cuban_Missile_Crisis');

-- ── Discussions and flashcards ──────────────────────────────────────────────

create temp table fresh_threads (key text primary key, class_name text, author text, title text, pinned boolean);
alter table fresh_threads enable row level security;
insert into fresh_threads values
  ('bio9', 'Biology 9', 'prithu1606+kaushal@gmail.com', 'Q and A, Biology 9', true),
  ('maths9', 'Maths 9', 'prithu1606+aarav@gmail.com', 'Quadratics help', false),
  ('eng9', 'English 9', 'prithu1606+coordinator@gmail.com', 'Essay drafts', true),
  ('his9', 'History 9', 'prithu1606+banerjee@gmail.com', 'Finding good sources', true),
  ('bio10', 'Biology 10', 'prithu1606+riya@gmail.com', 'Enzyme practical', false),
  ('maths10', 'Maths 10', 'prithu1606+khan@gmail.com', 'Trigonometry formula sheet', true),
  ('eng10', 'English 10', 'prithu1606+mathew@gmail.com', 'Macbeth act 2', false),
  ('his10', 'History 10', 'prithu1606+sameer@gmail.com', 'Cold War revision', false);

create temp table fresh_posts (thread_key text, author text, body text, minutes_ago int);
alter table fresh_posts enable row level security;
insert into fresh_posts values
  ('bio9', 'prithu1606+kaushal@gmail.com', 'Welcome back! Post questions about this unit here. Next week''s test covers cell structure and photosynthesis.', 2900),
  ('bio9', 'prithu1606+ananya@gmail.com', 'Do we need to memorise the full equation, or is the word equation enough?', 300),
  ('bio9', 'prithu1606+kaushal@gmail.com', 'The word equation is enough for this test. The balanced version comes in unit 4.', 240),
  ('maths9', 'prithu1606+aarav@gmail.com', 'Can someone explain completing the square?', 600),
  ('maths9', 'prithu1606+iyer@gmail.com', 'Halve the x coefficient, square it, then add and subtract it. There is a worked example at the start of tomorrow''s lesson.', 540),
  ('eng9', 'prithu1606+coordinator@gmail.com', 'First drafts are due next week. Attach your draft on the task page, as a file or a Google Docs link.', 1600),
  ('eng9', 'prithu1606+kabir@gmail.com', 'Can we use quotes from the article we read in class as evidence?', 45),
  ('his9', 'prithu1606+banerjee@gmail.com', 'Use at least three of the primary sources from the library list in your essay plan.', 4300),
  ('his9', 'prithu1606+zara@gmail.com', 'Does a museum website count as a primary source?', 30),
  ('bio10', 'prithu1606+riya@gmail.com', 'For the graph, should temperature go on the x axis even though we only tested five temperatures?', 180),
  ('maths10', 'prithu1606+khan@gmail.com', 'The formula sheet in the unit booklet is the same one you get in the exam. Learn where everything is on it.', 3000),
  ('eng10', 'prithu1606+mathew@gmail.com', 'We start act 2 on Monday. Read scene 1 before the lesson.', 900),
  ('eng10', 'prithu1606+neel@gmail.com', 'Is the dagger speech in scene 1 or scene 2?', 50),
  ('his10', 'prithu1606+sameer@gmail.com', 'Will the Berlin Airlift be in the end of unit test?', 400),
  ('his10', 'prithu1606+banerjee@gmail.com', 'Yes, there is one source question on it.', 380);

create temp table fresh_cards (class_name text, deck text, front text, back text, position int);
alter table fresh_cards enable row level security;
insert into fresh_cards values
  ('Biology 9', 'Cell structure', 'What does the nucleus do?', 'It holds the genetic material and controls the cell''s activities.', 1),
  ('Biology 9', 'Cell structure', 'Where does aerobic respiration happen?', 'In the mitochondria.', 2),
  ('Biology 9', 'Cell structure', 'What do ribosomes do?', 'They make proteins.', 3),
  ('Biology 9', 'Cell structure', 'Name three structures found only in plant cells.', 'Cell wall, chloroplasts and a permanent vacuole.', 4),
  ('Maths 9', 'Quadratics', 'State the quadratic formula.', 'x = (−b ± √(b² − 4ac)) / 2a', 1),
  ('Maths 9', 'Quadratics', 'Factorise x² + 5x + 6.', '(x + 2)(x + 3)', 2),
  ('Maths 9', 'Quadratics', 'Complete the square for x² + 6x.', '(x + 3)² − 9', 3),
  ('English 9', 'Persuasive techniques', 'What is a rhetorical question?', 'A question asked for effect, where no answer is expected.', 1),
  ('English 9', 'Persuasive techniques', 'What is the rule of three?', 'Grouping ideas in threes so they are memorable and sound complete.', 2),
  ('English 9', 'Persuasive techniques', 'What is a counter-argument?', 'An opposing view you raise and then answer, to make your own case stronger.', 3),
  ('History 9', 'Source skills', 'What is a primary source?', 'A source created at the time of the event being studied.', 1),
  ('History 9', 'Source skills', 'What does provenance mean?', 'Who made a source, when, where and why.', 2),
  ('History 9', 'Source skills', 'What is corroboration?', 'Checking a source against other sources to test how reliable it is.', 3),
  ('Biology 10', 'Enzymes', 'What is the active site?', 'The part of the enzyme where the substrate binds.', 1),
  ('Biology 10', 'Enzymes', 'What does denatured mean?', 'The active site has changed shape, so the substrate no longer fits.', 2),
  ('Biology 10', 'Enzymes', 'Which enzyme breaks down starch?', 'Amylase.', 3),
  ('Maths 10', 'Trigonometry', 'What does SOH CAH TOA stand for?', 'Sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent.', 1),
  ('Maths 10', 'Trigonometry', 'State the sine rule.', 'a / sin A = b / sin B = c / sin C', 2),
  ('English 10', 'Macbeth act 1', 'Who are the first characters on stage?', 'The three witches.', 1),
  ('English 10', 'Macbeth act 1', 'What title does Macbeth gain in act 1?', 'Thane of Cawdor.', 2),
  ('History 10', 'Cold War key terms', 'What was the Truman Doctrine?', 'The US promise to help countries resist communism (1947).', 1),
  ('History 10', 'Cold War key terms', 'What was the Marshall Plan?', 'US economic aid to rebuild Europe after the Second World War.', 2);

-- ── Fill the school ─────────────────────────────────────────────────────────

do $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  school uuid := (select id from public.schools where name = 'Clarion International School');
  rec record;
begin
  if school is null then
    raise exception 'Clarion International School does not exist; run clarion_international.sql first';
  end if;

  -- Clear what has happened so far (see clarion_international_clear.sql).
  create temp table school_people on commit drop as
    select id from public.profiles where school_id = school;
  alter table school_people enable row level security;
  create temp table school_classes on commit drop as
    select id from public.classes where school_id = school;
  alter table school_classes enable row level security;
  delete from public.tasks
  where class_id in (select id from school_classes) or owner_id in (select id from school_people);
  delete from public.points_ledger where student_id in (select id from school_people);
  delete from public.redemptions where student_id in (select id from school_people);
  delete from public.threads where class_id in (select id from school_classes);
  delete from public.thread_reads where user_id in (select id from school_people);
  delete from public.flashcard_decks
  where class_id in (select id from school_classes) or owner_id in (select id from school_people);
  delete from public.flashcard_reviews where user_id in (select id from school_people);
  delete from public.ai_conversations where user_id in (select id from school_people);

  create temp table fresh_class_rows on commit drop as
    select distinct on (c.id) c.id, c.name, m.user_id as teacher
    from public.classes c
    join public.class_members m on m.class_id = c.id and m.role = 'teacher'
    where c.school_id = school
    order by c.id, m.joined_at;
  alter table fresh_class_rows enable row level security;

  create temp table fresh_people on commit drop as
    select u.id, u.email from auth.users u join public.profiles p on p.id = u.id where p.school_id = school;
  alter table fresh_people enable row level security;

  -- Work, with the teacher's instructions and a resource link where there is one.
  create temp table fresh_task_rows (id uuid, class_id uuid, title text, set_on date, due_on date, points int, created_by uuid) on commit drop;
  alter table fresh_task_rows enable row level security;
  with added as (
    insert into public.tasks (class_id, title, details, set_on, due_on, points, created_by)
    select c.id, t.title, t.details, pg_temp.school_day(today, t.set_day), pg_temp.school_day(today, t.due_day), t.points, c.teacher
    from fresh_tasks t join fresh_class_rows c on c.name = t.class_name
    returning id, class_id, title, set_on, due_on, points, created_by
  )
  insert into fresh_task_rows select * from added;

  insert into public.task_attachments (task_id, kind, title, url, created_by)
  select tk.id, 'link', t.link_title, t.link_url, tk.created_by
  from fresh_task_rows tk
  join fresh_class_rows c on c.id = tk.class_id
  join fresh_tasks t on t.class_name = c.name and t.title = tk.title
  where t.link_url is not null;

  -- Hand-ins. Yesterday's work: most of the class handed it in and most of
  -- that is verified, a little is still to check and one or two came back to
  -- fix. Work due later: a few early birds. Work set today: nothing yet.
  -- Work still waiting to be checked came in near the deadline, so none of it
  -- has waited long.
  insert into public.task_submissions (task_id, student_id, status, submitted_at, verified_at, verified_by)
  select task_id, student_id, status::public.submission_status, submitted_at,
    case when status = 'verified' then submitted_at + (0.3 + pg_temp.chance(k || ':check') * 0.6) * (now() - submitted_at) end,
    case when status = 'verified' then teacher end
  from (
    select h.*, started + (case when status = 'submitted' then 0.75 + 0.25 * c else c end) * (latest - started) as submitted_at
    from (
      select tk.id as task_id, m.user_id as student_id, tk.created_by as teacher, k, c, started,
        greatest(started, least(now() - interval '1 hour', due_at)) as latest,
        case
          when tk.due_on < today then case when r < 0.6 then 'verified' when r < 0.76 then 'submitted' when r < 0.8 then 'returned' end
          when tk.due_on = today then case when r < 0.4 then 'submitted' end
          when tk.set_on < today then case when r < 0.15 then 'submitted' end
        end as status
      from fresh_task_rows tk
      join public.class_members m on m.class_id = tk.class_id and m.role = 'student'
      cross join lateral (
        select tk.title || ':' || m.user_id as k,
          pg_temp.chance(tk.title || ':' || m.user_id) as r,
          pg_temp.chance(tk.title || ':' || m.user_id || ':at') as c,
          (tk.set_on::timestamp + interval '10 hours') at time zone 'Asia/Kolkata' as started,
          (tk.due_on::timestamp + interval '17 hours') at time zone 'Asia/Kolkata' as due_at
      ) x
    ) h
    where status is not null
  ) s;

  -- Verified work pays its points, dated when it was checked.
  insert into public.points_ledger (student_id, class_id, delta, reason, submission_id, created_at)
  select s.student_id, tk.class_id, tk.points, tk.title, s.id, s.verified_at
  from public.task_submissions s
  join fresh_task_rows tk on tk.id = s.task_id
  where s.status = 'verified' and tk.points > 0;

  -- Discussions
  create temp table fresh_thread_rows (id uuid, class_id uuid, title text) on commit drop;
  alter table fresh_thread_rows enable row level security;
  with added as (
    insert into public.threads (class_id, author_id, title, pinned, created_at, last_post_at)
    select c.id, p.id, t.title, t.pinned,
      now() - make_interval(mins => (select max(minutes_ago) from fresh_posts fp where fp.thread_key = t.key)),
      now() - make_interval(mins => (select min(minutes_ago) from fresh_posts fp where fp.thread_key = t.key))
    from fresh_threads t join fresh_class_rows c on c.name = t.class_name join fresh_people p on p.email = t.author
    returning id, class_id, title
  )
  insert into fresh_thread_rows select * from added;

  insert into public.posts (thread_id, author_id, body, created_at)
  select th.id, p.id, fp.body, now() - make_interval(mins => fp.minutes_ago)
  from fresh_posts fp
  join fresh_threads t on t.key = fp.thread_key
  join fresh_class_rows c on c.name = t.class_name
  join fresh_thread_rows th on th.class_id = c.id and th.title = t.title
  join fresh_people p on p.email = fp.author;

  -- Teachers have read everything up to their own last post.
  insert into public.thread_reads (thread_id, user_id, last_read_at)
  select th.id, c.teacher, max(po.created_at)
  from fresh_thread_rows th
  join fresh_class_rows c on c.id = th.class_id
  join public.posts po on po.thread_id = th.id and po.author_id = c.teacher
  group by th.id, c.teacher;

  -- Shared flashcard decks
  for rec in select distinct class_name, deck from fresh_cards loop
    with deck as (
      insert into public.flashcard_decks (class_id, owner_id, title, shared)
      select c.id, c.teacher, rec.deck, true from fresh_class_rows c where c.name = rec.class_name
      returning id
    )
    insert into public.flashcards (deck_id, front, back, position)
    select deck.id, fc.front, fc.back, fc.position
    from deck, fresh_cards fc
    where fc.class_name = rec.class_name and fc.deck = rec.deck;
  end loop;
end $$;
