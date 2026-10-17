import { createDemoState } from "../demo-data";
import { startOfWeek, toISODate } from "../dates";
import { streak, suggestion } from "../selectors";
import { getSupabase } from "../supabase/client";
import type {
  AppState,
  Badge,
  ChatMessage,
  ClassColor,
  Deck,
  LeaderboardEntry,
  LedgerEntry,
  PendingReview,
  Reward,
  Role,
  SchoolClass,
  Source,
  Task,
  Thread,
} from "../types";

// Builds the app state from Supabase. Every query runs as the signed-in user,
// so row level security decides what comes back; this file only reshapes it
// into the same AppState the demo uses.

export class NotSignedInError extends Error {}

const REWARD_ICONS: Reward["icon"][] = ["game", "pass", "theme"];

function localDate(iso: string): string {
  return toISODate(new Date(iso));
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

interface StoredReply {
  sources?: Source[];
  plan?: ChatMessage["plan"] | null;
  quiz?: ChatMessage["quiz"] | null;
}

function readReply(raw: unknown): StoredReply {
  if (Array.isArray(raw)) return { sources: raw as Source[] };
  if (raw && typeof raw === "object") return raw as StoredReply;
  return {};
}

export async function loadLiveState(prev: AppState | null): Promise<AppState> {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new NotSignedInError();
  const me = user.id;

  const [
    profileRes,
    classesRes,
    membersRes,
    tasksRes,
    subsRes,
    threadsRes,
    postsRes,
    readsRes,
    decksRes,
    reviewsRes,
    ledgerRes,
    rewardsRes,
    redemptionsRes,
    matesRes,
    schoolRes,
    chatRes,
  ] = await Promise.all([
    sb.from("profiles").select("full_name, role, year_group, show_on_leaderboard").eq("id", me).single(),
    sb.from("classes").select("id, name, color, join_code").order("name"),
    sb.from("class_members").select("class_id, user_id, role, profiles(full_name)"),
    sb.from("tasks").select("id, class_id, owner_id, title, set_on, due_on, points"),
    sb.from("task_submissions").select("id, task_id, student_id, status, submitted_at, profiles!task_submissions_student_id_fkey(full_name)"),
    sb.from("threads").select("id, class_id, author_id, title, visibility, pinned"),
    sb.from("posts").select("id, thread_id, author_id, body, created_at").order("created_at"),
    sb.from("thread_reads").select("thread_id, last_read_at").eq("user_id", me),
    sb.from("flashcard_decks").select("id, class_id, title, flashcards(id, front, back, position)").order("created_at"),
    sb.from("flashcard_reviews").select("card_id").eq("user_id", me),
    sb.from("points_ledger").select("id, class_id, delta, reason, submission_id, redemption_id, created_at").eq("student_id", me).order("created_at"),
    sb.from("rewards").select("id, title, cost, needs_teacher").eq("active", true).order("cost"),
    sb.from("redemptions").select("reward_id, status, created_at").eq("student_id", me),
    sb.rpc("classmates_leaderboard"),
    sb.rpc("school_leaderboard"),
    sb
      .from("ai_conversations")
      .select("id, ai_messages(id, role, content, sources, created_at)")
      .eq("user_id", me)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const firstError = [profileRes, classesRes, membersRes, tasksRes, subsRes, threadsRes, postsRes, decksRes, ledgerRes].find(
    (r) => r.error,
  )?.error;
  if (firstError) throw new Error(firstError.message);

  const profile = profileRes.data!;
  const role = profile.role as Role;
  const fullName = profile.full_name || user.email?.split("@")[0] || "Student";

  // People and classes
  const names = new Map<string, string>([[me, fullName]]);
  const roleInClass = new Map<string, Role>();
  for (const m of membersRes.data ?? []) {
    if (m.profiles?.full_name) names.set(m.user_id, m.profiles.full_name);
    roleInClass.set(`${m.class_id}:${m.user_id}`, m.role as Role);
  }
  const teachingClassIds = (membersRes.data ?? []).filter((m) => m.user_id === me && m.role === "teacher").map((m) => m.class_id);

  const classes: SchoolClass[] = (classesRes.data ?? []).map((c) => {
    const members = (membersRes.data ?? []).filter((m) => m.class_id === c.id);
    const teachers = members.filter((m) => m.role === "teacher").map((m) => m.profiles?.full_name ?? "Teacher");
    return {
      id: c.id,
      name: c.name,
      teacher: teachers.join(", ") || "No teacher yet",
      color: c.color as ClassColor,
      code: c.join_code,
      studentCount: members.filter((m) => m.role === "student").length,
    };
  });

  // Tasks: status comes from the signed-in student's own submission.
  const mySubs = new Map((subsRes.data ?? []).filter((s) => s.student_id === me).map((s) => [s.task_id, s]));
  const tasks: Task[] = (tasksRes.data ?? []).map((t) => {
    const sub = mySubs.get(t.id);
    let status: Task["status"] = "open";
    if (sub?.status === "verified") status = "verified";
    else if (sub?.status === "submitted") status = t.class_id ? "submitted" : "verified"; // reminders need no teacher
    return {
      id: t.id,
      classId: t.class_id,
      title: t.title,
      setOn: t.set_on,
      due: t.due_on,
      points: t.points,
      status,
      submittedAt: sub?.submitted_at,
    };
  });

  const taskById = new Map((tasksRes.data ?? []).map((t) => [t.id, t]));
  const pendingReviews: PendingReview[] = (subsRes.data ?? [])
    .filter((s) => s.status === "submitted" && s.student_id !== me)
    .flatMap((s) => {
      const t = taskById.get(s.task_id);
      if (!t?.class_id || !teachingClassIds.includes(t.class_id)) return [];
      return [
        {
          submissionId: s.id,
          taskId: t.id,
          classId: t.class_id,
          title: t.title,
          studentName: s.profiles?.full_name ?? "Student",
          submittedAt: s.submitted_at,
          points: t.points,
        },
      ];
    })
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  // Discussions
  const lastRead = new Map((readsRes.data ?? []).map((r) => [r.thread_id, r.last_read_at]));
  const threads: Thread[] = (threadsRes.data ?? []).map((t) => {
    const posts = (postsRes.data ?? []).filter((p) => p.thread_id === t.id);
    const read = lastRead.get(t.id);
    return {
      id: t.id,
      classId: t.class_id,
      title: t.title,
      pinned: t.pinned,
      visibility: t.visibility,
      unread: posts.filter((p) => p.author_id !== me && (!read || p.created_at > read)).length,
      posts: posts.map((p) => ({
        id: p.id,
        author: names.get(p.author_id) ?? "Someone",
        role: roleInClass.get(`${t.class_id}:${p.author_id}`) === "teacher" ? "teacher" : "student",
        body: p.body,
        at: p.created_at,
        mine: p.author_id === me,
      })),
    };
  });

  // Flashcards
  const reviewed = new Set((reviewsRes.data ?? []).map((r) => r.card_id));
  const decks: Deck[] = (decksRes.data ?? [])
    .filter((d) => d.class_id)
    .map((d) => {
      const cards = [...(d.flashcards ?? [])].sort((a, b) => a.position - b.position);
      return {
        id: d.id,
        classId: d.class_id!,
        title: d.title,
        cards: cards.map((c) => ({ id: c.id, front: c.front, back: c.back })),
        reviewed: cards.filter((c) => reviewed.has(c.id)).length,
      };
    });

  // Points
  const ledger: LedgerEntry[] = (ledgerRes.data ?? []).map((e) => ({
    id: String(e.id),
    date: localDate(e.created_at),
    points: e.delta,
    label: e.reason,
    classId: e.class_id ?? undefined,
    source: e.submission_id ? "task" : "reward",
  }));

  const rewards: Reward[] = (rewardsRes.data ?? []).map((r, i) => ({
    id: r.id,
    title: r.title,
    cost: r.cost,
    icon: r.needs_teacher ? REWARD_ICONS[i % 2] : "theme",
    needsTeacher: r.needs_teacher,
  }));
  const redemptions = (redemptionsRes.data ?? [])
    .filter((r) => r.status !== "declined")
    .map((r) => ({ rewardId: r.reward_id, at: r.created_at, status: r.status === "unlocked" || r.status === "approved" ? ("unlocked" as const) : ("requested" as const) }));

  const classmates: LeaderboardEntry[] = (matesRes.data ?? [])
    .filter((r) => !r.is_me)
    .map((r, i) => ({ id: `mate-${i}`, name: r.display_name, points: r.points }));
  const school: LeaderboardEntry[] = (schoolRes.data ?? [])
    .filter((r) => !r.is_me)
    .map((r, i) => ({ id: `school-${i}`, name: "Student", group: r.year_group ?? "", points: r.points }));

  // Chat history from the most recent conversation.
  const conversation = chatRes.data;
  const history: ChatMessage[] = [...(conversation?.ai_messages ?? [])]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => {
      const reply = readReply(m.sources);
      return {
        id: m.id,
        role: m.role === "assistant" ? "ai" : "user",
        text: m.content,
        at: m.created_at,
        sources: reply.sources,
        plan: reply.plan ?? undefined,
        quiz: reply.quiz ?? undefined,
      };
    });

  const now = new Date();
  const base = createDemoState(now);
  const state: AppState = {
    ...base,
    mode: "live",
    role,
    student: {
      id: me,
      fullName,
      firstName: fullName.split(/\s+/)[0],
      shortName: shortName(fullName),
      yearGroup: role === "admin" ? "Principal" : role === "teacher" ? "Teacher" : profile.year_group ?? "",
      email: user.email ?? "",
    },
    classes,
    tasks,
    threads,
    decks,
    ledger,
    rewards,
    redemptions,
    classmates,
    school,
    completedEarlierThisTerm: 0,
    chat: [],
    showOnLeaderboard: profile.show_on_leaderboard,
    aiContextClassId: prev?.aiContextClassId ?? null,
    discussionClassId: prev?.discussionClassId ?? null,
    selectedThreadId: prev?.selectedThreadId ?? null,
    teachingClassIds,
    pendingReviews,
    conversationId: conversation?.id ?? null,
  };

  state.badges = liveBadges(state, now, (subsRes.data ?? []).filter((s) => s.student_id === me), taskById);
  state.chat = history.length ? history : [greeting(state, now)];
  return state;
}

export function greeting(state: AppState, now: Date): ChatMessage {
  const tip = suggestion(state, now);
  return {
    id: "greeting",
    role: "ai",
    text: `Hi ${state.student.firstName}. ${tip ? tip.reason : "You are all caught up."} Ask me anything about your classes, or try a study plan or a quiz.`,
    at: now.toISOString(),
  };
}

/** Badge progress worked out from real submissions and points. */
function liveBadges(
  state: AppState,
  now: Date,
  mySubs: { task_id: string; status: string; submitted_at: string }[],
  taskById: Map<string, { due_on: string; title: string; class_id: string | null }>,
): Badge[] {
  const early = mySubs.filter((s) => {
    const t = taskById.get(s.task_id);
    return t?.class_id && localDate(s.submitted_at) < t.due_on;
  }).length;

  const verifiedByWeek = new Map<string, number>();
  for (const s of mySubs) {
    const t = taskById.get(s.task_id);
    if (s.status !== "verified" || !t?.class_id) continue;
    const week = toISODate(startOfWeek(new Date(`${t.due_on}T12:00:00`)));
    verifiedByWeek.set(week, (verifiedByWeek.get(week) ?? 0) + 1);
  }
  const bestWeek = Math.max(0, ...verifiedByWeek.values());

  const reading = mySubs.filter((s) => s.status === "verified" && /\bread/i.test(taskById.get(s.task_id)?.title ?? "")).length;
  const days = streak(state, now);

  const make = (b: Omit<Badge, "unlocked"> & { current: number; target: number; unit: string }): Badge => ({
    id: b.id,
    title: b.title,
    description: b.description,
    pattern: b.pattern,
    color: b.color,
    unlocked: b.current >= b.target,
    progress: { current: Math.min(b.current, b.target), target: b.target, unit: b.unit },
  });

  return [
    make({ id: "b-early", title: "Early bird", description: "Hand in five tasks at least a day early.", pattern: ".xx.xxxxxxxx.xx.", color: "gold", current: early, target: 5, unit: "early" }),
    make({ id: "b-week", title: "Perfect week", description: "Five tasks verified in one school week.", pattern: ".xx.xxxx.xx.x..x", color: "mint", current: bestWeek, target: 5, unit: "tasks" }),
    make({ id: "b-books", title: "Bookworm", description: "Finish five reading tasks.", pattern: "xxxxx..xx..xxxxx", color: "sky", current: reading, target: 5, unit: "books" }),
    make({ id: "b-streak", title: "Streak of 10", description: "Earn verified points ten school days in a row.", pattern: ".xx..xx.xxxx.xx.", color: "brand", current: days, target: 10, unit: "days" }),
  ];
}
