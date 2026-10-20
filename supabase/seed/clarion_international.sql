-- Clarion International School: a whole school to use Clarion with.
--
--   1 coordinator   prithu1606+coordinator@gmail.com   (Nandini Rao, teaches English 9)
--   5 teachers      prithu1606+kaushal / +iyer / +khan / +mathew / +banerjee @gmail.com
--   24 students     prithu1606+<first name>@gmail.com  (12 in Year 9, 12 in Year 10)
--   8 classes       Biology, Maths, English and History for Years 9 and 10
--
-- Every address is a Gmail "+" alias, so password resets reach the owner's inbox.
-- Work, hand-ins, points, discussions and flashcards are dated relative to today.
--
-- Run it in one go in the SQL editor. Set the password every account gets on
-- the first line (it is never stored in this file):
--   select set_config('clarion.seed_password', '<password>', false);
-- Running it again does nothing once the school exists.
-- clarion_international_clear.sql empties it back to a blank sheet.

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

-- ── People ──────────────────────────────────────────────────────────────────

create temp table seed_people (email text primary key, full_name text not null, role public.user_role not null, year_group text);
insert into seed_people values
  ('prithu1606+coordinator@gmail.com', 'Nandini Rao', 'admin', null),
  ('prithu1606+kaushal@gmail.com', 'Anjali Kaushal', 'teacher', null),
  ('prithu1606+iyer@gmail.com', 'Vikram Iyer', 'teacher', null),
  ('prithu1606+khan@gmail.com', 'Farah Khan', 'teacher', null),
  ('prithu1606+mathew@gmail.com', 'Daniel Mathew', 'teacher', null),
  ('prithu1606+banerjee@gmail.com', 'Sourav Banerjee', 'teacher', null);
insert into seed_people
select 'prithu1606+' || lower(split_part(name, ' ', 1)) || '@gmail.com', name, 'student', year_group
from (values
  ('Ananya Reddy', 'Year 9'), ('Rohan Mehta', 'Year 9'), ('Zara Khan', 'Year 9'), ('Aarav Patel', 'Year 9'),
  ('Meera Joshi', 'Year 9'), ('Kabir Singh', 'Year 9'), ('Ishaan Thakur', 'Year 9'), ('Diya Nair', 'Year 9'),
  ('Vihaan Gupta', 'Year 9'), ('Saanvi Bose', 'Year 9'), ('Arjun Desai', 'Year 9'), ('Tara Lobo', 'Year 9'),
  ('Aditya Kumar', 'Year 10'), ('Riya Pillai', 'Year 10'), ('Sameer Jain', 'Year 10'), ('Anika Das', 'Year 10'),
  ('Neel Bhatt', 'Year 10'), ('Pooja Raman', 'Year 10'), ('Yash Tiwari', 'Year 10'), ('Ira Menon', 'Year 10'),
  ('Karan Verma', 'Year 10'), ('Leela Shah', 'Year 10'), ('Om Naik', 'Year 10'), ('Myra Gill', 'Year 10')
) as s(name, year_group);

-- Accounts: email confirmed, password sign-in. Existing addresses are left alone.
with new_users as (
  select gen_random_uuid() as id, p.email, p.full_name
  from seed_people p
  where not exists (select 1 from auth.users u where u.email = p.email)
),
inserted as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt(current_setting('clarion.seed_password'), extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', full_name, 'email_verified', true),
    now(), now(), '', '', '', '', '', '', '', ''
  from new_users
  returning id, email
)
insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select i.id, i.id::text, 'email',
  jsonb_build_object('sub', i.id::text, 'email', i.email, 'email_verified', true, 'phone_verified', false),
  now(), now(), now()
from inserted i;

-- ── Classes and work ────────────────────────────────────────────────────────

create temp table seed_classes (name text primary key, color public.class_color, code text, year_group text, teacher text);
insert into seed_classes values
  ('Biology 9', 'mint', 'BIO9KX', 'Year 9', 'prithu1606+kaushal@gmail.com'),
  ('Maths 9', 'sky', 'MAT9QT', 'Year 9', 'prithu1606+iyer@gmail.com'),
  ('English 9', 'brand', 'ENG9LP', 'Year 9', 'prithu1606+coordinator@gmail.com'),
  ('History 9', 'amber', 'HIS9VD', 'Year 9', 'prithu1606+banerjee@gmail.com'),
  ('Biology 10', 'mint', 'BIO10Z', 'Year 10', 'prithu1606+kaushal@gmail.com'),
  ('Maths 10', 'sky', 'MAT10W', 'Year 10', 'prithu1606+khan@gmail.com'),
  ('English 10', 'brand', 'ENG10R', 'Year 10', 'prithu1606+mathew@gmail.com'),
  ('History 10', 'amber', 'HIS10S', 'Year 10', 'prithu1606+banerjee@gmail.com');

