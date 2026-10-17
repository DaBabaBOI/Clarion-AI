"use client";

import { useSyncExternalStore } from "react";
import { createDemoState, DEMO_VERSION } from "./demo-data";
import { toISODate } from "./dates";
import { balance } from "./selectors";
import { reply } from "./study-helper";
import type { AppState, ChatMessage, Task, Thread } from "./types";

// A tiny client-side store for the demo. State lives in memory and is saved
// to localStorage so the outline behaves like a real app between reloads.
// When Supabase is wired up, these actions become calls to the database and
// the components keep the same shape.

const STORAGE_KEY = "clarion-demo";

type Listener = () => void;

let state: AppState | null = null;
const listeners = new Set<Listener>();

function load(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === DEMO_VERSION) return parsed;
    }
  } catch {
    // Private mode or corrupted data: fall back to fresh demo content.
  }
  return createDemoState(new Date());
}

function save(next: AppState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked; the app still works for this session.
  }
}

function current(): AppState {
  if (!state) state = load();
  return state;
}

function setState(update: (s: AppState) => AppState) {
  state = update(current());
  save(state);
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getServerSnapshot(): AppState | null {
  return null;
}

/**
 * Returns null during server rendering and hydration, then the live state.
 * Demo dates depend on the visitor's clock, so data-driven UI only renders in
 * the browser; the app shell shows skeletons until then.
 */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, current, getServerSnapshot);
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function mapTask(s: AppState, id: string, fn: (t: Task) => Task): AppState {
  return { ...s, tasks: s.tasks.map((t) => (t.id === id ? fn(t) : t)) };
}

function mapThread(s: AppState, id: string, fn: (t: Thread) => Thread): AppState {
  return { ...s, threads: s.threads.map((t) => (t.id === id ? fn(t) : t)) };
}

export const actions = {
  /**
   * Ticking a task hands it in; it does not award points. Points only arrive
   * when a teacher verifies the task (the anti-gaming rule from the brief).
   * A handed-in task can be un-ticked until it is verified.
   */
  toggleTask(id: string) {
    setState((s) =>
      mapTask(s, id, (t) => {
        if (t.status === "open") return { ...t, status: "submitted", submittedAt: new Date().toISOString() };
        if (t.status === "submitted") return { ...t, status: "open", submittedAt: undefined };
        return t;
      }),
    );
  },

  addTask(input: { title: string; classId: string | null; due: string }) {
    setState((s) => ({
      ...s,
      tasks: [
        ...s.tasks,
        {
          id: uid("t"),
          classId: input.classId,
          title: input.title.trim(),
          setOn: toISODate(new Date()),
          due: input.due,
          // Students cannot award themselves points; teachers set point values.
          points: 0,
          status: "open",
        },
      ],
    }));
  },

  openThread(id: string) {
    setState((s) => ({ ...mapThread(s, id, (t) => ({ ...t, unread: 0 })), selectedThreadId: id }));
  },

  postReply(threadId: string, body: string) {
    const text = body.trim();
    if (!text) return;
    setState((s) =>
      mapThread(s, threadId, (t) => ({
        ...t,
        posts: [
          ...t.posts,
          { id: uid("p"), author: s.student.shortName, role: "student", body: text, at: new Date().toISOString(), mine: true },
        ],
      })),
    );
  },

  createThread(input: { classId: string; title: string; body: string; visibility: "public" | "direct" }) {
    const id = uid("th");
    setState((s) => ({
      ...s,
      selectedThreadId: id,
      discussionClassId: null,
      threads: [
        {
          id,
          classId: input.classId,
          title: input.title.trim(),
          pinned: false,
          visibility: input.visibility,
          unread: 0,
          posts: [
            {
              id: uid("p"),
              author: s.student.shortName,
              role: "student",
              body: input.body.trim(),
              at: new Date().toISOString(),
              mine: true,
            },
          ],
        },
        ...s.threads,
      ],
    }));
    return id;
  },

  setDiscussionClass(classId: string | null) {
    setState((s) => ({ ...s, discussionClassId: classId }));
  },

  setAiContext(classId: string | null) {
    setState((s) => ({ ...s, aiContextClassId: classId }));
  },

  ask(text: string) {
    const question = text.trim();
    if (!question) return;
    const now = new Date();
    setState((s) => {
      const user: ChatMessage = { id: uid("m"), role: "user", text: question, at: now.toISOString() };
      const withUser = { ...s, chat: [...s.chat, user] };
      const answer: ChatMessage = { ...reply(withUser, question, now), id: uid("m"), at: now.toISOString() };
      return { ...withUser, chat: [...withUser.chat, answer] };
    });
  },

  clearChat() {
    setState((s) => ({ ...s, chat: s.chat.slice(0, 1) }));
  },

  /** Returns false when the student cannot afford the reward. */
  redeem(rewardId: string): boolean {
    const s = current();
    const reward = s.rewards.find((r) => r.id === rewardId);
    if (!reward || balance(s) < reward.cost || s.redemptions.some((r) => r.rewardId === rewardId)) return false;
    const now = new Date();
    setState((prev) => ({
      ...prev,
      ledger: [...prev.ledger, { id: uid("l"), date: toISODate(now), points: -reward.cost, label: reward.title }],
      redemptions: [
        ...prev.redemptions,
        { rewardId, at: now.toISOString(), status: reward.needsTeacher ? "requested" : "unlocked" },
      ],
    }));
    return true;
  },

  setLeaderboardVisibility(visible: boolean) {
    setState((s) => ({ ...s, showOnLeaderboard: visible }));
  },

  reviewCard(deckId: string) {
    setState((s) => ({
      ...s,
      decks: s.decks.map((d) => (d.id === deckId ? { ...d, reviewed: Math.min(d.cards.length, d.reviewed + 1) } : d)),
    }));
  },

  restartDeck(deckId: string) {
    setState((s) => ({ ...s, decks: s.decks.map((d) => (d.id === deckId ? { ...d, reviewed: 0 } : d)) }));
  },

  resetDemo() {
    setState(() => createDemoState(new Date()));
  },
};
