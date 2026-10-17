// Shapes used by the UI. They mirror the Supabase tables in
// supabase/migrations so swapping the demo store for real queries is a
// data-layer change, not a component rewrite.

export type ClassColor = "mint" | "sky" | "brand" | "amber";

export interface Student {
  id: string;
  fullName: string;
  firstName: string;
  shortName: string;
  yearGroup: string;
  email: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  teacher: string;
  color: ClassColor;
  code: string;
  studentCount: number;
}

/**
 * open      → not handed in
 * submitted → the student ticked it; waiting for the teacher
 * verified  → the teacher confirmed it; points have been paid out
 */
export type TaskStatus = "open" | "submitted" | "verified";

export interface Task {
  id: string;
  classId: string | null; // null = personal task (never earns points)
  title: string;
  setOn: string; // yyyy-mm-dd
  due: string; // yyyy-mm-dd
  points: number;
  status: TaskStatus;
  submittedAt?: string; // ISO timestamp
}

export interface Post {
  id: string;
  author: string;
  role: "teacher" | "student";
  body: string;
  at: string; // ISO timestamp
  mine?: boolean;
}

export interface Thread {
  id: string;
  classId: string;
  title: string;
  pinned: boolean;
  visibility: "public" | "direct";
  unread: number;
  posts: Post[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface Deck {
  id: string;
  classId: string;
  title: string;
  cards: Flashcard[];
  reviewed: number;
}

export interface LedgerEntry {
  id: string;
  date: string; // yyyy-mm-dd
  points: number; // positive = earned or refunded, negative = spent or reversed
  label: string;
  classId?: string;
  // "task": verified work (counts towards rank). "reward": spending and refunds.
  source: "task" | "reward";
}

export interface Reward {
  id: string;
  title: string;
  cost: number;
  icon: "game" | "pass" | "theme";
  needsTeacher: boolean;
}

export interface Redemption {
  rewardId: string;
  at: string;
  status: "requested" | "unlocked";
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  pattern: string; // 16 chars, "x" = filled pixel, row by row
  color: "gold" | "mint" | "sky" | "brand";
  unlocked: boolean;
  progress?: { current: number; target: number; unit: string };
}

export interface Milestone {
  id: string;
  title: string;
  points: number;
  unlock: string;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  points: number;
  group?: string;
}

export interface PlanRow {
  minutes: number;
  title: string;
  classId: string | null;
}

export interface Source {
  kind: "task" | "notes" | "deck" | "thread";
  label: string;
}

export interface ChatMessage {
  id: string;
  role: "ai" | "user";
  text: string;
  at: string;
  plan?: PlanRow[];
  quiz?: { deck: string; front: string; back: string };
  sources?: Source[];
  pending?: boolean;
  error?: boolean;
}

/** Handed-in work waiting for the signed-in teacher. */
export interface PendingReview {
  submissionId: string;
  taskId: string;
  classId: string;
  title: string;
  studentName: string;
  submittedAt: string;
  points: number;
}

export type DataMode = "demo" | "live";
export type Role = "student" | "teacher" | "admin";

export interface AppState {
  version: number;
  mode: DataMode;
  role: Role;
  createdOn: string;
  student: Student;
  classes: SchoolClass[];
  tasks: Task[];
  threads: Thread[];
  decks: Deck[];
  ledger: LedgerEntry[];
  rewards: Reward[];
  redemptions: Redemption[];
  badges: Badge[];
  milestones: Milestone[];
  classmates: LeaderboardEntry[];
  school: LeaderboardEntry[];
  completedEarlierThisTerm: number;
  chat: ChatMessage[];
  showOnLeaderboard: boolean;
  aiContextClassId: string | null;
  discussionClassId: string | null;
  selectedThreadId: string | null;
  // Classes the signed-in user teaches (live mode), and their marking queue.
  teachingClassIds: string[];
  pendingReviews: PendingReview[];
  conversationId: string | null;
}
