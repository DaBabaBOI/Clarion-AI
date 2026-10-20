# Clarion AI

One place for school: every deadline across every class, an AI study helper that knows the student's own work, class discussions, and rewards that only pay out once a teacher verifies the task.

Built from the Figma file **Clarion — Final Design (Strand 4)** and the MYP Design criteria A–B write-up.

## Run it

```bash
npm install
cp .env.example .env.local   # Supabase URL + publishable key (safe for the browser)
npm run dev                  # http://localhost:3000
```

`npm run build` writes the finished site to `out/` as plain static files (there is no server: every screen talks to Supabase from the browser). `npm run lint` before pushing.

## Put it online (GitHub Pages)

`.github/workflows/deploy-pages.yml` builds the site and publishes it on every push to the default branch.

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions** (once).
2. **Actions → Deploy to GitHub Pages → Run workflow** (or push). The link is shown on the run and in Settings → Pages: `https://dabababoi.github.io/Clarion-AI/`.
3. Supabase **Authentication → URL Configuration**: set **Site URL** to that link and add `https://dabababoi.github.io/Clarion-AI/**` under **Redirect URLs** (Google sign-in returns to `/auth/callback/`).

Email and password sign-in works as soon as step 2 finishes. The same `out/` folder can go on any static host.

There are two ways in:

- **Sign in** with a school account. Everything is read from and written to Supabase as that user, so row level security decides what they see.
- **Explore the demo** (on the sign-in screen) runs on sample data stored in the browser, as a **student**, a **teacher** or a **coordinator**. The avatar menu switches between the three and has **Reset demo data**.

### Test school

The `clarion-ai` project has a test school seeded by `supabase/seed/test_school.sql`:

| Account | Role |
| --- | --- |
| `prithu1606@gmail.com` | Principal (admin) and teacher of all four classes |
| `prithu1606+student@gmail.com` | Student (Year 9) in all four classes |

Passwords were shared privately, not committed. Sign in as the student to hand work in; sign in as the teacher and open a class to **verify** it (that is the only way points are paid) or **set work** with points. Class codes: Biology `7K2H9B`, Maths `M9X4QT`, English `E9R2WK`, History `H9P7LN`.

### Clarion International School

A full school to use Clarion with, made by `supabase/seed/clarion_international.sql`. Every account shares one password (shared privately, not committed). All addresses are Gmail "+" aliases, so password resets arrive in the owner's inbox.

| Account | Role | Classes |
| --- | --- | --- |
| `prithu1606+coordinator@gmail.com` | Coordinator: Nandini Rao | School overview, teaches English 9 |
| `prithu1606+kaushal@gmail.com` | Teacher: Anjali Kaushal | Biology 9, Biology 10 |
| `prithu1606+iyer@gmail.com` | Teacher: Vikram Iyer | Maths 9 |
| `prithu1606+khan@gmail.com` | Teacher: Farah Khan | Maths 10 |
| `prithu1606+mathew@gmail.com` | Teacher: Daniel Mathew | English 10 |
| `prithu1606+banerjee@gmail.com` | Teacher: Sourav Banerjee | History 9, History 10 |
| `prithu1606+<first name>@gmail.com` | 12 Year 9 students (Ananya, Rohan, Zara, Aarav, Meera, Kabir, Ishaan, Diya, Vihaan, Saanvi, Arjun, Tara) | All four Year 9 classes |
| `prithu1606+<first name>@gmail.com` | 12 Year 10 students (Aditya, Riya, Sameer, Anika, Neel, Pooja, Yash, Ira, Karan, Leela, Om, Myra) | All four Year 10 classes |

It is a blank sheet: every class has its teacher and students and three rewards are on offer, but there is no work, hand-ins, points, discussions or flashcards yet. Class codes: `BIO9KX`, `MAT9QT`, `ENG9LP`, `HIS9VD`, `BIO10Z`, `MAT10W`, `ENG10R`, `HIS10S`.

The seed file also fills the school with sample activity (34 pieces of work, about 200 hand-ins, points, discussions and flashcards). `supabase/seed/clarion_international_clear.sql` empties it back to a blank sheet, keeping the accounts, classes and rewards.

Google sign-in appears on the sign-in screen automatically once the Google provider is switched on in Supabase (Authentication → Providers → Google, redirect `https://miulgjlrdxzveufoxkmj.supabase.co/auth/v1/callback`), as long as the site's address is in the Redirect URLs (see above; add `http://localhost:3000/**` too for local development).

## Screens

| Route | What it does |
| --- | --- |
| `/sign-in` | Sign in, join a class with a six character code, or explore the demo |
| `/dashboard` | Stats, task list with hand-in checkboxes, week strip, "Clarion suggests", latest teacher post, add task. Click a task to open it, or its class chip to open the class |
| `/tasks/view?id=` | One task: instructions, attachments from the teacher, and **Your work**: attach files or links, then hand in (and see it checked) |
| `/classes` | One card per class: tasks due, new posts, flashcards, next deadline |
| `/classes/view?id=` | Deadlines, class discussions, flashcard flip and review, "Ask Clarion about this class" |
| `/ai` | Priority list (urgent → done), chat with study-plan and quiz quick actions, sources card |
| `/discussions` | Searchable, filterable inbox across classes; public and direct threads; reply composer |
| `/road-to-glory` | Gamification, redesigned (see below) |

