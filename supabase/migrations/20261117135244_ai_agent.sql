-- The AI Helper as an editable agent.
--
-- ai_settings: the agent's prompt for students and for staff, with the
-- Gemini model and temperature. Edit them in the Supabase Table Editor; the
-- study-helper function reads them on every question, so a change applies
-- straight away. (The Gemini key itself stays in Edge Function secrets as
-- GEMINI_API_KEY.) The function adds fixed rules after this prompt that keep
-- the app working: how to use the context, cite sources and shape the JSON.
--
-- ai_presets: the one-tap functions in the AI Helper (flashcards, quizzes,
-- study plans and more). Each has a label, a description, the kind of output
-- (chat, flashcards, quiz or plan) and the instruction sent to the model.
-- Add, reword, reorder (position) or switch off (active) presets here.
--
-- Signed-in users can read the presets' labels, never the instructions or
-- the prompts; only the function (with the secret key) reads those.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── The agent ───────────────────────────────────────────────────────────────

create table public.ai_settings (
  audience text primary key check (audience in ('student', 'staff')),
  prompt text not null check (char_length(prompt) between 20 and 8000),
  model text not null default 'gemini-flash-latest' check (char_length(model) between 3 and 80),
  temperature real not null default 0.4 check (temperature between 0 and 2),
  updated_at timestamptz not null default now()
);
comment on table public.ai_settings is 'The AI Helper''s prompt, model and temperature for students and for staff. Edit freely; the study-helper function reads it on every question.';
create trigger before_ai_settings_update before update on public.ai_settings
  for each row execute function public.touch_updated_at();

alter table public.ai_settings enable row level security;
revoke all on public.ai_settings from anon, authenticated;

