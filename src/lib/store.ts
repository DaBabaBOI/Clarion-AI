"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { toast } from "./client-hooks";
import { createDemoState, DEMO_VERSION } from "./demo-data";
import { toISODate } from "./dates";
import { greeting, loadLiveState, NotSignedInError } from "./live/load";
import { balance } from "./selectors";
import { reply } from "./study-helper";
import { getSupabase, isSupabaseConfigured } from "./supabase/client";
import type { AppState, ChatMessage, Task, Thread } from "./types";

// One store, two sources:
//  • live: Supabase, as the signed-in user. Actions update the screen at once,
//    write to the database, then reload so the database stays the truth.
//  • demo: sample data in localStorage, for trying Clarion without an account.

const STORAGE_KEY = "clarion-demo";
const MODE_KEY = "clarion-mode";
const JOIN_KEY = "clarion-join-code";

export type StoreStatus = "idle" | "loading" | "ready" | "signed-out" | "error";

type Listener = () => void;

let state: AppState | null = null;
let status: StoreStatus = "idle";
let lastError = "";
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Null until the store has loaded (and always null during server rendering). */
export function useAppState(): AppState | null {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
}

export function useStoreStatus(): { status: StoreStatus; error: string } {
  const s = useSyncExternalStore(
    subscribe,
    () => status,
    () => "idle" as StoreStatus,
  );
  return { status: s, error: lastError };
}

// ── Demo persistence ────────────────────────────────────────────────────────

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private mode or storage full: the app still works for this session.
  }
}

function loadDemo(): AppState {
  const raw = readLocal(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === DEMO_VERSION) return parsed;
    } catch {
      // Corrupted data: start again.
    }
  }
  return createDemoState(new Date());
}

function setState(update: (s: AppState) => AppState) {
  if (!state) return;
  state = update(state);
  if (state.mode === "demo") writeLocal(STORAGE_KEY, JSON.stringify(state));
  emit();
}

// ── Loading and live sync ───────────────────────────────────────────────────

let initPromise: Promise<StoreStatus> | null = null;
let channel: RealtimeChannel | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function initStore(): Promise<StoreStatus> {
  initPromise ??= (async () => {
    status = "loading";
    emit();
    try {
      if (isSupabaseConfigured) {
        const {
          data: { session },
        } = await getSupabase().auth.getSession();
        if (session) {
          state = await loadLiveState(null);
          status = "ready";
          emit();
          startRealtime();
          await joinPendingCode();
          return status;
        }
      }
      if (readLocal(MODE_KEY) === "demo") {
        state = loadDemo();
        status = "ready";
        emit();
        return status;
      }
      status = "signed-out";
    } catch (e) {
      status = e instanceof NotSignedInError ? "signed-out" : "error";
      lastError = e instanceof Error ? e.message : "Something went wrong";
      initPromise = null;
    }
    emit();
    return status;
  })();
  return initPromise;
}

/** Forget everything loaded, e.g. after signing in or out. */
export function resetStore() {
  state = null;
  status = "idle";
  initPromise = null;
  if (channel) void getSupabase().removeChannel(channel);
  channel = null;
  emit();
}

async function refresh() {
  if (!state || state.mode !== "live") return;
  try {
    state = await loadLiveState(state);
    emit();
  } catch (e) {
    if (e instanceof NotSignedInError) {
      resetStore();
      return;
    }
    toast("Could not refresh. Check your connection.");
  }
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => void refresh(), 400);
}

/** New discussion posts arrive without reloading (spec: under 10 seconds). */
function startRealtime() {
  if (channel) return;
  channel = getSupabase()
    .channel("clarion-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "threads" }, scheduleRefresh)
    .subscribe();
}

type DbResult = { error: { message: string } | null };

/** Runs a database write in live mode, then reloads. Failures roll back by reloading. */
async function sync(write: () => PromiseLike<DbResult>, failure: string): Promise<boolean> {
  if (!state || state.mode !== "live") return true;
  let ok = true;
  try {
    const { error } = await write();
    if (error) throw new Error(error.message);
  } catch (e) {
    ok = false;
    toast(`${failure}${e instanceof Error && e.message ? `: ${e.message}` : ""}`);
  }
  await refresh();
  return ok;
}

function me(): string {
  return state?.student.id ?? "";
}

async function joinPendingCode() {
  const code = readLocal(JOIN_KEY);
  if (!code) return;
  writeLocal(JOIN_KEY, null);
  const result = await actions.joinClass(code);
  toast(result.message, result.ok ? "success" : "default");
}

// ── Auth ────────────────────────────────────────────────────────────────────

export const auth = {
  async signIn(email: string, password: string): Promise<string | null> {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (error.message === "Invalid login credentials") return "That email and password do not match.";
      if (error.name === "AuthRetryableFetchError" || /fetch/i.test(error.message)) {
        return "Could not reach Clarion. Check your internet connection and try again.";
      }
      return error.message;
    }
    writeLocal(MODE_KEY, null);
    resetStore();
    return null;
  },

  async signInWithGoogle(): Promise<string | null> {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    return error?.message ?? null;
  },

  /** Remember a class code so it is joined straight after signing in. */
  rememberJoinCode(code: string) {
    writeLocal(JOIN_KEY, code);
  },

  startDemo() {
    writeLocal(MODE_KEY, "demo");
    resetStore();
  },

  async signOut() {
    if (isSupabaseConfigured) await getSupabase().auth.signOut();
    writeLocal(MODE_KEY, null);
    resetStore();
  },
};

