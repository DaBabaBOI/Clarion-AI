import { diffDays, toISODate } from "./dates";
import { classById, priorityOf, sortTasks } from "./selectors";
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

export function reply(state: AppState, text: string, now: Date): Omit<ChatMessage, "id" | "at"> {
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
