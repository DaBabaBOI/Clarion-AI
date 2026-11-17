// Clarion study helper: answers a student's question with Gemini, grounded in
// that student's own tasks, flashcards and class posts. For teachers and
// coordinators it is grounded in the classes they teach instead: the work
// they set, who has handed it in, and what students are asking.
//
// - Runs as the signed-in user (row level security decides what context the
//   model sees), so a student can never read another student's work and a
//   teacher only sees their own classes.
// - Every exchange is stored in ai_messages; class teachers can review chats.
// - Feedback loop: teachers' "Notes for Clarion" (class_ai_notes) join the
//   context, and the asker's recent 👍/👎 ratings (ai_feedback) tell the model
//   what to keep doing and what to avoid.
// - The assistant reply is written with the secret key, so students cannot
//   fabricate answers or sources.
// - The agent is editable in Supabase: ai_settings holds the prompt, model and
//   temperature for students and for staff, and ai_presets the one-tap
//   functions (flashcards, quizzes, study plans and more). Both are read with
//   the secret key on every question, so edits apply straight away. Fixed
//   rules (FORMAT below) are added after the prompt so the app keeps working
//   whatever the prompt says.
// - Needs the GEMINI_API_KEY secret. GEMINI_MODEL is the model to use when
//   ai_settings does not name one; GEMINI_FALLBACK_MODEL answers when that
//   model is busy or unavailable.

import { withSupabase } from "npm:@supabase/server@1.9.2";

const DEFAULT_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
// Used when the chosen model is busy, down or misnamed in ai_settings.
const FALLBACK_MODEL = Deno.env.get("GEMINI_FALLBACK_MODEL") ?? "gemini-flash-lite-latest";
const MAX_QUESTION = 2000;
const MAX_TOPIC = 200;
const MAX_PER_MINUTE = 8;

type Output = "chat" | "plan" | "flashcards" | "quiz";

interface RequestBody {
  message?: string;
  conversationId?: string | null;
  classId?: string | null;
  /** A preset's key (ai_presets); its instruction is sent to the model. */
  preset?: string | null;
  /** What the person typed in the preset's topic box. */
  topic?: string | null;
  /** Older app versions: "plan" or "quiz" instead of a preset. */
  mode?: string;
  today?: string; // the student's local date, yyyy-mm-dd
}

interface Settings {
  prompt: string;
  model: string;
  temperature: number;
}

interface Preset {
  key: string;
  audience: "student" | "staff";
  label: string;
  output: Output;
  instruction: string;
}

interface Source {
  id: string;
  kind: "task" | "deck" | "thread";
  label: string;
  text: string;
}

interface ModelAnswer {
  answer: string;
  source_ids?: string[];
  plan?: { task_id: string; minutes: number }[];
  deck?: { title?: string; cards?: { front?: string; back?: string }[] };
  mcq?: {
    title?: string;
    questions?: { question?: string; options?: string[]; correct?: number; explanation?: string }[];
  };
}

// Used only if the ai_settings row is missing; edit the prompt there.
const FALLBACK_PROMPT = {
  student:
    "You are Clarion, a friendly study helper for secondary school students (ages 11 to 16). Teach, do not do the work for them. Keep answers short, clear and encouraging.",
  staff:
    "You are Clarion, an assistant for secondary school teachers and coordinators. Keep answers short and practical. Only mention students who appear in the context.",
};

// Fixed rules added after the editable prompt: how the app reads the reply.
const FORMAT = {
  student: `How Clarion's app works (always follow these):
- CONTEXT lists the student's own tasks, flashcards and class posts, each with an id in square brackets. Use them whenever they are relevant and list the ids you used in source_ids. Never invent ids.
- If the context does not cover the question, answer from general school-level knowledge, say that it is general knowledge, and leave source_ids empty.`,
  staff: `How Clarion's app works (always follow these):
- CONTEXT lists the work this teacher set, who has handed it in, work waiting to be checked and recent student posts in their classes, each with an id in square brackets. Use them whenever they are relevant and list the ids you used in source_ids. Never invent ids, students or numbers.
- If the context does not cover the question, answer from general teaching knowledge and say so.`,
  outputs: `- Reply in JSON. answer is plain text shown in the chat (no markdown headings).
- A TASK line, when present, is a preset function the person chose: do what it says. TOPIC is what they typed for it.
- OUTPUT plan: fill plan with task ids from the CONTEXT and minutes for each, and summarise the plan in answer.
- OUTPUT flashcards: fill deck with a short title (under 60 characters) and cards. Each card has a front (a short question or prompt) and a back (a short, correct answer). Facts must be accurate for the year group. answer is a one sentence lead-in.
- OUTPUT quiz: fill mcq with a short title and questions. Each question has exactly 4 options, one correct; correct is the 0-based index of the correct option; explanation says in one sentence why it is right. Vary which position is correct. answer is a one sentence lead-in and must not reveal any answers.`,
};

