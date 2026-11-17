import { diffDays, toISODate } from "./dates";
import { classById, isStaff, latestStudentPost, pendingReviews, priorityOf, roster, sortTasks, taskProgress, teaches } from "./selectors";
import type { AiPresetInfo, AppState, ChatMessage, GeneratedQuiz, PlanRow, Source } from "./types";

// Offline stand-in for the AI study helper, used by the demo. It answers the
// preset functions (flashcards, quizzes, study plans and more) from the
// sample tasks and flashcards, and is honest that open questions need the
// real model. Live mode calls the study-helper edge function instead; the
// message shape is the same.

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

// ── Presets ─────────────────────────────────────────────────────────────────

type Reply = Omit<ChatMessage, "id" | "at">;

/** Flashcards the demo can draw on: the class in focus, else every class, best match for the topic first. */
function cardPool(state: AppState, topic: string) {
  const classId = state.aiContextClassId;
  const decks = state.decks.filter((d) => !classId || d.classId === classId);
  const words = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  const score = (text: string) => words.filter((w) => text.toLowerCase().includes(w)).length;
  const ranked = decks
    .map((d) => ({ deck: d, score: score(d.title) * 3 + d.cards.reduce((n, c) => n + score(`${c.front} ${c.back}`), 0) }))
    .sort((a, b) => b.score - a.score);
  const matched = words.length > 0 && ranked[0]?.score > 0;
  return { decks: ranked.map((r) => r.deck), matched };
}

