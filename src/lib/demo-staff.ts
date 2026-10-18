import { addDays, diffDays, startOfWeek, toISODate } from "./dates";
import type {
  AppState,
  Attachment,
  ClassOverview,
  LeaderboardEntry,
  Member,
  Role,
  SchoolClass,
  Submission,
  Task,
  Thread,
} from "./types";

// The demo school seen by staff. It is built from the student demo so the
// classes, tasks and discussions are the same ones, now with class lists,
// everyone's hand-ins and the work waiting to be checked.

const YEAR_9 = ["Ananya R.", "Rohan M.", "Zara K.", "Aarav P.", "Meera J.", "Kabir S.", "Ishaan T.", "Diya N.", "Vihaan G.", "Saanvi B.", "Arjun D."];
const YEAR_10 = ["Aditya K.", "Riya P.", "Sameer J.", "Anika D.", "Neel B.", "Pooja R.", "Yash T.", "Ira M.", "Karan V.", "Leela S.", "Om N.", "Myra G."];

const STAFF = {
  teacher: { fullName: "Anjali Kaushal", firstName: "Anjali", shortName: "Ms Kaushal", title: "Teacher", classes: ["bio-9", "bio-10"] },
  admin: { fullName: "Nandini Rao", firstName: "Nandini", shortName: "Ms Rao", title: "MYP Coordinator", classes: ["eng-9"] },
} as const;

const EXTRA_CLASSES: SchoolClass[] = [
  { id: "bio-10", name: "Biology 10", teacher: "Ms Kaushal", color: "brand", code: "B4T7KQ", studentCount: YEAR_10.length },
];

function slug(name: string) {
  return `s-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/-$/, "")}`;
}