-- set_day and due_day are school days from today (negative is the past, 0 is today).
create temp table seed_tasks (class_name text, title text, set_day int, due_day int, points int, details text, link_title text, link_url text);
insert into seed_tasks values
  ('Biology 9', 'Microscope drawing', -12, -9, 10,
   'Draw what you see under the microscope at x100 and x400. Label at least four parts and add a scale bar.', null, null),
  ('Biology 9', 'Cell structure worksheet', -6, -2, 20,
   E'Label the animal and plant cell diagrams on the worksheet, then answer questions 1 to 8.\nUse full sentences for questions 6 to 8.\nHand in a photo or scan of both pages.',
   'Cell (biology), Wikipedia', 'https://en.wikipedia.org/wiki/Cell_(biology)'),
  ('Biology 9', 'Read pages 3 to 6 and self check', -2, 0, 10,
   E'Read pages 3 to 6 of the Unit 2 booklet (cells and organisation).\nThen do the self check on page 7 and mark it with the answers at the back.', null, null),
  ('Biology 9', 'Photosynthesis revision notes', -1, 2, 15,
   E'Make one page of revision notes covering:\n- the word and symbol equations\n- where photosynthesis happens in the leaf\n- the three limiting factors',
   'Photosynthesis, Wikipedia', 'https://en.wikipedia.org/wiki/Photosynthesis'),
  ('Biology 9', 'Enzymes practice questions', 0, 5, 15,
   'Answer questions 1 to 6 on enzymes. For question 6, sketch the graph of rate against temperature and explain its shape.',
   'Enzyme, Wikipedia', 'https://en.wikipedia.org/wiki/Enzyme'),

  ('Maths 9', 'Algebra warm-up', -10, -8, 10, 'Expand and simplify questions 1 to 20 on the warm-up sheet.', null, null),
  ('Maths 9', 'Quadratics problem set', -4, -1, 20,
   E'Questions 1 to 12 from the problem set. Show your working for every question.\nQuestions 10 to 12 are stretch questions: try at least one.',
   'Quadratic equation, Wikipedia', 'https://en.wikipedia.org/wiki/Quadratic_equation'),
  ('Maths 9', 'Completing the square practice', -1, 3, 15,
   E'Exercise 4C, odd numbers from 1 to 15.\nCheck each answer by expanding the brackets back out.',
   'Completing the square, Wikipedia', 'https://en.wikipedia.org/wiki/Completing_the_square'),
  ('Maths 9', 'Graphs of quadratics', 0, 6, 20,
   'Plot y = x² − 4x + 3 and y = −x² + 2x + 8 from x = −2 to 5. Mark the roots and the turning point on each.',
   'Parabola, Wikipedia', 'https://en.wikipedia.org/wiki/Parabola'),

  ('English 9', 'Persuasive paragraph', -11, -8, 15,
   'Write one persuasive paragraph (150 to 200 words) on whether homework should be banned. Use at least two persuasive techniques and label them.', null, null),
  ('English 9', 'Reading log, week 3', -6, -1, 10,
   'Fill in this week''s reading log: pages read each day and two sentences on what changed in the story.', null, null),
  ('English 9', 'Essay first draft', -4, 2, 25,
   E'Write the first draft of your persuasive essay on the topic we chose in class.\nAim for 800 to 1,000 words: an introduction with a clear thesis, three body paragraphs with evidence, and a conclusion.',
   'Thesis statement tips, Purdue OWL', 'https://owl.purdue.edu/owl/general_writing/the_writing_process/thesis_statement_tips.html'),
  ('English 9', 'Poetry annotations', -1, 4, 15,
   'Annotate both poems from the anthology for language, structure and form. Use at least three colours.', null, null),

  ('History 9', 'Timeline poster', -13, -9, 20,
   'Make an A3 timeline of the Industrial Revolution from 1750 to 1850 with at least ten events and one picture per decade.', null, null),
  ('History 9', 'Primary source annotations', -7, -4, 15,
   'Annotate the two primary sources from the lesson: who made it, when, why, and what it tells us.', null, null),
  ('History 9', 'Unit 2 source list', -6, -2, 10,
   E'List at least six sources for your Unit 2 investigation, including two primary sources.\nFor each one give the author, date and type of source, and one sentence on why it is useful.', null, null),
  ('History 9', 'Industrial Revolution essay plan', -1, 4, 20,
   'Plan an essay on the main causes of the Industrial Revolution in Britain: a thesis, three causes with evidence, and a judgement on which mattered most.',
   'Industrial Revolution, Wikipedia', 'https://en.wikipedia.org/wiki/Industrial_Revolution'),

  ('Biology 10', 'Cell division quiz prep', -12, -8, 10,
   'Learn the stages of mitosis and make a labelled diagram of each one. There is a short quiz at the start of the lesson.', null, null),
  ('Biology 10', 'Enzyme practical write-up', -6, -2, 20,
   'Write up the enzyme practical: method, results table, graph of rate against temperature, and a conclusion that explains the shape of the graph using the words active site and denatured.',
   'Enzyme, Wikipedia', 'https://en.wikipedia.org/wiki/Enzyme'),
  ('Biology 10', 'Genetics key terms', -2, 0, 10,
   'Learn the ten genetics key terms on the sheet. There is a short quiz at the start of the lesson.', null, null),
  ('Biology 10', 'Inheritance problem sheet', -1, 3, 15,
   'Questions 1 to 10 on the inheritance sheet. Draw a Punnett square for every cross.',
   'Mendelian inheritance, Wikipedia', 'https://en.wikipedia.org/wiki/Mendelian_inheritance'),
  ('Biology 10', 'Ecosystems poster plan', 0, 6, 25,
   'Plan an A3 poster on one ecosystem: a food web with at least eight organisms, two adaptations, and one human impact. Hand in a photo of your plan.',
   'Ecosystem, Wikipedia', 'https://en.wikipedia.org/wiki/Ecosystem'),

  ('Maths 10', 'Simultaneous equations', -9, -6, 15,
   'Exercise 6B, questions 1 to 12. Solve each pair by elimination, then check one answer by substitution.', null, null),
  ('Maths 10', 'Trigonometry basics', -4, -1, 20,
   'Questions 1 to 15 on SOH CAH TOA. Draw and label the triangle for every question.',
   'Trigonometry, Wikipedia', 'https://en.wikipedia.org/wiki/Trigonometry'),
  ('Maths 10', 'Sine rule practice', -1, 3, 15,
   'Exercise 9A, questions 1 to 10. Round answers to 3 significant figures.',
   'Law of sines, Wikipedia', 'https://en.wikipedia.org/wiki/Law_of_sines'),
  ('Maths 10', 'Vectors introduction', 0, 5, 15,
   'Read the vectors introduction sheet and answer the six check questions at the end.',
   'Euclidean vector, Wikipedia', 'https://en.wikipedia.org/wiki/Euclidean_vector'),

  ('English 10', 'Macbeth act 1 summary', -10, -7, 15,
   'Summarise each scene of act 1 in three sentences, and pick one key quotation per scene.',
   'Macbeth, Wikipedia', 'https://en.wikipedia.org/wiki/Macbeth'),
  ('English 10', 'Character analysis: Lady Macbeth', -5, -1, 25,
   'Write 600 words on how Shakespeare presents Lady Macbeth in act 1. Use at least four quotations and comment on the language.', null, null),
  ('English 10', 'Act 2 quotations', -1, 3, 10,
   'Choose eight quotations from act 2 and explain what each one shows about a character or a theme.', null, null),
  ('English 10', 'Speech draft', 0, 6, 20,
   'Draft a two minute speech on a topic you care about. Underline three rhetorical devices.', null, null),

  ('History 10', 'Cold War key terms', -9, -6, 10,
   'Learn the 12 Cold War key terms on the sheet and write a one-line definition of each.',
   'Cold War, Wikipedia', 'https://en.wikipedia.org/wiki/Cold_War'),
  ('History 10', 'Source comparison: Berlin Airlift', -5, -2, 20,
   'Compare sources A and B on the Berlin Airlift: how far do they agree, and which is more useful? About 400 words.',
   'Berlin Blockade, Wikipedia', 'https://en.wikipedia.org/wiki/Berlin_Blockade'),
  ('History 10', 'Cuban Missile Crisis timeline', -1, 3, 15,
   'Make a day-by-day timeline of the thirteen days in October 1962 with one sentence on each turning point.',
   'Cuban Missile Crisis, Wikipedia', 'https://en.wikipedia.org/wiki/Cuban_Missile_Crisis'),
  ('History 10', 'Essay plan: causes of the Cold War', 0, 7, 25,
   'Plan an essay on the causes of the Cold War: a thesis, three causes with evidence, and a conclusion that weighs them up.', null, null);