const STRING = { type: "STRING" };

function responseSchema(output: Output) {
  const properties: Record<string, unknown> = { answer: STRING, source_ids: { type: "ARRAY", items: STRING } };
  const required = ["answer", "source_ids"];
  if (output === "plan") {
    properties.plan = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { task_id: STRING, minutes: { type: "INTEGER" } },
        required: ["task_id", "minutes"],
      },
    };
  }
  if (output === "flashcards") {
    properties.deck = {
      type: "OBJECT",
      properties: {
        title: STRING,
        cards: {
          type: "ARRAY",
          items: { type: "OBJECT", properties: { front: STRING, back: STRING }, required: ["front", "back"] },
        },
      },
      required: ["title", "cards"],
    };
    required.push("deck");
  }
  if (output === "quiz") {
    properties.mcq = {
      type: "OBJECT",
      properties: {
        title: STRING,
        questions: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              question: STRING,
              options: { type: "ARRAY", items: STRING },
              correct: { type: "INTEGER" },
              explanation: STRING,
            },
            required: ["question", "options", "correct", "explanation"],
          },
        },
      },
      required: ["title", "questions"],
    };
    required.push("mcq");
  }
  return { type: "OBJECT", properties, required };
}

const clean = (value: unknown, max: number) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** A deck the app can show and save: 2 to 20 cards that fit the flashcards table. */
function checkDeck(deck: ModelAnswer["deck"], fallbackTitle: string) {
  const cards = (deck?.cards ?? [])
    .map((c) => ({ front: clean(c?.front, 300), back: clean(c?.back, 600) }))
    .filter((c) => c.front && c.back)
    .slice(0, 20);
  if (cards.length < 2) return null;
  return { title: clean(deck?.title, 80) || fallbackTitle, cards };
}

