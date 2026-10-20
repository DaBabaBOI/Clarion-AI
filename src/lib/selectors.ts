import { addDays, diffDays, isWeekend, parseISODate, startOfWeek, toISODate } from "./dates";
import type { AppState, Attachment, Badge, LeaderboardEntry, Member, Milestone, Submission, Task, Thread } from "./types";

// Derived values. Components call these instead of re-deriving numbers so the
// dashboard, top bar and Road to Glory always agree.

export function classById(state: AppState, id: string | null | undefined) {
  return state.classes.find((c) => c.id === id) ?? null;
}

/** Points from verified work, net of any undone verifications. Drives rank. */
export function earnedPoints(state: AppState): number {
  return state.ledger.filter((e) => e.source === "task").reduce((sum, e) => sum + e.points, 0);
}

/** Points spent on rewards, net of refunds. */
export function spentPoints(state: AppState): number {
  return state.ledger.filter((e) => e.source === "reward").reduce((sum, e) => sum - e.points, 0);
}

/** Points the student can still spend. Spending never lowers leaderboard rank. */
export function balance(state: AppState): number {
  return earnedPoints(state) - spentPoints(state);
}

export function pendingPoints(state: AppState): number {
  return state.tasks.filter((t) => t.status === "submitted" && t.classId).reduce((s, t) => s + t.points, 0);
}

export function pointsByDay(state: AppState): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of state.ledger) {
    if (e.source !== "task" || e.points <= 0) continue;
    map.set(e.date, (map.get(e.date) ?? 0) + e.points);
  }
  return map;
}

/**
 * Consecutive school days with verified points, counting back from today
 * (or yesterday when nothing has been verified yet today). Weekends are rest
 * days and never break a streak.
 */