The AI helper uses **Gemini** through the `study-helper` Edge Function (`supabase/functions/study-helper`). It runs as the signed-in user: a student's question is answered from only their tasks, flashcards and class posts; a teacher's from the classes they teach (work set, who has handed in, work waiting, student questions). It returns the sources it actually used, stores every exchange for teacher review, and rate-limits to 8 questions a minute. It reads the `GEMINI_API_KEY` secret; set `GEMINI_MODEL` to pin a model (default `gemini-flash-latest`). Redeploy after edits with `supabase functions deploy study-helper --no-verify-jwt` (the function checks the user itself). In demo mode the helper answers offline from `src/lib/study-helper.ts`.

### Teachers and coordinators

The same screens, with the widgets swapped for the job. The signed-in user's role (or the demo picker) decides which version shows.

| Screen | Teacher | Coordinator (admin) adds |
| --- | --- | --- |
| Dashboard | To check (handed-in work with its files, Verify or Return), Work you set (who has handed in), the week's deadlines, reward requests, latest student question | School overview: every class with students, due this week, waiting to be checked, missing work, verified this week. Counts only, flagged when work waits 3+ days |
| Task page | Edit instructions, attach resources, class progress, the to-check list and everyone else's status | |
| My classes / class page | To-check counts, class code, class list with hand-in counts | |
| AI Helper | What needs you first, "Who is behind?", "What should I check first?", "Draft instructions" | |
| Road to Glory | Class leaderboards, approve or decline reward requests, how many students sit at each level | |

The top bar shows "N to check" instead of the streak and points.

### Attachments

Teachers attach files (PDF, images, documents, slides, spreadsheets, audio or video, up to 10 MB) or links to a task. Students attach their own work the same way and hand it in; the teacher sees it next to Verify and Return. Files live in the private `task-files` storage bucket, and a row in `task_attachments` is what grants access to its file, so a student only ever opens the class's resources and their own work. In the demo, added files stay in the browser (up to 750 KB) and the sample PDFs come from `public/demo/`.

### Road to Glory changes

Compared with the Figma frame (which followed wireframe 2):

- **The road**: a level path (Starter → Explorer → Achiever → Scholar → Legend) driven by lifetime verified points, so there is a goal beyond the weekly streak.
- **Waiting for your teacher**: the anti-gaming rule is shown as a live queue of handed-in work instead of a static info card.
- **Leaderboard privacy**: a "Show my name" switch; the school board is anonymised.
- **Spending never lowers rank**: ranks use points earned, the top bar shows points available to spend. Class-affecting rewards wait for teacher approval.

## Design tokens

Colours, radii and gradients live in `src/app/globals.css` (`@theme`), taken from the Figma file and the Strand 4 planning table: cool, bright surfaces (`#F7F8FC`, `#EFEDFF`, `#E8F1FF`), brand gradient `#6D5DFB → #3B82F6`, amber `#EF8B09` reserved for urgency. Font: Inter. The logo and sidebar icons use the vector paths exported from Figma (`src/components/icons.tsx`).

## Supabase

Project: **clarion-ai** (`miulgjlrdxzveufoxkmj`, Mumbai `ap-south-1`).

The schema is in `supabase/migrations`:

| File | Status |
| --- | --- |
| `20261017043927_initial_schema.sql` | Applied |
| `20261017044553_private_helpers.sql` | Applied |
| `20261017050659_classmates_leaderboard.sql` | Applied |
| `20261017090000_split_write_policies.sql` | **Pending.** Paste it into the Supabase SQL editor, or run `supabase db push`. It only clears a performance advisor warning. |
| `20261018060717_task_attachments.sql` | Applied. Attachments, the `task-files` bucket, re-handing in returned work |
| `20261018061057_school_overview.sql` | Applied. The coordinator's `school_overview()` |

`supabase/seed/task_details.sql` adds instructions and resource links to the test school's work.

What the database enforces, regardless of what the browser does:

- Students can only hand work in (`task_submissions.status = 'submitted'`). Only a teacher of that class can verify it, and only verification writes points to the append-only `points_ledger` (trigger `pay_out_verified_submission`). Teachers cannot hand in their own class's work. Returned work can be handed in again, only back to `submitted`.
- Attachments: teachers add resources to their classes' work, students add work only to their own hand-ins and only until it is verified. Storage access follows the attachment rows.
- `school_overview()` only answers coordinators, and only with counts.
- Personal reminders can never carry points.
- Joining a class goes through `join_class(code)`; spending through `redeem_reward(id)`, which locks per student to stop double spending. Declined requests are refunded.
- Direct threads are visible only to the author and the class teachers. Class teachers can review AI chats for safety; assistant replies can only be written by the server.
- Policy helpers live in a `private` schema the API does not expose. The only callable functions are `join_class`, `redeem_reward`, `class_leaderboard`, `classmates_leaderboard`, `school_leaderboard` and `school_overview`.
- `posts` and `threads` are in the realtime publication for live discussions.

Clients live in `src/lib/supabase/` with generated types in `database.types.ts`. `src/lib/live/load.ts` reads everything for the signed-in user and shapes it like the demo data, and `src/lib/store.ts` runs each action against the screen first, then the database, then reloads. New discussion posts arrive over Supabase Realtime.

## Project layout

```
src/
  app/                 routes (App Router, Next.js 16)
    (app)/             signed-in area with the top bar + sidebar shell
    sign-in/
  components/          UI by feature (dashboard, tasks, classes, ai, discussions, glory, shell)
  lib/
    store.ts           store and actions (live or demo)
    live/load.ts       reads the signed-in user's data from Supabase
    demo-data.ts       demo content, relative to today (demo-staff.ts: the teacher and coordinator side)
    selectors.ts       derived numbers shared by every screen
    study-helper.ts    offline stand-in for the AI
    supabase/          Supabase clients and generated types
.github/workflows/     GitHub Pages deploy
supabase/
  migrations/          database schema and policies
  functions/           study-helper Edge Function (Gemini)
  seed/                test school content
```
