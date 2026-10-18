import { diffDays, toISODate } from "./dates";
import { classById, isStaff, latestStudentPost, pendingReviews, priorityOf, roster, sortTasks, taskProgress, teaches } from "./selectors";
import type { AppState, ChatMessage, PlanRow, Source } from "./types";

// Offline stand-in for the AI study helper. It answers the two quick actions
// (study plan, quiz) from the student's own tasks and flashcards, and is
// honest that open questions need the real model. Replace `reply` with a call
// to the AI route once it exists; the message shape stays the same.

const MINUTES_BY_PRIORITY = { urgent: 40, today: 30, week: 25, later: 20 } as const;

function parseMinutes(text: string): number | null {
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  if (hours) return Math.round(parseFloat(hours[1]) * 60);
  if (/\ban hour\b/i.test(text)) return 60;
  if (/\bhalf an hour\b/i.test(text)) return 30;
  const mins = text.match(/(\d+)\s*(?:m|min|mins|minutes)\b/i);
  if (mins) return parseInt(mins[1], 10);
  return null;
}

function studyPlan(state: AppState, text: string, today: Date, classId: string | null): Omit<ChatMessage, "id" | "at"> {
  const budget = parseMinutes(text) ?? 90;
  const todayISO = toISODate(today);
  const open = sortTasks(
    state.tasks.filter((t) => t.status === "open" && (!classId || t.classId === classId)),
  );
  const plan: PlanRow[] = [];
  let used = 0;
  for (const task of open) {
    const p = priorityOf(task, todayISO) as keyof typeof MINUTES_BY_PRIORITY;
    const minutes = Math.min(MINUTES_BY_PRIORITY[p] ?? 20, budget - used);
    if (minutes < 10) break;
    plan.push({ minutes, title: task.title, classId: task.classId });
    used += minutes;
  }
  if (plan.length === 0) {
    return {
      role: "ai",
      text: classId
        ? `Nothing is open in ${classById(state, classId)?.name ?? "this class"} right now. Use the time to review a flashcard deck.`
        : "You have nothing open right now. Use the time to review a flashcard deck.",
    };
  }
  const label = budget >= 60 ? `${+(budget / 60).toFixed(1)} hour${budget === 60 ? "" : "s"}` : `${budget} minutes`;
  const spare = budget - used;
  return {
    role: "ai",
    text: `Here is a plan for your ${label}, most urgent first.${spare >= 10 ? ` That leaves ${spare} minutes for a break or a flashcard review.` : ""}`,
    plan,
    sources: plan.map((row) => ({ kind: "task", label: `Task: ${row.title}` }) satisfies Source),
  };
}

function quiz(state: AppState, classId: string | null): Omit<ChatMessage, "id" | "at"> {
  const decks = state.decks.filter((d) => !classId || d.classId === classId);
  const cards = decks.flatMap((d) => d.cards.map((c) => ({ deck: d.title, ...c })));
  if (cards.length === 0) {
    return { role: "ai", text: "There are no flashcards for this class yet. Ask your teacher to share a deck." };
  }
  // Rotate through cards so repeated "Quiz me" taps ask something new.
  const asked = state.chat.filter((m) => m.quiz).length;
  const card = cards[asked % cards.length];
  return {
    role: "ai",
    text: `From your ${card.deck} deck:`,
    quiz: { deck: card.deck, front: card.front, back: card.back },
    sources: [{ kind: "deck", label: `Flashcards: ${card.deck}` }],
  };
}

// ── Staff ───────────────────────────────────────────────────────────────────

