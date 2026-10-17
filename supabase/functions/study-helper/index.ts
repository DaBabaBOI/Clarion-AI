// Clarion study helper: answers a student's question with Gemini, grounded in
// that student's own tasks, flashcards and class posts.
//
// - Runs as the signed-in student (row level security decides what context
//   the model sees), so it can never read another student's work.
// - Every exchange is stored in ai_messages; class teachers can review chats.
// - The assistant reply is written with the secret key, so students cannot
//   fabricate answers or sources.
// - Needs the GEMINI_API_KEY secret. GEMINI_MODEL optionally pins a model.

import { withSupabase } from "npm:@supabase/server@1.9.2";

const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
const MAX_QUESTION = 2000;
const MAX_PER_MINUTE = 8;

type Mode = "chat" | "plan" | "quiz";

interface RequestBody {
  message?: string;
  conversationId?: string | null;
  classId?: string | null;
  mode?: Mode;
  today?: string; // the student's local date, yyyy-mm-dd
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
  quiz?: { question: string; answer: string };
}

const SYSTEM = `You are Clarion, a friendly study helper for secondary school students (ages 11 to 16).

How to answer:
- Use the CONTEXT (the student's own tasks, flashcards and class posts) whenever it is relevant, and list the ids of the items you used in source_ids. Never invent ids.
- If the context does not cover the question, answer from general school-level knowledge, say that it is general knowledge, and leave source_ids empty.
- Teach, do not do the work for them: explain, give steps, examples and checks. Do not write whole essays or hand over answers to assessed tasks; offer an outline or feedback instead.
- Keep answers short and clear: at most about 150 words, plain sentences, no markdown headings.
- Be encouraging and calm. Deadlines are information, not pressure.
- Stay age appropriate. Refuse anything harmful, and if a student mentions self harm, bullying or feeling unsafe, kindly tell them to talk to a trusted adult or the school counsellor.

Modes:
- plan: build a study plan from open tasks (most urgent first) that fits the time the student mentions (90 minutes if they do not say). Fill plan with task ids and minutes, and summarise it in answer.
- quiz: ask ONE question from the student's flashcards (prefer cards they have not reviewed). Put it in quiz.question and the correct answer in quiz.answer; answer should be a short lead-in such as "From your Photosynthesis deck:". Do not reveal the answer in answer.
- chat: answer the question.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    answer: { type: "STRING" },
    source_ids: { type: "ARRAY", items: { type: "STRING" } },
    plan: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { task_id: { type: "STRING" }, minutes: { type: "INTEGER" } },
        required: ["task_id", "minutes"],
      },
    },
    quiz: {
      type: "OBJECT",
      properties: { question: { type: "STRING" }, answer: { type: "STRING" } },
      required: ["question", "answer"],
    },
  },
  required: ["answer", "source_ids"],
};

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
    const message = (body.message ?? "").trim().slice(0, MAX_QUESTION);
    const mode: Mode = body.mode === "plan" || body.mode === "quiz" ? body.mode : "chat";
    const classId = body.classId ?? null;
    const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today ?? "") ? body.today! : new Date().toISOString().slice(0, 10);
    if (!message) return json({ error: "Ask a question first" }, 400);

    const db = ctx.supabase;

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

    const { error: insertError } = await db
      .from("ai_messages")
      .insert({ conversation_id: conversationId, role: "user", content: message });
    if (insertError) return json({ error: "Could not save your question" }, 500);

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
    const sources: Source[] = [];

    for (const [i, t] of (tasksRes.data ?? []).entries()) {
      const s = status.get(t.id) ?? "open";
      if (s === "verified" && t.due_on < today) continue;
      sources.push({
        id: `T${i + 1}`,
        kind: "task",
        label: `Task: ${t.title}`,
        text: `${t.title} | ${t.class_id ? className.get(t.class_id) ?? "Class" : "Personal"} | due ${t.due_on} | ${s} | ${t.points} pts`,
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

    const context = [
      `Today is ${today}.${classId ? ` The student is asking about ${className.get(classId) ?? "one class"}.` : ""}`,
      "CONTEXT:",
      ...sources.map((s) => `[${s.id}] ${s.text}`),
    ].join("\n");

    const contents = [
      ...(history ?? []).reverse().map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: `${context}\n\nMODE: ${mode}\nQUESTION: ${message}` }] },
    ];

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1200,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Gemini error", res.status, detail.slice(0, 500));
      return json({ error: "The AI helper could not answer right now. Try again in a moment." }, 502);
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

    const tasks = tasksRes.data ?? [];
    const plan =
      mode === "plan" && parsed.plan?.length
        ? parsed.plan
            .map((row) => {
              const src = byId.get(row.task_id);
              const index = src ? Number(src.id.slice(1)) - 1 : -1;
              const task = index >= 0 ? tasks[index] : null;
              return task ? { minutes: Math.max(5, Math.min(180, row.minutes)), title: task.title, classId: task.class_id } : null;
            })
            .filter(Boolean)
        : undefined;
    const quiz = mode === "quiz" && parsed.quiz ? { deck: "", front: parsed.quiz.question, back: parsed.quiz.answer } : undefined;

    const stored = { sources: uniqueSources, plan: plan ?? null, quiz: quiz ?? null };
    const { error: replyError } = await ctx.supabaseAdmin
      .from("ai_messages")
      .insert({ conversation_id: conversationId, role: "assistant", content: parsed.answer.slice(0, 20000), sources: stored });
    if (replyError) console.error("Could not store reply", replyError.message);

    return json({ conversationId, answer: parsed.answer, sources: uniqueSources, plan: plan ?? null, quiz: quiz ?? null, model: MODEL });
  }),
};