/** A quiz the app can mark: 1 to 10 questions, each with 2 to 6 different options and a valid answer. */
function checkQuiz(mcq: ModelAnswer["mcq"], fallbackTitle: string) {
  const questions = (mcq?.questions ?? [])
    .map((q) => {
      const options = (q?.options ?? []).map((o) => clean(o, 200)).filter(Boolean);
      const correct = Number(q?.correct);
      const unique = new Set(options.map((o) => o.toLowerCase())).size === options.length;
      if (!unique || options.length < 2 || options.length > 6) return null;
      if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) return null;
      const question = clean(q?.question, 400);
      return question ? { question, options, correct, explanation: clean(q?.explanation, 400) } : null;
    })
    .filter((q): q is NonNullable<typeof q> => q !== null)
    .slice(0, 10);
  if (!questions.length) return null;
  return { title: clean(mcq?.title, 80) || fallbackTitle, questions };
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "The AI helper is not configured yet (GEMINI_API_KEY is missing)." }, 503);

    const userId = ctx.userClaims?.id;
    if (!userId) return json({ error: "Sign in first" }, 401);

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Send a JSON body" }, 400);
    }
    const classId = body.classId ?? null;
    const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today ?? "") ? body.today! : new Date().toISOString().slice(0, 10);
    const topic = clean(body.topic, MAX_TOPIC);
    const presetKey = typeof body.preset === "string" && /^[a-z0-9-]{2,40}$/.test(body.preset) ? body.preset : null;

    const db = ctx.supabase;
    const admin = ctx.supabaseAdmin;

    // Who is asking decides the prompt and the context: students get their
    // own work, teachers and coordinators get the classes they teach.
    const { data: profile } = await db.from("profiles").select("role").eq("id", userId).single();
    const staff = profile?.role === "teacher" || profile?.role === "admin";
    const audience = staff ? "staff" : "student";

    // The editable agent (read with the secret key: people cannot read the
    // prompt or the presets' instructions themselves).
    const [settingsRes, presetRes] = await Promise.all([
      admin.from("ai_settings").select("prompt, model, temperature").eq("audience", audience).maybeSingle(),
      presetKey
        ? admin.from("ai_presets").select("key, audience, label, output, instruction").eq("key", presetKey).eq("active", true).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (settingsRes.error) console.error("Could not read ai_settings", settingsRes.error.message);
    const settings: Settings = {
      prompt: settingsRes.data?.prompt ?? FALLBACK_PROMPT[audience],
      model: settingsRes.data?.model?.trim() || DEFAULT_MODEL,
      temperature: Math.min(2, Math.max(0, Number(settingsRes.data?.temperature ?? 0.4))),
    };
    const preset = presetRes.data as Preset | null;
    if (body.preset && (!preset || preset.audience !== audience)) {
      return json({ error: "That function is not available any more. Reload the page to see the current ones." }, 400);
    }

    // What shows in the chat as the question.
    const message = preset ? `${preset.label}${topic ? `: ${topic}` : ""}` : (body.message ?? "").trim().slice(0, MAX_QUESTION);
    if (!message) return json({ error: "Ask a question first" }, 400);
    // Older app versions ask for a plan with mode instead of a preset.
    const output: Output = preset?.output ?? (body.mode === "plan" ? "plan" : "chat");
    // Plans are built from a student's own tasks.
    const effective: Output = staff && output === "plan" ? "chat" : output;

    // Light rate limit so one account cannot run up the AI bill.
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count: recent } = await db
      .from("ai_messages")
      .select("id, ai_conversations!inner(user_id)", { count: "exact", head: true })
      .eq("role", "user")
      .eq("ai_conversations.user_id", userId)
      .gte("created_at", since);
    if ((recent ?? 0) >= MAX_PER_MINUTE) {
      return json({ error: "That is a lot of questions in a minute. Take a short break and try again." }, 429);
    }

    // Conversation: reuse the student's own, or start one.
    let conversationId = body.conversationId ?? null;
    if (conversationId) {
      const { data } = await db.from("ai_conversations").select("id").eq("id", conversationId).eq("user_id", userId).maybeSingle();
      if (!data) conversationId = null;
    }
    if (!conversationId) {
      const { data, error } = await db
        .from("ai_conversations")
        .insert({ user_id: userId, class_id: classId, title: message.slice(0, 80) })
        .select("id")
        .single();
      if (error || !data) return json({ error: "Could not start a chat" }, 500);
      conversationId = data.id;
    }

    const { data: history } = await db
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    const { error: insertError } = await db.from("ai_messages").insert({ conversation_id: conversationId, role: "user", content: message });
    if (insertError) return json({ error: "Could not save your question" }, 500);

    const sources: Source[] = [];
    let context: string;
    // Student plans map task ids back to these rows.
    let tasks: any[] = [];

    if (staff) {
      const shift = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
      const { data: teaching } = await db.from("class_members").select("class_id").eq("user_id", userId).eq("role", "teacher");
      const classIds = (teaching ?? []).map((r: any) => r.class_id).filter((id: string) => !classId || id === classId);
      const [classesRes, setRes, rosterRes, postsRes] = await Promise.all([
        db.from("classes").select("id, name"),
        db
          .from("tasks")
          .select("id, class_id, title, due_on, points")
          .in("class_id", classIds)
          .gte("due_on", shift(today, -14))
          .lte("due_on", shift(today, 21))
          .order("due_on")
          .limit(40),
        db.from("class_members").select("class_id, user_id, profiles(full_name)").in("class_id", classIds).eq("role", "student"),
        db
          .from("posts")
          .select("id, body, created_at, author_id, threads!inner(title, class_id), profiles(full_name)")
          .in("threads.class_id", classIds)
          .neq("author_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      const className = new Map((classesRes.data ?? []).map((c: any) => [c.id, c.name]));
      const set: any[] = setRes.data ?? [];
      const { data: subs } = set.length
        ? await db
            .from("task_submissions")
            .select("task_id, student_id, status, submitted_at")
            .in(
              "task_id",
              set.map((t) => t.id),
            )
        : { data: [] as any[] };
      const roster: any[] = rosterRes.data ?? [];
      const nameOf = new Map(roster.map((m) => [m.user_id, m.profiles?.full_name ?? "Student"]));

      for (const [i, t] of set.entries()) {
        const students = roster.filter((m) => m.class_id === t.class_id);
        const mine = (subs ?? []).filter((x: any) => x.task_id === t.id);
        const inIds = new Set(mine.filter((x: any) => x.status !== "returned").map((x: any) => x.student_id));
        const waiting = mine.filter((x: any) => x.status === "submitted").length;
        const missing = students.filter((m) => !inIds.has(m.user_id)).map((m) => nameOf.get(m.user_id));
        sources.push({
          id: `T${i + 1}`,
          kind: "task",
          label: `Task: ${t.title}`,
          text: `${t.title} | ${className.get(t.class_id) ?? "Class"} | due ${t.due_on} | ${t.points} pts | handed in ${inIds.size}/${students.length} | waiting to check ${waiting} | not handed in: ${missing.slice(0, 15).join(", ") || "nobody"}`,
        });
      }
      const waitingSubs = (subs ?? [])
        .filter((x: any) => x.status === "submitted")
        .sort((a: any, b: any) => a.submitted_at.localeCompare(b.submitted_at))
        .slice(0, 15);
      for (const [i, x] of waitingSubs.entries()) {
        const t = set.find((task) => task.id === x.task_id);
        sources.push({
          id: `S${i + 1}`,
          kind: "task",
          label: `Task: ${t?.title ?? "Work"}`,
          text: `Waiting to check: ${nameOf.get(x.student_id) ?? "A student"} handed in "${t?.title}" (${className.get(t?.class_id) ?? ""}) at ${x.submitted_at}`,
        });
      }
      const posts: any[] = postsRes.data ?? [];
      for (const [i, p] of posts.entries()) {
        sources.push({
          id: `P${i + 1}`,
          kind: "thread",
          label: p.threads?.title ?? "Class thread",
          text: `${p.threads?.title} (${className.get(p.threads?.class_id) ?? ""}) | ${p.profiles?.full_name ?? "Someone"} at ${p.created_at}: ${p.body}`,
        });
      }
      context = [
        `Today is ${today}. The user is a ${profile?.role === "admin" ? "coordinator who also teaches" : "teacher"}.${classId ? ` They are asking about ${className.get(classId) ?? "one class"}.` : ""}`,
        classIds.length ? "CONTEXT:" : "CONTEXT: they do not teach any classes yet.",
        ...sources.map((s) => `[${s.id}] ${s.text}`),
      ].join("\n");
    } else {
      // Context, read as the student so row level security applies.
      const classFilter = (q: any) => (classId ? q.eq("class_id", classId) : q);
      const [classesRes, tasksRes, subsRes, decksRes, reviewsRes, postsRes] = await Promise.all([
        db.from("classes").select("id, name"),
        classFilter(db.from("tasks").select("id, class_id, owner_id, title, due_on, points")).order("due_on").limit(60),
        db.from("task_submissions").select("task_id, status").eq("student_id", userId),
        classFilter(db.from("flashcard_decks").select("id, class_id, title, flashcards(id, front, back, position)")).limit(12),
        db.from("flashcard_reviews").select("card_id").eq("user_id", userId),
        db
          .from("posts")
          .select("id, body, created_at, threads!inner(title, class_id), profiles(full_name)")
          .order("created_at", { ascending: false })
          .limit(classId ? 30 : 15),
      ]);

      const className = new Map((classesRes.data ?? []).map((c: any) => [c.id, c.name]));
      const status = new Map((subsRes.data ?? []).map((s: any) => [s.task_id, s.status]));
      const reviewed = new Set((reviewsRes.data ?? []).map((r: any) => r.card_id));

      for (const [i, t] of (tasksRes.data ?? []).entries()) {
        const s = status.get(t.id) ?? "open";
        if (s === "verified" && t.due_on < today) continue;
        sources.push({
          id: `T${i + 1}`,
          kind: "task",
          label: `Task: ${t.title}`,
          text: `${t.title} | ${t.class_id ? (className.get(t.class_id) ?? "Class") : "Personal"} | due ${t.due_on} | ${s} | ${t.points} pts`,
        });
      }
      let card = 0;
      for (const d of decksRes.data ?? []) {
        for (const c of (d.flashcards ?? []).sort((a: any, b: any) => a.position - b.position)) {
          if (card >= 40) break;
          card++;
          sources.push({
            id: `C${card}`,
            kind: "deck",
            label: `Flashcards: ${d.title}`,
            text: `${d.title} (${className.get(d.class_id) ?? ""}) | Q: ${c.front} | A: ${c.back} | ${reviewed.has(c.id) ? "reviewed" : "not reviewed"}`,
          });
        }
      }
      // Embedded rows (thread, author) come back as objects; the client is untyped here.
      const posts: any[] = postsRes.data ?? [];
      for (const [i, p] of posts.entries()) {
        if (classId && p.threads?.class_id !== classId) continue;
        sources.push({
          id: `P${i + 1}`,
          kind: "thread",
          label: p.threads?.title ?? "Class thread",
          text: `${p.threads?.title} (${className.get(p.threads?.class_id) ?? ""}) | ${p.profiles?.full_name ?? "Someone"}: ${p.body}`,
        });
      }

      tasks = tasksRes.data ?? [];
      context = [
        `Today is ${today}.${classId ? ` The student is asking about ${className.get(classId) ?? "one class"}.` : ""}`,
        "CONTEXT:",
        ...sources.map((s) => `[${s.id}] ${s.text}`),
      ].join("\n");
    }

    // Feedback loop: the class notes teachers wrote for Clarion, and this
    // person's recent ratings, both read as them.
    const [notesRes, ratingsRes] = await Promise.all([
      classId
        ? db.from("class_ai_notes").select("class_id, body, classes(name)").eq("class_id", classId)
        : db.from("class_ai_notes").select("class_id, body, classes(name)"),
      db.from("ai_feedback").select("rating, comment, ai_messages(content)").eq("user_id", userId).order("created_at", { ascending: false }).limit(6),
    ]);
    const notes: any[] = (notesRes.data ?? []).filter((n: any) => n.body?.trim());
    const ratings: any[] = ratingsRes.data ?? [];
    const snippet = (text: string) => text.replace(/\s+/g, " ").slice(0, 220);
    if (notes.length) {
      context += `\n\nTEACHER NOTES:\n${notes.map((n) => `- ${n.classes?.name ?? "Class"}: ${snippet(n.body)}`).join("\n")}`;
    }
    if (ratings.length) {
      context += `\n\nFEEDBACK:\n${ratings
        .map(
          (f) =>
            `- ${f.rating > 0 ? "Helpful" : "Not helpful"}: "${snippet(f.ai_messages?.content ?? "")}"${f.comment ? ` (they said: ${snippet(f.comment)})` : ""}`,
        )
        .join("\n")}`;
    }

    const contents = [
      ...(history ?? []).reverse().map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      {
        role: "user",
        parts: [
          {
            text: preset
              ? `${context}\n\nOUTPUT: ${effective}\nTASK: ${preset.instruction}\nTOPIC: ${topic || "(none given)"}`
              : `${context}\n\nOUTPUT: ${effective}\nQUESTION: ${message}`,
          },
        ],
      },
    ];

    const system = `${settings.prompt.trim()}\n\n${FORMAT[audience]}\n${FORMAT.outputs}`;
    const request = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        temperature: settings.temperature,
        // Room for a 20 card deck or a 10 question quiz, and for thinking.
        maxOutputTokens: effective === "chat" || effective === "plan" ? 2048 : 6144,
        responseMimeType: "application/json",
        responseSchema: responseSchema(effective),
      },
    });
    // An overloaded model can hang instead of refusing, so every call has a
    // time limit (a hung call counts as busy) and the whole answer stays well
    // inside the Edge Function's 150 second limit.
    const generate = async (model: string, ms: number): Promise<Response> => {
      try {
        return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: request,
          signal: AbortSignal.timeout(ms),
        });
      } catch (e) {
        console.error("Gemini", model, "gave no answer within", ms, "ms:", e instanceof Error ? e.name : String(e));
        return new Response(null, { status: 504 });
      }
    };
    const busy = (r: Response) => r.status === 429 || r.status >= 500;

    // A model that is busy right away gets one more try; one that is busy or
    // too slow twice, or missing, hands over to the fallback model.
    let model = settings.model;
    let res = await generate(model, 30_000);
    if (busy(res) && res.status !== 504) {
      await res.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      res = await generate(model, 25_000);
    }
    if ((busy(res) || res.status === 404) && FALLBACK_MODEL !== model) {
      console.error("Gemini", model, res.status, "so trying", FALLBACK_MODEL);
      await res.body?.cancel();
      model = FALLBACK_MODEL;
      res = await generate(model, 40_000);
    }

    if (!res.ok) {
      const detail = await res.text();
      console.error("Gemini error", model, res.status, detail.slice(0, 500));
      return json(
        {
          error: busy(res)
            ? "Clarion is very busy right now. Try again in a minute."
            : "The AI helper could not answer right now. Try again in a moment.",
        },
        502,
      );
    }

    const result = await res.json();
    const candidate = result?.candidates?.[0];
    const raw = candidate?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    let parsed: ModelAnswer;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        answer:
          candidate?.finishReason === "SAFETY"
            ? "I can't help with that one. If something is worrying you, please talk to a teacher or the school counsellor."
            : candidate?.finishReason === "MAX_TOKENS" || raw.trim().startsWith("{")
              ? "That answer came out too long. Try again with a narrower topic."
              : raw.trim() || "I could not come up with an answer. Try asking in a different way.",
        source_ids: [],
      };
    }

    parsed.answer = String(parsed.answer ?? "").trim() || "I could not come up with an answer. Try asking in a different way.";

    const byId = new Map(sources.map((s) => [s.id, s]));
    const used = [...new Set(parsed.source_ids ?? [])]
      .map((id) => byId.get(id))
      .filter((s): s is Source => Boolean(s))
      .map((s) => ({ kind: s.kind, label: s.label }));
    const uniqueSources = used.filter((s, i) => used.findIndex((o) => o.label === s.label) === i);

    const plan =
      effective === "plan" && parsed.plan?.length
        ? parsed.plan
            .map((row) => {
              const src = byId.get(row.task_id);
              const index = src ? Number(src.id.slice(1)) - 1 : -1;
              const task = index >= 0 ? tasks[index] : null;
              return task
                ? { minutes: Math.max(5, Math.min(180, Math.round(Number(row.minutes) || 0))), title: task.title, classId: task.class_id }
                : null;
            })
            .filter(Boolean)
        : null;
    const fallbackTitle = topic || preset?.label || "Study";
    const deck = effective === "flashcards" ? checkDeck(parsed.deck, fallbackTitle) : null;
    const mcq = effective === "quiz" ? checkQuiz(parsed.mcq, fallbackTitle) : null;
    if ((effective === "flashcards" && !deck) || (effective === "quiz" && !mcq)) {
      parsed.answer = `I could not make that ${effective === "quiz" ? "quiz" : "deck"} properly this time. Try again, or give a more specific topic.`;
    }

    const stored = { sources: uniqueSources, plan, deck, mcq, preset: preset?.key ?? null };
    const { data: reply, error: replyError } = await ctx.supabaseAdmin
      .from("ai_messages")
      .insert({ conversation_id: conversationId, role: "assistant", content: parsed.answer.slice(0, 20000), sources: stored })
      .select("id")
      .single();
    if (replyError) console.error("Could not store reply", replyError.message);

    // messageId lets the app rate this answer (ai_feedback).
    return json({
      conversationId,
      messageId: reply?.id ?? null,
      answer: parsed.answer,
      sources: uniqueSources,
      plan,
      deck,
      mcq,
      model,
    });
  }),
};
