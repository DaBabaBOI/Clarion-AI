# Clarion AI

One place for school: every deadline across every class, an AI study helper that knows the student's own work, class discussions, and rewards that only pay out once a teacher verifies the task.

Built from the Figma file **Clarion — Final Design (Strand 4)** and the MYP Design criteria A–B write-up.

## Run it

```bash
npm install
cp .env.example .env.local   # Supabase URL + publishable key (safe for the browser)
npm run dev                  # http://localhost:3000
```

`npm run build && npm start` for a production build. `npm run lint` before pushing.

The app currently runs on **demo data** stored in the browser (`localStorage`), so every screen works without signing in. Dates are generated relative to today, so "Overdue", "Tomorrow" and the streak always read correctly. Use the avatar menu → **Reset demo data** to start over.

## Screens

| Route | What it does |
| --- | --- |
| `/sign-in` | Sign in or join a class with a six character code (demo: any email works) |
| `/dashboard` | Stats, task list with hand-in checkboxes, week strip, "Clarion suggests", latest teacher post, add task |
| `/classes` | One card per class: tasks due, new posts, flashcards, next deadline |
| `/classes/[id]` | Deadlines, class discussions, flashcard flip and review, "Ask Clarion about this class" |
| `/ai` | Priority list (urgent → done), chat with study-plan and quiz quick actions, sources card |
| `/discussions` | Searchable, filterable inbox across classes; public and direct threads; reply composer |
| `/road-to-glory` | Gamification, redesigned (see below) |

The AI helper runs offline for now: study plans and quizzes are built from the student's own tasks and flashcards, and open questions get an honest "demo mode" reply. `src/lib/study-helper.ts` is the one place to swap in a real model.

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
| `20261017050000_split_write_policies.sql` | **Pending.** Paste it into the Supabase SQL editor, or run `supabase db push`. It only clears a performance advisor warning. |

What the database enforces, regardless of what the browser does:

- Students can only hand work in (`task_submissions.status = 'submitted'`). Only a teacher of that class can verify it, and only verification writes points to the append-only `points_ledger` (trigger `pay_out_verified_submission`). Teachers cannot hand in their own class's work.
- Personal reminders can never carry points.
- Joining a class goes through `join_class(code)`; spending through `redeem_reward(id)`, which locks per student to stop double spending. Declined requests are refunded.
- Direct threads are visible only to the author and the class teachers. Class teachers can review AI chats for safety; assistant replies can only be written by the server.
- Policy helpers live in a `private` schema the API does not expose. The only callable functions are `join_class`, `redeem_reward`, `class_leaderboard` and `school_leaderboard`.
- `posts` and `threads` are in the realtime publication for live discussions.

Clients are ready in `src/lib/supabase/` (`client.ts` for the browser, `server.ts` for the server) with generated types in `database.types.ts`. The UI still reads the demo store (`src/lib/store.ts`); its action names match the database operations so the switch is contained to the data layer.

## Project layout

```
src/
  app/                 routes (App Router, Next.js 16)
    (app)/             signed-in area with the top bar + sidebar shell
    sign-in/
  components/          UI by feature (dashboard, classes, ai, discussions, glory, shell)
  lib/
    store.ts           demo store and actions
    demo-data.ts       demo content, relative to today
    selectors.ts       derived numbers shared by every screen
    study-helper.ts    offline stand-in for the AI
    supabase/          Supabase clients and generated types
supabase/migrations/   database schema and policies
```
