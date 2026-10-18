-- Instructions and resource links for the test school's work.
-- Run after test_school.sql (any number of times). Tasks are matched by class
-- name and title; links are added once, by the class teacher.

update public.tasks t
set details = v.details
from (
  values
    ('Biology 9', 'Cell structure worksheet',
     E'Label the animal and plant cell diagrams on the worksheet, then answer questions 1 to 8.\nUse full sentences for questions 6 to 8.\nHand in a photo or scan of both pages.'),
    ('Biology 9', 'Read pages 3 to 6 and self check',
     E'Read pages 3 to 6 of the Unit 2 booklet (cells and organisation).\nThen do the self check on page 7 and mark it with the answers at the back.\nWrite down one question to bring to the next lesson.'),
    ('Biology 9', 'Photosynthesis revision notes',
     E'Make one page of revision notes covering:\n- the word and symbol equations\n- where photosynthesis happens in the leaf\n- the three limiting factors\nDiagrams are welcome.'),
    ('Maths 9', 'Quadratics problem set',
     E'Questions 1 to 12 from the problem set. Show your working for every question.\nQuestions 10 to 12 are stretch questions: try at least one.'),
    ('Maths 9', 'Completing the square practice',
     E'Exercise 4C, odd numbers from 1 to 15.\nCheck each answer by expanding the brackets back out.'),
    ('English 9', 'Essay first draft',
     E'Write the first draft of your persuasive essay on the topic we chose in class.\nAim for 800 to 1,000 words: an introduction with a clear thesis, three body paragraphs with evidence, and a conclusion.'),
    ('History 9', 'Unit 2 source list',
     E'List at least six sources for your Unit 2 investigation, including two primary sources.\nFor each one give the author, date and type of source, and one sentence on why it is useful.'),
    ('History 9', 'Primary source annotations',
     E'Annotate the two primary sources from the lesson: who made it, when, why, and what it tells us.')
) as v (class_name, title, details)
join public.classes c on c.name = v.class_name
join public.schools s on s.id = c.school_id and s.name = 'Clarion Test School'
where t.class_id = c.id and t.title = v.title;

insert into public.task_attachments (task_id, kind, title, url, created_by)
select t.id, 'link', v.link_title, v.url, m.user_id
from (
  values
    ('Biology 9', 'Cell structure worksheet', 'Cell (biology), Wikipedia', 'https://en.wikipedia.org/wiki/Cell_(biology)'),
    ('Biology 9', 'Photosynthesis revision notes', 'Photosynthesis, Wikipedia', 'https://en.wikipedia.org/wiki/Photosynthesis'),
    ('Maths 9', 'Quadratics problem set', 'Quadratic equation, Wikipedia', 'https://en.wikipedia.org/wiki/Quadratic_equation'),
    ('Maths 9', 'Completing the square practice', 'Completing the square, Wikipedia', 'https://en.wikipedia.org/wiki/Completing_the_square'),
    ('English 9', 'Essay first draft', 'Thesis statement tips, Purdue OWL', 'https://owl.purdue.edu/owl/general_writing/the_writing_process/thesis_statement_tips.html')
) as v (class_name, title, link_title, url)
join public.classes c on c.name = v.class_name
join public.schools s on s.id = c.school_id and s.name = 'Clarion Test School'
join public.tasks t on t.class_id = c.id and t.title = v.title
join lateral (
  select cm.user_id from public.class_members cm
  where cm.class_id = c.id and cm.role = 'teacher'
  limit 1
) m on true
where not exists (
  select 1 from public.task_attachments a where a.task_id = t.id and a.url = v.url
);