-- ── Discussions and flashcards ──────────────────────────────────────────────

create temp table seed_threads (key text primary key, class_name text, author text, title text, pinned boolean);
insert into seed_threads values
  ('bio9', 'Biology 9', 'prithu1606+kaushal@gmail.com', 'Q and A, Biology 9', true),
  ('maths9', 'Maths 9', 'prithu1606+aarav@gmail.com', 'Quadratics help', false),
  ('eng9', 'English 9', 'prithu1606+coordinator@gmail.com', 'Essay drafts', true),
  ('his9', 'History 9', 'prithu1606+banerjee@gmail.com', 'Unit 2 sources', true),
  ('bio10', 'Biology 10', 'prithu1606+riya@gmail.com', 'Enzyme practical', false),
  ('maths10', 'Maths 10', 'prithu1606+khan@gmail.com', 'Trigonometry formula sheet', true),
  ('eng10', 'English 10', 'prithu1606+mathew@gmail.com', 'Macbeth act 2', false),
  ('his10', 'History 10', 'prithu1606+sameer@gmail.com', 'Cold War revision', false);

create temp table seed_posts (thread_key text, author text, body text, minutes_ago int);
insert into seed_posts values
  ('bio9', 'prithu1606+kaushal@gmail.com', 'Reminder: next week''s test covers cell structure and photosynthesis only. You do not need the light dependent reactions in detail.', 2900),
  ('bio9', 'prithu1606+ananya@gmail.com', 'Do we need to memorise the full equation, or is the word equation enough?', 300),
  ('bio9', 'prithu1606+kaushal@gmail.com', 'The word equation is enough for this test. The balanced version comes in unit 4.', 240),
  ('bio9', 'prithu1606+diya@gmail.com', 'Will the microscope drawing be on the test too?', 35),
  ('maths9', 'prithu1606+aarav@gmail.com', 'Can someone explain completing the square?', 600),
  ('maths9', 'prithu1606+iyer@gmail.com', 'Halve the x coefficient, square it, then add and subtract it. There is a worked example at the start of tomorrow''s lesson.', 540),
  ('maths9', 'prithu1606+meera@gmail.com', 'Thank you, that makes sense now.', 120),
  ('eng9', 'prithu1606+coordinator@gmail.com', 'First drafts are due this week. Attach your draft on the task page, as a file or a Google Docs link.', 1600),
  ('eng9', 'prithu1606+kabir@gmail.com', 'Can we use quotes from the article we read in class as evidence?', 45),
  ('his9', 'prithu1606+banerjee@gmail.com', 'Pinned: use at least three of the primary sources from the library list in your source list.', 4300),
  ('his9', 'prithu1606+zara@gmail.com', 'Does a museum website count as a primary source?', 30),
  ('bio10', 'prithu1606+riya@gmail.com', 'For the graph, should temperature go on the x axis even though we only tested five temperatures?', 180),
  ('maths10', 'prithu1606+khan@gmail.com', 'The formula sheet in the unit booklet is the same one you get in the exam. Learn where everything is on it.', 3000),
  ('eng10', 'prithu1606+mathew@gmail.com', 'We start act 2 on Monday. Read scene 1 before the lesson.', 900),
  ('eng10', 'prithu1606+neel@gmail.com', 'Is the dagger speech in scene 1 or scene 2?', 50),
  ('his10', 'prithu1606+sameer@gmail.com', 'Will the Berlin Airlift be in the end of unit test?', 400),
  ('his10', 'prithu1606+banerjee@gmail.com', 'Yes, there is one source question on it.', 380);