export function streak(state: AppState, today: Date): number {
  const days = pointsByDay(state);
  let cursor = new Date(today);
  if (!days.has(toISODate(cursor))) cursor = addDays(cursor, -1);
  let count = 0;
  for (let guard = 0; guard < 400; guard++) {
    if (isWeekend(cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (!days.has(toISODate(cursor))) break;
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function weekDays(today: Date): string[] {
  const monday = startOfWeek(today);
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(monday, i)));
}

export function pointsThisWeek(state: AppState, today: Date): number {
  const days = new Set(weekDays(today));
  return state.ledger.filter((e) => e.source === "task" && days.has(e.date)).reduce((s, e) => s + e.points, 0);
}

const STATUS_ORDER: Record<Task["status"], number> = { open: 0, submitted: 1, verified: 2 };

/** Open work first (soonest due first), then work waiting on a teacher, then done. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.due.localeCompare(b.due));
}

export type Priority = "urgent" | "today" | "week" | "later" | "waiting" | "done";

export function priorityOf(task: Task, today: string): Priority {
  if (task.status === "verified") return "done";
  if (task.status === "submitted") return "waiting";
  const diff = diffDays(task.due, today);
  if (diff < 0) return "urgent";
  if (diff === 0) return "today";
  const weekEnd = toISODate(addDays(startOfWeek(parseISODate(today)), 6));
  if (diffDays(task.due, weekEnd) <= 0) return "week";
  return "later";
}

export function taskStats(state: AppState, today: Date) {
  const todayISO = toISODate(today);
  const weekEnd = toISODate(addDays(startOfWeek(today), 6));
  const open = state.tasks.filter((t) => t.status === "open");
  return {
    dueThisWeek: open.filter((t) => diffDays(t.due, todayISO) >= 0 && diffDays(t.due, weekEnd) <= 0).length,
    overdue: open.filter((t) => diffDays(t.due, todayISO) < 0).length,
    completed: state.completedEarlierThisTerm + state.tasks.filter((t) => t.status !== "open").length,
    open: open.length,
  };
}

/** The single task Clarion suggests starting with, and why. */
export function suggestion(state: AppState, today: Date): { task: Task; reason: string } | null {
  const todayISO = toISODate(today);
  const open = sortTasks(state.tasks.filter((t) => t.status === "open"));
  const first = open[0];
  if (!first) return null;
  const diff = diffDays(first.due, todayISO);
  const cls = classById(state, first.classId);
  let reason: string;
  if (diff < 0) reason = "it is overdue";
  else if (diff === 0) reason = "it is due today";
  else if (diff === 1) reason = "it is due tomorrow";
  else reason = "it is your next deadline";
  const where = cls ? ` for ${cls.name}` : "";
  return { task: first, reason: `Start “${first.title}”${where} first: ${reason}.` };
}

export function threadUpdatedAt(thread: Thread): string {
  return thread.posts[thread.posts.length - 1]?.at ?? "";
}

export function sortThreads(threads: Thread[]): Thread[] {
  return [...threads].sort((a, b) => threadUpdatedAt(b).localeCompare(threadUpdatedAt(a)));
}

export function unreadPosts(state: AppState, classId?: string): number {
  return state.threads.filter((t) => !classId || t.classId === classId).reduce((s, t) => s + t.unread, 0);
}

export function latestTeacherPost(state: AppState) {
  let best: { thread: Thread; post: Thread["posts"][number] } | null = null;
  for (const thread of state.threads) {
    if (thread.visibility !== "public") continue;
    for (const post of thread.posts) {
      if (post.role !== "teacher") continue;
      if (!best || post.at > best.post.at) best = { thread, post };
    }
  }
  return best;
}

export function cardsInClass(state: AppState, classId: string): number {
  return state.decks.filter((d) => d.classId === classId).reduce((s, d) => s + d.cards.length, 0);
}

export function nextDeadline(state: AppState, classId: string): Task | null {
  const tasks = sortTasks(state.tasks.filter((t) => t.classId === classId));
  return tasks[0] ?? null;
}

export function badgesWithProgress(state: AppState, today: Date): Badge[] {
  const current = streak(state, today);
  return state.badges.map((b) =>
    b.id === "b-streak" && b.progress
      ? { ...b, unlocked: current >= b.progress.target, progress: { ...b.progress, current: Math.min(current, b.progress.target) } }
      : b,
  );
}

export function milestoneProgress(milestones: Milestone[], points: number) {
  const reachedIndex = milestones.reduce((idx, m, i) => (points >= m.points ? i : idx), 0);
  const next = milestones[reachedIndex + 1] ?? null;
  const current = milestones[reachedIndex];
  // Milestones are spaced evenly on the road, so progress is measured per segment.
  const segment = next ? (points - current.points) / (next.points - current.points) : 0;
  const position = milestones.length > 1 ? (reachedIndex + segment) / (milestones.length - 1) : 1;
  return { current, next, reachedIndex, position: Math.min(1, position) };
}

export interface BoardRow extends LeaderboardEntry {
  rank: number;
  me: boolean;
}

/** Teachers are not ranked, so they only see the students. */
function withMe(state: AppState, rows: LeaderboardEntry[], me: LeaderboardEntry): LeaderboardEntry[] {
  return state.role === "student" ? [...rows, me] : rows;
}

export function classBoard(state: AppState): BoardRow[] {
  const me: LeaderboardEntry = { id: "me", name: state.student.shortName, points: earnedPoints(state) };
  return withMe(state, state.classmates, me)
    .sort((a, b) => b.points - a.points)
    .map((e, i) => ({ ...e, rank: i + 1, me: e.id === "me" }));
}

export function schoolBoard(state: AppState): BoardRow[] {
  const me: LeaderboardEntry = { id: "me", name: state.student.shortName, group: state.student.yearGroup || "9B", points: earnedPoints(state) };
  return withMe(state, state.school, me)
    .sort((a, b) => b.points - a.points)
    .map((e, i) => ({ ...e, rank: i + 1, me: e.id === "me" }));
}

export function dayIsPast(iso: string, today: Date): boolean {
  return parseISODate(iso) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

// ── Attachments ─────────────────────────────────────────────────────────────

/** Files and links shared with everyone on the task. */
export function taskResources(state: AppState, taskId: string): Attachment[] {
  return state.attachments.filter((a) => a.taskId === taskId && a.studentId === null);
}

/** The work one student attached to a task. */
export function workFiles(state: AppState, taskId: string, studentId: string): Attachment[] {
  return state.attachments.filter((a) => a.taskId === taskId && a.studentId === studentId);
}

// ── Staff ───────────────────────────────────────────────────────────────────

export function isStaff(state: AppState): boolean {
  return state.role !== "student";
}

export function teaches(state: AppState, classId: string | null | undefined): boolean {
  return !!classId && state.teachingClassIds.includes(classId);
}

export function roster(state: AppState, classId: string): Member[] {
  return state.members.filter((m) => m.classId === classId && m.role === "student").sort((a, b) => a.name.localeCompare(b.name));
}

export interface Review {
  submission: Submission;
  task: Task;
}

/** Work handed in to classes the signed-in teacher teaches, oldest first. */
export function pendingReviews(state: AppState, classId?: string): Review[] {
  return state.submissions
    .filter((s) => s.status === "submitted")
    .flatMap((submission) => {
      const task = state.tasks.find((t) => t.id === submission.taskId);
      if (!task || !teaches(state, task.classId) || (classId && task.classId !== classId)) return [];
      return [{ submission, task }];
    })
    .sort((a, b) => a.submission.submittedAt.localeCompare(b.submission.submittedAt));
}

/** How a class is getting on with one piece of work. */
export function taskProgress(state: AppState, task: Task) {
  const total = task.classId ? roster(state, task.classId).length : 0;
  const subs = state.submissions.filter((s) => s.taskId === task.id);
  const verified = subs.filter((s) => s.status === "verified").length;
  const waiting = subs.filter((s) => s.status === "submitted").length;
  return { total, verified, waiting, handedIn: verified + waiting, returned: subs.filter((s) => s.status === "returned").length };
}

export function staffStats(state: AppState, today: Date) {
  const weekStart = toISODate(startOfWeek(today));
  const weekEnd = toISODate(addDays(startOfWeek(today), 6));
  const set = state.tasks.filter((t) => teaches(state, t.classId));
  const students = new Set(state.members.filter((m) => m.role === "student" && teaches(state, m.classId)).map((m) => m.userId));
  return {
    toCheck: pendingReviews(state).length,
    dueThisWeek: set.filter((t) => t.due >= weekStart && t.due <= weekEnd).length,
    students: students.size,
    verifiedThisWeek: state.submissions.filter((s) => s.status === "verified" && s.verifiedAt && s.verifiedAt.slice(0, 10) >= weekStart).length,
  };
}

/** The newest post by a student in a class the teacher teaches. */
export function latestStudentPost(state: AppState) {
  let best: { thread: Thread; post: Thread["posts"][number] } | null = null;
  for (const thread of state.threads) {
    if (!teaches(state, thread.classId)) continue;
    for (const post of thread.posts) {
      if (post.role !== "student") continue;
      if (!best || post.at > best.post.at) best = { thread, post };
    }
  }
  return best;
}

/** What a teacher should do first, and why. */
export function staffSuggestion(state: AppState, today: Date): string {
  const queue = pendingReviews(state);
  const oldest = queue[0];
  if (oldest) {
    const days = diffDays(toISODate(today), oldest.submission.submittedAt.slice(0, 10));
    const wait = days >= 2 ? `has waited ${days} days` : days === 1 ? "came in yesterday" : "came in today";
    return `Check ${oldest.submission.studentName}'s “${oldest.task.title}” first: it ${wait}. Points only reach students once you verify.`;
  }
  const todayISO = toISODate(today);
  const next = sortTasks(state.tasks.filter((t) => teaches(state, t.classId) && t.due >= todayISO))[0];
  if (next) {
    const p = taskProgress(state, next);
    const missing = p.total - p.handedIn;
    return missing > 0
      ? `Nothing to check. “${next.title}” is due ${next.due === todayISO ? "today" : "soon"} and ${missing} student${missing === 1 ? " has" : "s have"} not handed it in yet.`
      : `Nothing to check, and everyone has handed in “${next.title}”.`;
  }
  return "Nothing to check and no deadlines coming up. Set the next piece of work when you are ready.";
}