insert into public.ai_settings (audience, prompt) values
  ('student', $prompt$You are Clarion, a friendly study helper for secondary school students (ages 11 to 16).
- Teach, do not do the work for them: explain, give steps, examples and checks. Do not write whole essays or hand over answers to assessed tasks; offer an outline or feedback instead.
- Keep answers short and clear: at most about 150 words, plain sentences, no markdown headings.
- Be encouraging and calm. Deadlines are information, not pressure.
- Stay age appropriate. Refuse anything harmful, and if a student mentions self harm, bullying or feeling unsafe, kindly tell them to talk to a trusted adult or the school counsellor.
- Follow the TEACHER NOTES (from the student's teachers) over general knowledge.
- FEEDBACK lists answers this student rated: keep doing what helped, and avoid what made answers unhelpful.$prompt$),
  ('staff', $prompt$You are Clarion, an assistant for secondary school teachers and coordinators.
- Help with: who is behind or needs a nudge, what to check first, summarising what students are asking, drafting clear task instructions, quizzes and flashcards, and lesson or feedback ideas.
- Keep answers short and practical: at most about 150 words, plain sentences, no markdown headings. Lines starting with "• " are fine for lists of students or steps.
- Student names and work are confidential: only mention students who appear in the context, and only to this teacher. Never invent students or numbers.
- TEACHER NOTES are this teacher's notes for their classes; FEEDBACK lists answers they rated: keep doing what helped.$prompt$);

-- ── Presets ─────────────────────────────────────────────────────────────────

create table public.ai_presets (
  key text primary key check (key ~ '^[a-z0-9-]{2,40}$'),
  audience text not null check (audience in ('student', 'staff')),
  label text not null check (char_length(label) between 1 and 40),
  description text not null default '' check (char_length(description) <= 120),
  output text not null default 'chat' check (output in ('chat', 'flashcards', 'quiz', 'plan')),
  topic_hint text not null default '' check (char_length(topic_hint) <= 80),
  position integer not null default 0,
  instruction text not null check (char_length(instruction) between 10 and 4000),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table public.ai_presets is 'One-tap AI Helper functions. output: chat, flashcards, quiz or plan. topic_hint empty = no topic box. Reorder with position, hide with active = false.';
create trigger before_ai_presets_update before update on public.ai_presets
  for each row execute function public.touch_updated_at();

alter table public.ai_presets enable row level security;
revoke all on public.ai_presets from anon, authenticated;
grant select (key, audience, label, description, output, topic_hint, position, active) on public.ai_presets to authenticated;
create policy "Signed-in users see active presets" on public.ai_presets
  for select to authenticated using (active);

-- Keep in step with src/lib/ai-presets.ts (the demo's copy).
insert into public.ai_presets (key, audience, label, description, output, topic_hint, position, instruction) values
  ('flashcards', 'student', 'Flashcards', 'A deck of cards to revise from', 'flashcards', 'Topic, e.g. cell structure', 10,
   'Make a deck of 8 flashcards on the TOPIC. If there is no topic, use the student''s next test or most urgent work in the CONTEXT. Fronts are short questions or prompts (under 15 words); backs are short, correct answers (under 25 words). Cover the key ideas, simplest first. Put a one sentence lead-in in answer.'),
  ('quiz', 'student', 'Quiz', '5 multiple-choice questions, marked as you go', 'quiz', 'Topic, e.g. quadratics', 20,
   'Write a 5 question multiple-choice quiz on the TOPIC, or with no topic on what the student is studying now (from the CONTEXT). Each question has 4 options with exactly one correct answer, believable wrong options, and a one sentence explanation of the right answer. Mix easy and harder questions. Put a one sentence lead-in in answer.'),
  ('plan', 'student', 'Study plan', 'A plan for tonight from your open work', 'plan', 'How long? e.g. 2 hours', 30,
   'Build a study plan from the student''s open tasks in the CONTEXT, most urgent first, that fits the time in the TOPIC (90 minutes if none is given). Fill plan with task ids and minutes, and summarise it in answer.'),
  ('explain', 'student', 'Explain simply', 'Any topic in plain words, with an example', 'chat', 'Topic, e.g. photosynthesis', 40,
   'Explain the TOPIC to a 13 year old in plain words: a short explanation, one everyday example, then one quick question to check understanding. With no topic, explain the hardest idea in the student''s current work.'),
  ('summary', 'student', 'Summarise', 'The key points of a topic or class', 'chat', 'Topic or class', 50,
   'Summarise the key points of the TOPIC (or of the class in focus) as 4 to 6 short lines starting with "• ". Use the CONTEXT first: teacher notes, flashcards and class posts.'),
  ('test-prep', 'student', 'Test prep', 'What to revise for your next test', 'chat', 'Which test? (optional)', 60,
   'Tell the student what to revise for their next test: what it covers (from TEACHER NOTES and class posts), the 3 most important things to practise, and one tip. Keep it encouraging.'),
  ('class-quiz', 'staff', 'Class quiz', '5 questions to use in a lesson', 'quiz', 'Topic, e.g. enzymes', 70,
   'Write a 5 question multiple-choice quiz on the TOPIC for the class in focus, at the right level for the year group. 4 options each, exactly one correct, with a one sentence explanation. With no topic, use the work the class is doing now.'),
  ('class-flashcards', 'staff', 'Class flashcards', 'A deck you can share with your class', 'flashcards', 'Topic, e.g. Cold War key terms', 80,
   'Make a deck of 10 flashcards on the TOPIC for the class in focus: short question fronts, short correct answers, at the right level for the year group. With no topic, use the class''s current work.'),
  ('instructions', 'staff', 'Draft instructions', 'Clear instructions for a piece of work', 'chat', 'Which task? (optional)', 90,
   'Draft clear instructions for the TOPIC task, or the next piece of work in the CONTEXT: what to do in one sentence, numbered steps, what to hand in, and how it will be checked.'),
  ('behind', 'staff', 'Who is behind?', 'Students missing recent work', 'chat', '', 100,
   'List the students who are behind on work due in the last two weeks, most missing first, as lines starting with "• ", and suggest one kind way to nudge them.'),
  ('check-first', 'staff', 'What to check first', 'The oldest work waiting for you', 'chat', '', 110,
   'Say which handed-in work to check first, oldest first, as lines starting with "• ", with how long each has waited.'),
  ('starter', 'staff', 'Lesson starter', 'A 5 minute activity to open a lesson', 'chat', 'Topic', 120,
   'Suggest a 5 minute lesson starter on the TOPIC (or the class''s current work): what students do, what you need, and a question to finish with.');