create temp table seed_cards (class_name text, deck text, front text, back text, position int);
insert into seed_cards values
  ('Biology 9', 'Cell structure', 'What does the nucleus do?', 'It holds the genetic material and controls the cell''s activities.', 1),
  ('Biology 9', 'Cell structure', 'Where does aerobic respiration happen?', 'In the mitochondria.', 2),
  ('Biology 9', 'Cell structure', 'What do ribosomes do?', 'They make proteins.', 3),
  ('Biology 9', 'Cell structure', 'Name three structures found only in plant cells.', 'Cell wall, chloroplasts and a permanent vacuole.', 4),
  ('Biology 9', 'Cell structure', 'What does the cell membrane do?', 'It controls what enters and leaves the cell.', 5),
  ('Biology 9', 'Photosynthesis', 'Where does photosynthesis happen?', 'In the chloroplasts, mostly in the leaf cells.', 1),
  ('Biology 9', 'Photosynthesis', 'What is the word equation?', 'Carbon dioxide + water → glucose + oxygen, using light energy.', 2),
  ('Biology 9', 'Photosynthesis', 'Which pigment absorbs the light?', 'Chlorophyll.', 3),
  ('Biology 9', 'Photosynthesis', 'Name one limiting factor.', 'Light intensity, carbon dioxide concentration or temperature.', 4),
  ('Maths 9', 'Quadratics', 'State the quadratic formula.', 'x = (−b ± √(b² − 4ac)) / 2a', 1),
  ('Maths 9', 'Quadratics', 'Factorise x² + 5x + 6.', '(x + 2)(x + 3)', 2),
  ('Maths 9', 'Quadratics', 'What does the discriminant tell you?', 'Positive: two real roots. Zero: one repeated root. Negative: no real roots.', 3),
  ('Maths 9', 'Quadratics', 'Complete the square for x² + 6x.', '(x + 3)² − 9', 4),
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