// ── Actions ─────────────────────────────────────────────────────────────────

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
   * Ticking class work hands it in; it does not award points. Points only
   * arrive when a teacher verifies it (the anti-gaming rule from the brief).
   * Handed-in work can be taken back until it is verified. Personal
   * reminders simply toggle between open and done.
   */
  toggleTask(id: string) {
    const task = state?.tasks.find((t) => t.id === id);
    if (!task || (task.classId && task.status === "verified")) return;
    const wasOpen = task.status === "open";
    setState((s) =>
      mapTask(s, id, (t) => {
        if (!t.classId) return { ...t, status: wasOpen ? "verified" : "open" };
        return wasOpen
          ? { ...t, status: "submitted", submittedAt: new Date().toISOString() }
          : { ...t, status: "open", submittedAt: undefined };
      }),
    );
    void sync(
      () =>
        wasOpen
          ? getSupabase().from("task_submissions").insert({ task_id: id, student_id: me() })
          : getSupabase().from("task_submissions").delete().eq("task_id", id).eq("student_id", me()),
      wasOpen ? "Could not hand that in" : "Could not take that back",
    );
  },

  /** Students add personal reminders; teachers can set class work with points. */
  async addTask(input: { title: string; classId: string | null; due: string; points?: number }) {
    const title = input.title.trim();
    if (state?.mode === "live") {
      const today = toISODate(new Date());
      return sync(
        () =>
          input.classId
            ? getSupabase()
                .from("tasks")
                .insert({ class_id: input.classId, title, due_on: input.due, set_on: today, points: input.points ?? 0 })
            : getSupabase().from("tasks").insert({ owner_id: me(), title, due_on: input.due, set_on: today }),
        "Could not add the task",
      );
    }
    setState((s) => ({
      ...s,
      tasks: [
        ...s.tasks,
        {
          id: uid("t"),
          classId: input.classId,
          title,
          setOn: toISODate(new Date()),
          due: input.due,
          points: input.classId ? (input.points ?? 0) : 0,
          status: "open",
        },
      ],
    }));
    return true;
  },

  openThread(id: string) {
    const hadUnread = (state?.threads.find((t) => t.id === id)?.unread ?? 0) > 0;
    setState((s) => ({ ...mapThread(s, id, (t) => ({ ...t, unread: 0 })), selectedThreadId: id }));
    if (hadUnread) {
      void sync(
        () =>
          getSupabase()
            .from("thread_reads")
            .upsert({ thread_id: id, user_id: me(), last_read_at: new Date().toISOString() }, { onConflict: "thread_id,user_id" }),
        "Could not mark the thread as read",
      );
    }
  },

  postReply(threadId: string, body: string) {
    const text = body.trim();
    if (!text) return;
    setState((s) =>
      mapThread(s, threadId, (t) => ({
        ...t,
        posts: [
          ...t.posts,
          { id: uid("p"), author: s.student.fullName, role: s.teachingClassIds.includes(t.classId) ? "teacher" : "student", body: text, at: new Date().toISOString(), mine: true },
        ],
      })),
    );
    void sync(() => getSupabase().from("posts").insert({ thread_id: threadId, body: text }), "Could not post your reply");
  },

  async createThread(input: { classId: string; title: string; body: string; visibility: "public" | "direct" }): Promise<string | null> {
    if (state?.mode === "live") {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("threads")
        .insert({ class_id: input.classId, title: input.title.trim(), visibility: input.visibility })
        .select("id")
        .single();
      if (error || !data) {
        toast(`Could not start the thread${error ? `: ${error.message}` : ""}`);
        return null;
      }
      await sb.from("posts").insert({ thread_id: data.id, body: input.body.trim() });
      setState((s) => ({ ...s, selectedThreadId: data.id, discussionClassId: null }));
      await refresh();
      return data.id;
    }
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
          posts: [{ id: uid("p"), author: s.student.fullName, role: "student", body: input.body.trim(), at: new Date().toISOString(), mine: true }],
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

  async ask(text: string, mode: "chat" | "plan" | "quiz" = "chat") {
    const question = text.trim();
    if (!question || !state) return;
    const now = new Date();
    const user: ChatMessage = { id: uid("m"), role: "user", text: question, at: now.toISOString() };

    if (state.mode === "demo") {
      setState((s) => {
        const withUser = { ...s, chat: [...s.chat, user] };
        const answer: ChatMessage = { ...reply(withUser, question, now), id: uid("m"), at: now.toISOString() };
        return { ...withUser, chat: [...withUser.chat, answer] };
      });
      return;
    }

    const pendingId = uid("m");
    setState((s) => ({
      ...s,
      chat: [...s.chat, user, { id: pendingId, role: "ai", text: "", at: now.toISOString(), pending: true }],
    }));

    const { data, error } = await getSupabase().functions.invoke("study-helper", {
      body: { message: question, mode, conversationId: state.conversationId, classId: state.aiContextClassId, today: toISODate(now) },
    });

    let answer: ChatMessage;
    if (error || !data) {
      let message = "The AI helper could not answer right now. Try again in a moment.";
      try {
        const body = await (error as { context?: Response })?.context?.json();
        if (body?.error) message = body.error;
      } catch {
        // Keep the generic message.
      }
      answer = { id: pendingId, role: "ai", text: message, at: new Date().toISOString(), error: true };
    } else {
      answer = {
        id: pendingId,
        role: "ai",
        text: data.answer,
        at: new Date().toISOString(),
        sources: data.sources ?? [],
        plan: data.plan ?? undefined,
        quiz: data.quiz ?? undefined,
      };
    }
    setState((s) => ({
      ...s,
      conversationId: data?.conversationId ?? s.conversationId,
      chat: s.chat.map((m) => (m.id === pendingId ? answer : m)),
    }));
  },

  clearChat() {
    setState((s) =>
      s.mode === "live"
        ? { ...s, conversationId: null, chat: [greeting(s, new Date())] }
        : { ...s, chat: s.chat.slice(0, 1) },
    );
  },

  /** Returns false when the student cannot afford the reward. */
  redeem(rewardId: string): boolean {
    const s = state;
    const reward = s?.rewards.find((r) => r.id === rewardId);
    if (!s || !reward || balance(s) < reward.cost || s.redemptions.some((r) => r.rewardId === rewardId)) return false;
    const now = new Date();
    setState((prev) => ({
      ...prev,
      ledger: [...prev.ledger, { id: uid("l"), date: toISODate(now), points: -reward.cost, label: reward.title, source: "reward" }],
      redemptions: [...prev.redemptions, { rewardId, at: now.toISOString(), status: reward.needsTeacher ? "requested" : "unlocked" }],
    }));
    void sync(() => getSupabase().rpc("redeem_reward", { target_reward: rewardId }), "Could not redeem that reward");
    return true;
  },

  setLeaderboardVisibility(visible: boolean) {
    setState((s) => ({ ...s, showOnLeaderboard: visible }));
    void sync(() => getSupabase().from("profiles").update({ show_on_leaderboard: visible }).eq("id", me()), "Could not save that setting");
  },

  reviewCard(deckId: string, cardId: string, knew: boolean) {
    setState((s) => ({
      ...s,
      decks: s.decks.map((d) => (d.id === deckId ? { ...d, reviewed: Math.min(d.cards.length, d.reviewed + 1) } : d)),
    }));
    if (state?.mode === "live") {
      void getSupabase()
        .from("flashcard_reviews")
        .upsert(
          { card_id: cardId, user_id: me(), result: knew ? "good" : "again", reviewed_at: new Date().toISOString() },
          { onConflict: "card_id,user_id" },
        )
        .then(({ error }) => error && toast("Could not save your review"));
    }
  },

  restartDeck(deckId: string) {
    const cardIds = state?.decks.find((d) => d.id === deckId)?.cards.map((c) => c.id) ?? [];
    setState((s) => ({ ...s, decks: s.decks.map((d) => (d.id === deckId ? { ...d, reviewed: 0 } : d)) }));
    if (state?.mode === "live" && cardIds.length) {
      void getSupabase()
        .from("flashcard_reviews")
        .delete()
        .eq("user_id", me())
        .in("card_id", cardIds)
        .then(({ error }) => error && toast("Could not restart the deck"));
    }
  },

  async joinClass(code: string): Promise<{ ok: boolean; message: string }> {
    const clean = code.trim().toUpperCase();
    const existing = state?.classes.find((c) => c.code === clean);
    if (existing) return { ok: false, message: `You are already in ${existing.name}.` };
    if (state?.mode !== "live") return { ok: false, message: "Sign in with your school account to join a real class." };
    const { data, error } = await getSupabase().rpc("join_class", { code: clean });
    if (error) return { ok: false, message: error.message };
    await refresh();
    const joined = state?.classes.find((c) => c.id === data);
    return { ok: true, message: `Joined ${joined?.name ?? "the class"}` };
  },

  /** Teachers: verify handed-in work (pays the points) or return it. */
  reviewSubmission(submissionId: string, verdict: "verified" | "returned") {
    setState((s) => ({ ...s, pendingReviews: s.pendingReviews.filter((r) => r.submissionId !== submissionId) }));
    void sync(
      () => getSupabase().from("task_submissions").update({ status: verdict }).eq("id", submissionId),
      verdict === "verified" ? "Could not verify that" : "Could not return that",
    ).then((ok) => ok && toast(verdict === "verified" ? "Verified. Points paid out." : "Returned to the student", "success"));
  },

  resetDemo() {
    if (state?.mode !== "demo") return;
    setState(() => createDemoState(new Date()));
  },
};
