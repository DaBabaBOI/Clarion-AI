import { addDays, schoolDaysAhead, schoolDaysBack, toISODate, weekdayName } from "./dates";
import { demoMembers, rosterSize, staffDemo } from "./demo-staff";
import type { AppState, Attachment, Deck, LedgerEntry, Role, Submission, Task, Thread } from "./types";

// Demo content shown until the app is connected to Supabase. Every date is
// relative to the day the demo is first opened so "Overdue", "Today" and the
// streak always read correctly.

export const DEMO_VERSION = 3;

function hoursAgo(now: Date, h: number): string {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

function minutesAgo(now: Date, m: number): string {
  return new Date(now.getTime() - m * 60 * 1000).toISOString();
}

// The teacher's instructions on each piece of class work.
const DETAILS: Record<string, string> = {
  "t-bio-worksheet":
    "Label the animal and plant cell diagrams on the worksheet, then answer questions 1 to 8.\nUse full sentences for questions 6 to 8.\nHand in a photo or scan of both pages.",
  "t-bio-reading":
    "Read pages 3 to 6 of the Unit 2 booklet (cells and organisation).\nThen do the self check on page 7 and mark it with the answers at the back.\nWrite down one question to bring to the next lesson.",
  "t-bio-notes":
    "Make one page of revision notes covering:\n- the word and symbol equations\n- where photosynthesis happens in the leaf\n- the three limiting factors\nDiagrams are welcome.",
  "t-bio-lab": "Read the lab safety rules with a parent or carer, then sign and hand in the form.",
  "t-maths-quadratics": "Questions 1 to 12 from the problem set. Show your working for every question.\nQuestions 10 to 12 are stretch questions: try at least one.",
  "t-maths-square": "Exercise 4C, odd numbers from 1 to 15.\nCheck each answer by expanding the brackets back out.",
  "t-eng-essay":
    "Write the first draft of your persuasive essay on the topic we chose in class.\nAim for 800 to 1,000 words: an introduction with a clear thesis, three body paragraphs with evidence, and a conclusion.",
  "t-his-sources":
    "List at least six sources for your Unit 2 investigation, including two primary sources.\nFor each one give the author, date and type of source, and one sentence on why it is useful.",
  "t-his-annotations": "Annotate the two primary sources from the lesson: who made it, when, why, and what it tells us.",
};

/** Sample content for trying Clarion without an account, as a student, teacher or coordinator. */
export function createDemoState(now: Date, role: Role = "student"): AppState {
  const student = studentDemo(now);
  return role === "student" ? student : staffDemo(student, role, now);
}

function studentDemo(now: Date): AppState {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (offset: number) => toISODate(addDays(today, offset));
  const testDay = weekdayName(schoolDaysAhead(today, 3));

  const tasks: Task[] = (
    [
      { id: "t-bio-worksheet", classId: "bio-9", title: "Cell structure worksheet", setOn: day(-5), due: day(-1), points: 20, status: "open" },
      { id: "t-bio-reading", classId: "bio-9", title: "Read pages 3 to 6 and self check", setOn: day(-1), due: day(0), points: 10, status: "open" },
      { id: "t-bio-notes", classId: "bio-9", title: "Photosynthesis revision notes", setOn: day(-1), due: day(2), points: 15, status: "open" },
      { id: "t-bio-lab", classId: "bio-9", title: "Lab safety form", setOn: day(-15), due: day(-10), points: 5, status: "verified" },
      { id: "t-maths-quadratics", classId: "maths-9", title: "Quadratics problem set", setOn: day(-3), due: day(1), points: 20, status: "open" },
      { id: "t-maths-square", classId: "maths-9", title: "Completing the square practice", setOn: day(-1), due: day(5), points: 15, status: "open" },
      { id: "t-eng-essay", classId: "eng-9", title: "Essay first draft", setOn: day(-6), due: day(2), points: 25, status: "open" },
      { id: "t-his-sources", classId: "his-9", title: "Unit 2 source list", setOn: day(-9), due: day(-2), points: 10, status: "submitted", submittedAt: hoursAgo(now, 26) },
      { id: "t-his-annotations", classId: "his-9", title: "Primary source annotations", setOn: day(-12), due: day(-4), points: 15, status: "verified" },
    ] satisfies Task[]
  ).map((t) => ({ ...t, details: DETAILS[t.id] }));

  // Files and links the teachers shared, and the source list Prithu handed in.
  const resource = (id: string, taskId: string, kind: Attachment["kind"], title: string, url: string, addedBy: string, size?: number): Attachment => ({
    id,
    taskId,
    studentId: null,
    kind,
    title,
    url,
    mimeType: kind === "file" ? "application/pdf" : undefined,
    size,
    addedBy,
    mine: false,
    at: hoursAgo(now, 72),
  });
  const attachments: Attachment[] = [
    resource("a-cells-sheet", "t-bio-worksheet", "file", "Cell structure worksheet.pdf", "/demo/cell-structure-worksheet.pdf", "Ms Kaushal", 1423),
    resource("a-cells-wiki", "t-bio-worksheet", "link", "Cell (biology), Wikipedia", "https://en.wikipedia.org/wiki/Cell_(biology)", "Ms Kaushal"),
    resource("a-photo-wiki", "t-bio-notes", "link", "Photosynthesis, Wikipedia", "https://en.wikipedia.org/wiki/Photosynthesis", "Ms Kaushal"),
    resource("a-quad-sheet", "t-maths-quadratics", "file", "Quadratics problem set.pdf", "/demo/quadratics-problem-set.pdf", "Mr Iyer", 1355),
    resource("a-square-wiki", "t-maths-square", "link", "Completing the square, Wikipedia", "https://en.wikipedia.org/wiki/Completing_the_square", "Mr Iyer"),
    resource("a-essay-sheet", "t-eng-essay", "file", "Essay planning sheet.pdf", "/demo/essay-planning-sheet.pdf", "Ms Rao", 1259),
    resource(
      "a-essay-owl",
      "t-eng-essay",
      "link",
      "Thesis statement tips, Purdue OWL",
      "https://owl.purdue.edu/owl/general_writing/the_writing_process/thesis_statement_tips.html",
      "Ms Rao",
    ),
    {
      id: "a-my-sources",
      taskId: "t-his-sources",
      studentId: "me",
      kind: "file",
      title: "Unit 2 source list.pdf",
      url: "/demo/unit-2-source-list.pdf",
      mimeType: "application/pdf",
      size: 1339,
      addedBy: "Prithu S.",
      mine: true,
      at: hoursAgo(now, 26),
    },
  ];
  const submissions: Submission[] = tasks
    .filter((t) => t.classId && t.status !== "open")
    .map((t) => ({
      id: `sub-${t.id}`,
      taskId: t.id,
      studentId: "me",
      studentName: "Prithu S.",
      status: t.status === "verified" ? "verified" : "submitted",
      submittedAt: t.submittedAt ?? `${t.due}T15:00:00.000Z`,
    }));

  // Teacher-verified points. Four school days in a row gives the 4 day streak.
  const earned: [number, number, string, string][] = [
    [1, 10, "Algebra warm-up", "maths-9"],
    [2, 15, "Primary source annotations", "his-9"],
    [3, 5, "Lab safety form", "bio-9"],
    [4, 10, "Microscope drawing", "bio-9"],
    [6, 40, "Persuasive paragraph", "eng-9"],
    [8, 50, "Fractions review", "maths-9"],
    [11, 35, "Timeline poster", "his-9"],
    [13, 45, "Plant cell model", "bio-9"],
    [16, 30, "Reading log, week 1", "eng-9"],
  ];
  const ledger: LedgerEntry[] = earned.map(([back, points, label, classId], i) => ({
    id: `l-${i}`,
    date: toISODate(schoolDaysBack(today, back)),
    points,
    label,
    classId,
    source: "task",
  }));

  const threads: Thread[] = [
    {
      id: "th-bio-qa",
      classId: "bio-9",
      title: "Q and A, Biology 9",
      pinned: true,
      visibility: "public",
      unread: 2,
      posts: [
        {
          id: "p-1",
          author: "Ms Kaushal",
          role: "teacher",
          body: `Reminder: the ${testDay} test covers cell structure and photosynthesis only. You do not need the light dependent reactions in detail.`,
          at: minutesAgo(now, 10),
        },
        {
          id: "p-2",
          author: "Ananya R.",
          role: "student",
          body: "Do we need to memorise the full equation, or is the word equation enough?",
          at: minutesAgo(now, 8),
        },
        {
          id: "p-3",
          author: "Ms Kaushal",
          role: "teacher",
          body: "The word equation is enough for this test. The balanced version comes in unit 4.",
          at: minutesAgo(now, 5),
        },
      ],
    },
    {
      id: "th-maths-help",
      classId: "maths-9",
      title: "Quadratics help",
      pinned: false,
      visibility: "public",
      unread: 1,
      posts: [
        {
          id: "p-4",
          author: "Aarav P.",
          role: "student",
          body: "Can someone explain completing the square?",
          at: minutesAgo(now, 40),
        },
      ],
    },
    {
      id: "th-eng-drafts",
      classId: "eng-9",
      title: "Essay drafts",
      pinned: false,
      visibility: "public",
      unread: 0,
      posts: [
        {
          id: "p-5",
          author: "Ms Rao",
          role: "teacher",
          body: "I have posted feedback on the first drafts. Read the comments before you start the second draft.",
          at: hoursAgo(now, 2),
        },
      ],
    },
    {
      id: "th-his-sources",
      classId: "his-9",
      title: "Unit 2 sources",
      pinned: true,
      visibility: "public",
      unread: 0,
      posts: [
        {
          id: "p-6",
          author: "Mr Banerjee",
          role: "teacher",
          body: "Pinned: primary source list for the essay. Use at least three of these.",
          at: hoursAgo(now, 24),
        },
      ],
    },
    {
      id: "th-bio-direct",
      classId: "bio-9",
      title: "Worksheet extension",
      pinned: false,
      visibility: "direct",
      unread: 0,
      posts: [
        {
          id: "p-7",
          author: "Prithu S.",
          role: "student",
          body: "Could I have one more day for the cell structure worksheet? I was out for the match.",
          at: hoursAgo(now, 50),
          mine: true,
        },
        {
          id: "p-8",
          author: "Ms Kaushal",
          role: "teacher",
          body: "Yes, hand it in as soon as you can. It still counts.",
          at: hoursAgo(now, 48),
        },
      ],
    },
  ];

  const decks: Deck[] = [
    {
      id: "d-photosynthesis",
      classId: "bio-9",
      title: "Photosynthesis",
      reviewed: 5,
      cards: [
        { id: "c-ph-1", front: "Where does photosynthesis happen?", back: "In the chloroplasts, mostly in the leaf cells of a plant." },
        { id: "c-ph-2", front: "What is the word equation for photosynthesis?", back: "Carbon dioxide + water → glucose + oxygen, using light energy." },
        { id: "c-ph-3", front: "Which pigment absorbs the light?", back: "Chlorophyll." },
        { id: "c-ph-4", front: "What are the two raw materials?", back: "Carbon dioxide and water." },
        { id: "c-ph-5", front: "How does carbon dioxide get into the leaf?", back: "By diffusion through the stomata." },
        { id: "c-ph-6", front: "Name one limiting factor.", back: "Light intensity, carbon dioxide concentration or temperature." },
        { id: "c-ph-7", front: "What happens to the oxygen made?", back: "It is used in respiration or diffuses out of the leaf." },
        { id: "c-ph-8", front: "Give two uses of the glucose a plant makes.", back: "Respiration, and making starch for storage or cellulose for cell walls." },
      ],
    },
    {
      id: "d-cells",
      classId: "bio-9",
      title: "Cell structure",
      reviewed: 6,
      cards: [
        { id: "c-ce-1", front: "What does the nucleus do?", back: "It holds the genetic material and controls the cell's activities." },
        { id: "c-ce-2", front: "Where does aerobic respiration happen?", back: "In the mitochondria." },
        { id: "c-ce-3", front: "What do ribosomes do?", back: "They make proteins." },
        { id: "c-ce-4", front: "Name three structures found only in plant cells.", back: "Cell wall, chloroplasts and a permanent vacuole." },
        { id: "c-ce-5", front: "What does the cell membrane do?", back: "It controls what enters and leaves the cell." },
        { id: "c-ce-6", front: "What is a plant cell wall made of?", back: "Cellulose." },
      ],
    },
    {
      id: "d-enzymes",
      classId: "bio-9",
      title: "Enzymes",
      reviewed: 0,
      cards: [
        { id: "c-en-1", front: "What is an enzyme?", back: "A biological catalyst, usually a protein, that speeds up reactions." },
        { id: "c-en-2", front: "What is the active site?", back: "The part of the enzyme where the substrate binds." },
        { id: "c-en-3", front: "What does denatured mean?", back: "The active site has changed shape, so the substrate no longer fits." },
        { id: "c-en-4", front: "Which enzyme breaks down starch?", back: "Amylase." },
        { id: "c-en-5", front: "Name two factors that affect enzyme activity.", back: "Temperature and pH." },
      ],
    },
    {
      id: "d-quadratics",
      classId: "maths-9",
      title: "Quadratics",
      reviewed: 2,
      cards: [
        { id: "c-qu-1", front: "What is the standard form of a quadratic equation?", back: "ax² + bx + c = 0, where a is not 0." },
        { id: "c-qu-2", front: "State the quadratic formula.", back: "x = (−b ± √(b² − 4ac)) / 2a" },
        { id: "c-qu-3", front: "Factorise x² + 5x + 6.", back: "(x + 2)(x + 3)" },
        { id: "c-qu-4", front: "What does the discriminant b² − 4ac tell you?", back: "Positive: two real roots. Zero: one repeated root. Negative: no real roots." },
        { id: "c-qu-5", front: "Complete the square for x² + 6x.", back: "(x + 3)² − 9" },
        { id: "c-qu-6", front: "Solve x² = 49.", back: "x = 7 or x = −7" },
      ],
    },
    {
      id: "d-sources",
      classId: "his-9",
      title: "Source skills",
      reviewed: 0,
      cards: [
        { id: "c-so-1", front: "What is a primary source?", back: "A source created at the time of the event being studied." },
        { id: "c-so-2", front: "What is a secondary source?", back: "A later interpretation or analysis of the event." },
        { id: "c-so-3", front: "What does provenance mean?", back: "Who made a source, when, where and why." },
        { id: "c-so-4", front: "What is corroboration?", back: "Checking a source against other sources to test how reliable it is." },
        { id: "c-so-5", front: "Why might a source be biased?", back: "Its author may favour one side because of their views, job or audience." },
      ],
    },
  ];

  return {
    version: DEMO_VERSION,
    mode: "demo",
    role: "student",
    createdOn: toISODate(today),
    student: {
      id: "me",
      fullName: "Prithu Sharma",
      firstName: "Prithu",
      shortName: "Prithu S.",
      yearGroup: "Year 9",
      email: "prithu@dpsiedge.edu.in",
    },
    classes: [
      { id: "bio-9", name: "Biology 9", teacher: "Ms Kaushal", color: "mint", code: "7K2H9B", studentCount: rosterSize("bio-9") },
      { id: "maths-9", name: "Maths 9", teacher: "Mr Iyer", color: "sky", code: "M9X4QT", studentCount: rosterSize("maths-9") },
      { id: "eng-9", name: "English 9", teacher: "Ms Rao", color: "brand", code: "E9R2WK", studentCount: rosterSize("eng-9") },
      { id: "his-9", name: "History 9", teacher: "Mr Banerjee", color: "amber", code: "H9P7LN", studentCount: rosterSize("his-9") },
    ],
    tasks,
    threads,
    decks,
    ledger,
    rewards: [
      { id: "r-game", title: "Choose the next class game", cost: 80, icon: "game", needsTeacher: true },
      { id: "r-pass", title: "Homework pass, one task", cost: 150, icon: "pass", needsTeacher: true },
      { id: "r-theme", title: "Custom theme unlock", cost: 300, icon: "theme", needsTeacher: false },
    ],
    redemptions: [],
    badges: [
      {
        id: "b-early",
        title: "Early bird",
        description: "Hand in five tasks at least a day early.",
        pattern: ".xx.xxxxxxxx.xx.",
        color: "gold",
        unlocked: true,
      },
      {
        id: "b-week",
        title: "Perfect week",
        description: "Every task in a school week verified on time.",
        pattern: ".xx.xxxx.xx.x..x",
        color: "mint",
        unlocked: true,
      },
      {
        id: "b-books",
        title: "Bookworm",
        description: "Finish five reading tasks.",
        pattern: "xxxxx..xx..xxxxx",
        color: "sky",
        unlocked: false,
        progress: { current: 3, target: 5, unit: "books" },
      },
      {
        id: "b-streak",
        title: "Streak of 10",
        description: "Earn verified points ten school days in a row.",
        pattern: ".xx..xx.xxxx.xx.",
        color: "brand",
        unlocked: false,
        progress: { current: 0, target: 10, unit: "days" },
      },
    ],
    milestones: [
      { id: "m-start", title: "Starter", points: 0, unlock: "Your Clarion profile" },
      { id: "m-explorer", title: "Explorer", points: 100, unlock: "Pixel avatar frame" },
      { id: "m-achiever", title: "Achiever", points: 250, unlock: "Profile banner" },
      { id: "m-scholar", title: "Scholar", points: 500, unlock: "Gold name on the board" },
      { id: "m-legend", title: "Legend", points: 1000, unlock: "Hall of fame spot" },
    ],
    classmates: [
      { id: "s-ananya", name: "Ananya R.", points: 310 },
      { id: "s-rohan", name: "Rohan M.", points: 265 },
      { id: "s-zara", name: "Zara K.", points: 205 },
      { id: "s-aarav", name: "Aarav P.", points: 190 },
      { id: "s-meera", name: "Meera J.", points: 175 },
    ],
    school: [
      { id: "x-1", name: "Student", group: "10A", points: 420 },
      { id: "x-2", name: "Student", group: "9C", points: 385 },
      { id: "x-3", name: "Student", group: "9A", points: 350 },
      { id: "x-4", name: "Student", group: "9B", points: 310 },
      { id: "x-5", name: "Student", group: "10C", points: 290 },
      { id: "x-6", name: "Student", group: "9B", points: 265 },
    ],
    completedEarlierThisTerm: 21,
    chat: [
      {
        id: "m-hello",
        role: "ai",
        text: `Hi Prithu. Your cell structure worksheet is overdue, so start there. The Biology test on ${testDay} covers cell structure and photosynthesis.`,
        at: minutesAgo(now, 3),
        sources: [
          { kind: "task", label: "Task: Cell structure worksheet" },
          { kind: "thread", label: "Q and A, Biology 9" },
        ],
      },
    ],
    showOnLeaderboard: true,
    aiContextClassId: null,
    discussionClassId: null,
    selectedThreadId: null,
    attachments,
    members: demoMembers(["bio-9", "maths-9", "eng-9", "his-9"], "me"),
    submissions,
    teachingClassIds: [],
    rewardRequests: [],
    classBoards: {},
    schoolOverview: null,
    conversationId: null,
  };
}