function staffReply(state: AppState, text: string, now: Date): Omit<ChatMessage, "id" | "at"> {
  const lower = text.toLowerCase();
  const today = toISODate(now);
  const inScope = (classId: string | null) => teaches(state, classId) && (!state.aiContextClassId || classId === state.aiContextClassId);

  if (/behind|missing|nudge|who has(n't| not)/.test(lower)) {
    const late = state.tasks.filter((t) => inScope(t.classId) && t.due < today && diffDays(today, t.due) <= 14);
    const counts = new Map<string, { name: string; tasks: string[] }>();
    for (const t of late) {
      for (const m of roster(state, t.classId!)) {
        const sub = state.submissions.find((s) => s.taskId === t.id && s.studentId === m.userId);
        if (sub && sub.status !== "returned") continue;
        const entry = counts.get(m.userId) ?? { name: m.name, tasks: [] };
        entry.tasks.push(t.title);
        counts.set(m.userId, entry);
      }
    }
    const top = [...counts.values()].sort((a, b) => b.tasks.length - a.tasks.length).slice(0, 5);
    if (top.length === 0) return { role: "ai", text: "Nobody is behind. Everything due in the last two weeks has been handed in." };
    return {
      role: "ai",
      text: `Most behind on work due in the last two weeks:\n${top.map((e) => `• ${e.name}: ${e.tasks.join(", ")}`).join("\n")}\nA short reminder in the class discussion often does it.`,
      sources: late.map((t) => ({ kind: "task", label: `Task: ${t.title}` }) satisfies Source),
    };
  }

  if (/check|mark|verify|first/.test(lower)) {
    const queue = pendingReviews(state).filter((r) => inScope(r.task.classId));
    if (queue.length === 0) return { role: "ai", text: "Nothing is waiting to be checked." };
    const first = queue.slice(0, 4).map((r) => `• ${r.submission.studentName}, “${r.task.title}”, ${diffDays(today, r.submission.submittedAt.slice(0, 10))} day(s) ago`);
    return {
      role: "ai",
      text: `${queue.length} piece${queue.length === 1 ? "" : "s"} to check. Oldest first:\n${first.join("\n")}\nStudents only get their points once you verify.`,
      sources: [...new Set(queue.map((r) => r.task.title))].map((title) => ({ kind: "task", label: `Task: ${title}` }) satisfies Source),
    };
  }

  if (/instruction|draft|write/.test(lower)) {
    const next = sortTasks(state.tasks.filter((t) => inScope(t.classId) && t.due >= today))[0];
    const title = next?.title ?? "the next task";
    return {
      role: "ai",
      text: `A clear shape for “${title}”:\n1. What to do, in one sentence.\n2. Steps or questions, numbered.\n3. What to hand in (a file, a photo, a link).\n4. How it will be checked, so students know what “done” means.\nIn demo mode I cannot write the full text. Once the AI model is connected I will draft it from your notes.`,
      sources: next ? [{ kind: "task", label: `Task: ${next.title}` }] : [],
    };
  }

  if (/question|summar|discussion|asking/.test(lower)) {
    const latest = latestStudentPost(state);
    if (!latest) return { role: "ai", text: "No new questions from students." };
    return {
      role: "ai",
      text: `The newest question is from ${latest.post.author} in “${latest.thread.title}”: “${latest.post.body}”`,
      sources: [{ kind: "thread", label: latest.thread.title }],
    };
  }

  const next = sortTasks(state.tasks.filter((t) => inScope(t.classId) && t.due >= today))[0];
  const p = next ? taskProgress(state, next) : null;
  return {
    role: "ai",
    text: `I am running in demo mode, so I can only answer from your classes for now.${p && next ? ` “${next.title}” has ${p.handedIn} of ${p.total} handed in.` : ""} Try “Who is behind?”, “What should I check first?” or “Draft instructions”.`,
  };
}

export function reply(state: AppState, text: string, now: Date): Omit<ChatMessage, "id" | "at"> {
  if (isStaff(state)) return staffReply(state, text, now);
  const classId = state.aiContextClassId;
  const lower = text.toLowerCase();
  if (/\bplan\b|schedule|tonight|organi[sz]e/.test(lower)) return studyPlan(state, text, now, classId);
  if (/quiz|test me|flashcard question/.test(lower)) return quiz(state, classId);

  const mentioned = state.tasks.find((t) => lower.includes(t.title.toLowerCase()));
  if (mentioned) {
    const days = diffDays(mentioned.due, toISODate(now));
    const when = days < 0 ? "It is overdue" : days === 0 ? "It is due today" : `It is due in ${days} day${days === 1 ? "" : "s"}`;
    return {
      role: "ai",
      text: `${when}. Break it into two short sessions and tick it off when you hand it in, then your teacher can verify it. Detailed help on the content arrives once the AI model is connected.`,
      sources: [{ kind: "task", label: `Task: ${mentioned.title}` }],
    };
  }

  return {
    role: "ai",
    text: "I am running in demo mode, so I cannot answer open questions yet. Once the AI model is connected I will answer from your own notes, tasks and class threads. For now, try “Make a study plan” or “Quiz me”.",
  };
}