/** A small, repeatable shuffle so each quiz differs but tests stay stable. */
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let x = seed + 1;
  for (let i = out.length - 1; i > 0; i--) {
    x = (x * 9301 + 49297) % 233280;
    const j = Math.floor((x / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const DEMO_NOTE = "This is the demo, so it is built from your class flashcards; with Clarion connected, the AI writes it fresh on any topic.";

function flashcardsReply(state: AppState, topic: string, count: number): Reply {
  const { decks, matched } = cardPool(state, topic);
  if (!decks.length) return { role: "ai", text: "There are no flashcards in this class to build from yet." };
  const main = decks[0];
  const cards = [...main.cards, ...decks.slice(1).flatMap((d) => d.cards)].slice(0, count).map((c) => ({ front: c.front, back: c.back }));
  const title = matched || !topic ? main.title : topic;
  return {
    role: "ai",
    text: `Here is a deck of ${cards.length} cards on ${title}. ${matched || !topic ? "" : `I could not find “${topic}” in your notes, so these come from ${main.title}. `}${DEMO_NOTE}`,
    deck: { title: `${title} (Clarion)`, cards },
    sources: [{ kind: "deck", label: `Flashcards: ${main.title}` }],
  };
}

function quizReply(state: AppState, topic: string, count: number): Reply {
  const { decks, matched } = cardPool(state, topic);
  const main = decks[0];
  const cards = decks.flatMap((d) => d.cards.map((c) => ({ ...c, deck: d.title })));
  if (!main || cards.length < 4) return { role: "ai", text: "There are not enough flashcards in this class to build a quiz from yet." };
  const seed = state.chat.length;
  const picked = shuffled(main.cards.length >= count ? main.cards : cards, seed).slice(0, count);
  const questions: GeneratedQuiz["questions"] = picked.map((card, i) => {
    // Wrong options: other answers from the same deck first, never the right one twice.
    const others = [...shuffled(main.cards, seed + i), ...shuffled(cards, seed + i)].map((c) => c.back);
    const wrong = [...new Map(others.map((b) => [b.toLowerCase(), b])).values()].filter((b) => b.toLowerCase() !== card.back.toLowerCase()).slice(0, 3);
    const options = shuffled([card.back, ...wrong], seed * 7 + i);
    return {
      question: card.front,
      options,
      correct: options.indexOf(card.back),
      explanation: `From the ${main.title} deck: ${card.back}`,
    };
  });
  const title = matched || !topic ? main.title : topic;
  return {
    role: "ai",
    text: `${questions.length} questions on ${title}. Pick an answer to see if you are right. ${matched || !topic ? "" : `I could not find “${topic}” in your notes, so these are from ${main.title}. `}${DEMO_NOTE}`,
    mcq: { title: `${title} quiz`, questions },
    sources: [{ kind: "deck", label: `Flashcards: ${main.title}` }],
  };
}

function summaryReply(state: AppState, topic: string): Reply {
  const { decks } = cardPool(state, topic);
  const main = decks[0];
  if (!main) return { role: "ai", text: "There is nothing in this class to summarise yet." };
  return {
    role: "ai",
    text: `The key points of ${main.title}:\n${main.cards
      .slice(0, 6)
      .map((c) => `• ${c.back}`)
      .join("\n")}`,
    sources: [{ kind: "deck", label: `Flashcards: ${main.title}` }],
  };
}

function testPrepReply(state: AppState, now: Date): Reply {
  const today = toISODate(now);
  const classId = state.aiContextClassId;
  const test = sortTasks(state.tasks.filter((t) => /test|exam|quiz/i.test(t.title) && t.due >= today && (!classId || t.classId === classId)))[0];
  const decks = state.decks.filter((d) => (test ? d.classId === test.classId : !classId || d.classId === classId));
  const note = test?.classId ? state.classNotes[test.classId] : undefined;
  if (!test && !decks.length) return { role: "ai", text: "I cannot see a test coming up. Ask your teacher what the next one covers." };
  const days = test ? diffDays(test.due, today) : 0;
  return {
    role: "ai",
    text: `${test ? `${test.title} is ${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}.` : "No test is set yet, but these are worth practising."}${note ? ` Your teacher says: ${note.split("\n")[0]}` : ""}\nPractise these:\n${decks
      .slice(0, 3)
      .map((d) => `• ${d.title}: ${d.cards.length - Math.min(d.reviewed, d.cards.length)} card${d.cards.length - d.reviewed === 1 ? "" : "s"} still to review`)
      .join("\n")}\nTip: try the Quiz function on each topic, then redo the questions you got wrong.`,
    sources: [...(test ? [{ kind: "task", label: `Task: ${test.title}` } satisfies Source] : []), ...decks.slice(0, 3).map((d) => ({ kind: "deck", label: `Flashcards: ${d.title}` }) satisfies Source)],
  };
}

function starterReply(state: AppState, topic: string): Reply {
  const { decks } = cardPool(state, topic);
  const main = decks[0];
  const subject = topic || main?.title || "today's topic";
  const card = main?.cards[0];
  return {
    role: "ai",
    text: `A 5 minute starter on ${subject}:\n• Put one question on the board${card ? `: “${card.front}”` : ""}.\n• Students write an answer alone for 2 minutes, then compare with a partner for 2.\n• Take 2 or 3 answers and fix one common mistake together.\nFinish with: “What is one thing you are still unsure about?”`,
    sources: main ? [{ kind: "deck", label: `Flashcards: ${main.title}` }] : [],
  };
}

/** The demo's answer to a preset function. */
export function presetReply(state: AppState, preset: AiPresetInfo, topic: string, now: Date): Reply {
  switch (preset.key) {
    case "flashcards":
      return flashcardsReply(state, topic, 8);
    case "class-flashcards":
      return flashcardsReply(state, topic, 10);
    case "quiz":
    case "class-quiz":
      return quizReply(state, topic, 5);
    case "plan":
      return studyPlan(state, topic || "90 minutes", now, state.aiContextClassId);
    case "summary":
      return summaryReply(state, topic);
    case "test-prep":
      return testPrepReply(state, now);
    case "starter":
      return starterReply(state, topic);
    case "behind":
      return staffReply(state, "who is behind", now);
    case "check-first":
      return staffReply(state, "what should I check first", now);
    case "instructions":
      return staffReply(state, `draft instructions ${topic}`, now);
  }
  if (preset.output === "flashcards") return flashcardsReply(state, topic, 8);
  if (preset.output === "quiz") return quizReply(state, topic, 5);
  if (preset.output === "plan") return studyPlan(state, topic || "90 minutes", now, state.aiContextClassId);
  return {
    role: "ai",
    text: `In the demo I cannot write a full answer${topic ? ` about “${topic}”` : ""}. With Clarion connected, “${preset.label}” asks the AI to: ${preset.description.toLowerCase()}.`,
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
    text: `I am running in demo mode, so I can only answer from your classes for now.${p && next ? ` “${next.title}” has ${p.handedIn} of ${p.total} handed in.` : ""} Try a function below: “Who is behind?”, “What to check first” or “Class quiz”.`,
  };
}

export function reply(state: AppState, text: string, now: Date): Omit<ChatMessage, "id" | "at"> {
  if (isStaff(state)) return staffReply(state, text, now);
  const classId = state.aiContextClassId;
  const lower = text.toLowerCase();
  if (/\bplan\b|schedule|tonight|organi[sz]e/.test(lower)) return studyPlan(state, text, now, classId);
  const topic = text
    .replace(/^\s*(please\s+)?(can you\s+)?(quiz me|test me|give me a quiz|make (me )?(a )?(deck|quiz)( of flashcards)?|flashcards)(\s+(on|about|for))?/i, "")
    .replace(/[?.!]+$/, "")
    .trim();
  if (/quiz|test me/.test(lower)) return quizReply(state, topic, 5);
  if (/flashcard|\bdeck\b/.test(lower)) return flashcardsReply(state, topic, 8);

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
    text: "I am running in demo mode, so I cannot answer open questions yet. Once the AI model is connected I will answer from your own notes, tasks and class threads. For now, try a function below: Flashcards, Quiz or Study plan.",
  };
}