-- ── Build the school ────────────────────────────────────────────────────────

do $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  school uuid;
  rec record;
begin
  if exists (select 1 from public.schools where name = 'Clarion International School') then
    raise notice 'Clarion International School already exists, nothing to do';
    return;
  end if;
  if (select count(*) from seed_people p join auth.users u on u.email = p.email) < (select count(*) from seed_people) then
    raise exception 'Some accounts are missing; set clarion.seed_password and run the whole file';
  end if;

  insert into public.schools (name) values ('Clarion International School') returning id into school;

  update public.profiles p
  set school_id = school, role = sp.role, full_name = sp.full_name, year_group = sp.year_group
  from seed_people sp join auth.users u on u.email = sp.email
  where p.id = u.id;

  create temp table seed_accounts on commit drop as
    select u.id, sp.* from seed_people sp join auth.users u on u.email = sp.email;

  -- Classes: the teacher, and every student in that year group.
  insert into public.classes (school_id, name, color, join_code)
  select school, name, color, code from seed_classes;
  create temp table seed_class_rows on commit drop as
    select c.id, sc.* from seed_classes sc join public.classes c on c.join_code = sc.code;

  insert into public.class_members (class_id, user_id, role)
  select c.id, p.id, 'teacher'::public.user_role from seed_class_rows c join seed_accounts p on p.email = c.teacher
  union all
  select c.id, p.id, 'student'::public.user_role from seed_class_rows c join seed_accounts p on p.role = 'student' and p.year_group = c.year_group;

  -- Work, with the teacher's instructions and a resource link where there is one.
  insert into public.tasks (class_id, title, details, set_on, due_on, points, created_by)
  select c.id, t.title, t.details,
    case when t.set_day = 0 then today else pg_temp.school_day(today, t.set_day) end,
    case when t.due_day = 0 then today else pg_temp.school_day(today, t.due_day) end,
    t.points, p.id
  from seed_tasks t join seed_class_rows c on c.name = t.class_name join seed_accounts p on p.email = c.teacher;

  insert into public.task_attachments (task_id, kind, title, url, created_by)
  select tk.id, 'link', t.link_title, t.link_url, tk.created_by
  from seed_tasks t
  join seed_class_rows c on c.name = t.class_name
  join public.tasks tk on tk.class_id = c.id and tk.title = t.title
  where t.link_url is not null;

  -- Hand-ins. Older work is mostly verified; recent work is waiting to be
  -- checked; a few pieces are missing or were returned to fix.
  insert into public.task_submissions (task_id, student_id, status, submitted_at, verified_at, verified_by)
  select task_id, student_id, status::public.submission_status, submitted_at,
    case when status = 'verified' then submitted_at + (0.3 + pg_temp.chance(k || ':check') * 0.6) * (now() - submitted_at) end,
    case when status = 'verified' then teacher end
  from (
    select tk.id as task_id, p.id as student_id, tk.created_by as teacher, k,
      case
        when today - tk.due_on >= 5 then case when r < 0.85 then 'verified' when r < 0.9 then 'returned' end
        when today - tk.due_on > 0 then case when r < 0.3 then 'verified' when r < 0.72 then 'submitted' when r < 0.78 then 'returned' end
        when today = tk.due_on then case when r < 0.45 then 'submitted' end
        else case when r < 0.18 then 'submitted' end
      end as status,
      started + pg_temp.chance(k || ':at') * (greatest(started, least(now() - interval '1 hour', due_at)) - started) as submitted_at
    from public.tasks tk
    join seed_class_rows c on c.id = tk.class_id
    join seed_accounts p on p.role = 'student' and p.year_group = c.year_group
    cross join lateral (
      select tk.title || ':' || p.email as k,
        pg_temp.chance(tk.title || ':' || p.email) as r,
        (tk.set_on::timestamp + interval '10 hours') at time zone 'Asia/Kolkata' as started,
        (tk.due_on::timestamp + interval '17 hours') at time zone 'Asia/Kolkata' as due_at
    ) x
  ) s
  where status is not null;

  -- Verified work pays its points, dated when it was checked.
  insert into public.points_ledger (student_id, class_id, delta, reason, submission_id, created_at)
  select s.student_id, tk.class_id, tk.points, tk.title, s.id, s.verified_at
  from public.task_submissions s
  join public.tasks tk on tk.id = s.task_id
  join seed_class_rows c on c.id = tk.class_id
  where s.status = 'verified' and tk.points > 0;

  -- Discussions
  insert into public.threads (class_id, author_id, title, pinned, created_at, last_post_at)
  select c.id, p.id, t.title, t.pinned,
    now() - make_interval(mins => (select max(minutes_ago) from seed_posts sp where sp.thread_key = t.key)),
    now() - make_interval(mins => (select min(minutes_ago) from seed_posts sp where sp.thread_key = t.key))
  from seed_threads t join seed_class_rows c on c.name = t.class_name join seed_accounts p on p.email = t.author;

  insert into public.posts (thread_id, author_id, body, created_at)
  select th.id, p.id, sp.body, now() - make_interval(mins => sp.minutes_ago)
  from seed_posts sp
  join seed_threads t on t.key = sp.thread_key
  join seed_class_rows c on c.name = t.class_name
  join public.threads th on th.class_id = c.id and th.title = t.title
  join seed_accounts p on p.email = sp.author;

  -- Teachers have read everything up to their own last post.
  insert into public.thread_reads (thread_id, user_id, last_read_at)
  select th.id, p.id, max(po.created_at)
  from public.threads th
  join seed_class_rows c on c.id = th.class_id
  join seed_accounts p on p.email = c.teacher
  join public.posts po on po.thread_id = th.id and po.author_id = p.id
  group by th.id, p.id;

  -- Shared flashcard decks
  for rec in select distinct class_name, deck from seed_cards loop
    with deck as (
      insert into public.flashcard_decks (class_id, owner_id, title, shared)
      select c.id, p.id, rec.deck, true from seed_class_rows c join seed_accounts p on p.email = c.teacher where c.name = rec.class_name
      returning id
    )
    insert into public.flashcards (deck_id, front, back, position)
    select deck.id, sc.front, sc.back, sc.position
    from deck, seed_cards sc
    where sc.class_name = rec.class_name and sc.deck = rec.deck;
  end loop;

  -- Rewards, and a request waiting for a teacher from the top student in each year.
  insert into public.rewards (school_id, title, cost, needs_teacher) values
    (school, 'Choose the next class game', 80, true),
    (school, 'Homework pass, one task', 150, true),
    (school, 'Custom theme unlock', 300, false);

  for rec in
    select distinct on (p.year_group) p.id as student_id, p.year_group, sum(l.delta) as points
    from seed_accounts p join public.points_ledger l on l.student_id = p.id
    where p.role = 'student'
    group by p.id, p.year_group
    order by p.year_group, sum(l.delta) desc
  loop
    with r as (
      select id, cost, title from public.rewards
      where school_id = school and title = case when rec.year_group = 'Year 10' and rec.points >= 150 then 'Homework pass, one task' else 'Choose the next class game' end
    ),
    redemption as (
      insert into public.redemptions (reward_id, student_id, status, created_at)
      select r.id, rec.student_id, 'requested', now() - interval '5 hours' from r
      where rec.points >= r.cost
      returning id, reward_id
    )
    insert into public.points_ledger (student_id, delta, reason, redemption_id, created_at)
    select rec.student_id, -r.cost, r.title, redemption.id, now() - interval '5 hours'
    from redemption join r on r.id = redemption.reward_id;
  end loop;
end $$;