/** Stable pseudo-random number in [0, 1) so the demo looks the same every time. */
function chance(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function hoursAgo(now: Date, h: number): string {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

/** Class lists. Prithu (the student demo) is in every Year 9 class. */
export function demoMembers(classIds: string[], prithuId: string): Member[] {
  return classIds.flatMap((classId) => {
    const year10 = classId.endsWith("-10");
    const students = year10
      ? YEAR_10.map((name) => ({ userId: slug(name), name }))
      : [{ userId: prithuId, name: "Prithu S." }, ...YEAR_9.map((name) => ({ userId: slug(name), name }))];
    return students.map((s) => ({ classId, ...s, role: "student" as const }));
  });
}

export function rosterSize(classId: string): number {
  return classId.endsWith("-10") ? YEAR_10.length : YEAR_9.length + 1;
}

const DETAILS: Record<string, string> = {
  "t-bio10-enzymes":
    "Write up the enzyme practical: method, results table, graph of rate against temperature, and a conclusion that explains the shape of the graph using the words active site and denatured.",
  "t-bio10-terms": "Learn the ten genetics key terms on the sheet. There is a short quiz at the start of the lesson.",
  "t-bio10-inheritance": "Questions 1 to 10 on the inheritance sheet. Draw a Punnett square for every cross.",
  "t-bio10-poster":
    "Plan an A3 poster on one ecosystem: a food web with at least eight organisms, two adaptations, and one human impact. Hand in a photo of your plan.",
  "t-eng-log": "Fill in this week's reading log: pages read each day and two sentences on what changed in the story.",
  "t-eng-poems": "Annotate both poems from the anthology for language, structure and form. Use at least three colours.",
};

function extraTasks(today: Date): Task[] {
  const day = (n: number) => toISODate(addDays(today, n));
  const task = (id: string, classId: string, title: string, setOn: number, due: number, points: number): Task => ({
    id,
    classId,
    title,
    setOn: day(setOn),
    due: day(due),
    points,
    status: "open",
    details: DETAILS[id],
  });
  return [
    task("t-bio10-enzymes", "bio-10", "Enzyme practical write-up", -6, -2, 20),
    task("t-bio10-terms", "bio-10", "Genetics key terms", -2, 0, 10),
    task("t-bio10-inheritance", "bio-10", "Inheritance problem sheet", -1, 3, 15),
    task("t-bio10-poster", "bio-10", "Ecosystems poster plan", 0, 6, 25),
    task("t-eng-log", "eng-9", "Reading log, week 3", -8, -1, 10),
    task("t-eng-poems", "eng-9", "Poetry annotations", -1, 4, 15),
  ];
}

/**
 * Who handed what in. Older work is mostly checked; recent work is waiting;
 * a few are missing or were returned. Prithu's own work matches the student demo.
 */
function demoSubmissions(task: Task, roster: Member[], studentView: Map<string, Task>, today: string, now: Date): Submission[] {
  const daysLate = diffDays(today, task.due);
  return roster.flatMap((m) => {
    const key = `${task.id}:${m.userId}`;
    const r = chance(key);
    let status: Submission["status"] | null;
    const prithu = studentView.get(task.id);
    if (m.name === "Prithu S." && prithu) {
      status = prithu.status === "open" ? null : prithu.status;
    } else if (daysLate >= 5) {
      status = r < 0.85 ? "verified" : r < 0.9 ? "returned" : null;
    } else if (daysLate > 0) {
      status = r < 0.3 ? "verified" : r < 0.72 ? "submitted" : r < 0.78 ? "returned" : null;
    } else if (daysLate === 0) {
      status = r < 0.45 ? "submitted" : null;
    } else {
      status = r < 0.18 ? "submitted" : null;
    }
    if (!status) return [];
    // Hand-ins land between the task being set and its deadline (or now, if
    // that comes first); checking happens some time after.
    const start = new Date(`${task.setOn}T10:00:00`).getTime();
    const end = Math.max(start, Math.min(now.getTime() - 3_600_000, new Date(`${task.due}T17:00:00`).getTime()));
    const handedIn = start + chance(`${key}:at`) * (end - start);
    const checked = handedIn + (0.3 + chance(`${key}:check`) * 0.6) * (now.getTime() - handedIn);
    return [
      {
        id: `sub-${key}`,
        taskId: task.id,
        studentId: m.userId,
        studentName: m.name,
        status,
        submittedAt: new Date(handedIn).toISOString(),
        verifiedAt: status === "verified" ? new Date(checked).toISOString() : undefined,
      },
    ];
  });
}

function workFiles(subs: Submission[], tasks: Task[]): Attachment[] {
  return subs
    .filter((s) => s.status !== "returned" && chance(`${s.id}:file`) < 0.65)
    .map((s) => ({
      id: `a-${s.id}`,
      taskId: s.taskId,
      studentId: s.studentId,
      kind: "file" as const,
      title: `${tasks.find((t) => t.id === s.taskId)?.title ?? "Work"}.pdf`,
      url: "/demo/student-work-sample.pdf",
      mimeType: "application/pdf",
      size: 1044,
      addedBy: s.studentName,
      mine: false,
      at: s.submittedAt,
    }));
}

function board(classId: string, members: Member[]): LeaderboardEntry[] {
  return members
    .filter((m) => m.classId === classId)
    .map((m) => ({ id: m.userId, name: m.name, points: 60 + Math.round(chance(`${classId}:${m.userId}:pts`) * 52) * 5 }))
    .sort((a, b) => b.points - a.points);
}

function overview(state: AppState, today: Date, now: Date): ClassOverview[] {
  const weekStart = toISODate(startOfWeek(today));
  const weekEnd = toISODate(addDays(startOfWeek(today), 6));
  const todayISO = toISODate(today);
  const mine: ClassOverview[] = state.classes.map((c) => {
    const tasks = state.tasks.filter((t) => t.classId === c.id);
    const subs = state.submissions.filter((s) => tasks.some((t) => t.id === s.taskId));
    const waiting = subs.filter((s) => s.status === "submitted").sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    const recent = tasks.filter((t) => t.due < todayISO && diffDays(todayISO, t.due) <= 14);
    const handedIn = (t: Task) => subs.filter((s) => s.taskId === t.id && s.status !== "returned").length;
    return {
      classId: c.id,
      name: c.name,
      color: c.color,
      teachers: state.student.fullName,
      students: c.studentCount,
      dueThisWeek: tasks.filter((t) => t.due >= weekStart && t.due <= weekEnd).length,
      waiting: waiting.length,
      oldestWaiting: waiting[0]?.submittedAt ?? null,
      missing: recent.reduce((n, t) => n + c.studentCount - handedIn(t), 0),
      verifiedThisWeek: subs.filter((s) => s.status === "verified" && (s.verifiedAt ?? "") >= weekStart).length,
      member: true,
    };
  });
  const row = (
    classId: string,
    name: string,
    color: ClassOverview["color"],
    teachers: string,
    students: number,
    dueThisWeek: number,
    waiting: number,
    oldestHours: number,
    missing: number,
    verifiedThisWeek: number,
  ): ClassOverview => ({
    classId,
    name,
    color,
    teachers,
    students,
    dueThisWeek,
    waiting,
    oldestWaiting: waiting ? hoursAgo(now, oldestHours) : null,
    missing,
    verifiedThisWeek,
    member: false,
  });
  return [
    row("bio-9", "Biology 9", "mint", "Anjali Kaushal", 12, 2, 5, 30, 4, 11),
    row("maths-9", "Maths 9", "sky", "Vikram Iyer", 12, 2, 2, 20, 1, 14),
    ...mine,
    row("his-9", "History 9", "amber", "Sourav Banerjee", 12, 1, 7, 104, 9, 3),
    row("bio-10", "Biology 10", "brand", "Anjali Kaushal", 12, 3, 6, 52, 3, 8),
    row("maths-10", "Maths 10", "sky", "Farah Khan", 11, 2, 0, 0, 2, 12),
    row("eng-10", "English 10", "mint", "Daniel Mathew", 12, 1, 3, 26, 12, 4),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

/** Turns the student demo into the same school seen by a teacher or a coordinator. */
export function staffDemo(student: AppState, role: Exclude<Role, "student">, now: Date): AppState {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayISO = toISODate(today);
  const who = STAFF[role];
  const classIds: string[] = [...who.classes];

  const classes = [...student.classes, ...EXTRA_CLASSES]
    .filter((c) => classIds.includes(c.id))
    .map((c) => ({ ...c, teacher: who.shortName, studentCount: rosterSize(c.id) }));
  const studentView = new Map(student.tasks.map((t) => [t.id, t]));
  const tasks: Task[] = [...student.tasks, ...extraTasks(today)]
    .filter((t) => t.classId && classIds.includes(t.classId))
    .map((t) => ({ ...t, status: "open", submittedAt: undefined, returned: undefined }));

  const members = demoMembers(classIds, "s-prithu");
  const submissions = tasks.flatMap((t) =>
    demoSubmissions(
      t,
      members.filter((m) => m.classId === t.classId),
      studentView,
      todayISO,
      now,
    ),
  );
  // Prithu's own files are the ones from the student demo.
  const resources = student.attachments.filter((a) => a.studentId === null && tasks.some((t) => t.id === a.taskId));

  const threads: Thread[] = [
    ...student.threads
      .filter((t) => classIds.includes(t.classId))
      .map((t) => ({
        ...t,
        unread: t.posts.filter((p) => p.role === "student").length ? 1 : 0,
        posts: t.posts.map((p) => ({ ...p, mine: p.author === who.shortName })),
      })),
    ...(role === "teacher"
      ? [
          {
            id: "th-bio10-enzymes",
            classId: "bio-10",
            title: "Enzyme practical",
            pinned: false,
            visibility: "public" as const,
            unread: 1,
            posts: [
              {
                id: "p-s1",
                author: "Riya P.",
                role: "student" as const,
                body: "For the graph, should temperature go on the x axis even though we only tested five temperatures?",
                at: hoursAgo(now, 3),
              },
            ],
          },
        ]
      : [
          {
            id: "th-eng-log",
            classId: "eng-9",
            title: "Reading log",
            pinned: false,
            visibility: "public" as const,
            unread: 1,
            posts: [
              {
                id: "p-s2",
                author: "Meera J.",
                role: "student" as const,
                body: "Does the reading log count audiobooks if we follow along in the book?",
                at: hoursAgo(now, 4),
              },
            ],
          },
        ]),
  ];

  const base: AppState = {
    ...student,
    role,
    student: {
      id: `staff-${role}`,
      fullName: who.fullName,
      firstName: who.firstName,
      shortName: who.shortName,
      yearGroup: who.title,
      email: `${who.firstName.toLowerCase()}@dpsiedge.edu.in`,
    },
    classes,
    tasks,
    threads,
    decks: student.decks.filter((d) => classIds.includes(d.classId)),
    ledger: [],
    redemptions: [],
    classmates: [],
    school: [],
    completedEarlierThisTerm: 0,
    attachments: [...resources, ...workFiles(submissions, tasks)],
    members,
    submissions,
    teachingClassIds: classIds,
    rewardRequests: [
      { id: "rr-game", rewardTitle: "Choose the next class game", cost: 80, studentName: "Ananya R.", at: hoursAgo(now, 5) },
      { id: "rr-pass", rewardTitle: "Homework pass, one task", cost: 150, studentName: "Rohan M.", at: hoursAgo(now, 27) },
    ],
    classBoards: Object.fromEntries(classIds.map((id) => [id, board(id, members)])),
    schoolOverview: null,
    showOnLeaderboard: false,
    chat: [],
  };
  if (role === "admin") base.schoolOverview = overview(base, today, now);

  const waiting = submissions.filter((s) => s.status === "submitted").length;
  base.chat = [
    {
      id: "m-hello",
      role: "ai",
      text: `Hi ${who.firstName}. ${waiting} piece${waiting === 1 ? " is" : "s are"} waiting for you to check. Ask me who is behind, or for help writing instructions for new work.`,
      at: hoursAgo(now, 0.05),
    },
  ];
  return base;
}
