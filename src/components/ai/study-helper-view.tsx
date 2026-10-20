"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNow } from "@/lib/client-hooks";
import { diffDays, dueLabel, timeAgo, toISODate } from "@/lib/dates";
import { taskHref } from "@/lib/routes";
import { classById, isStaff, pendingReviews, priorityOf, sortTasks, taskProgress, teaches, type Priority } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import type { AppState, ChatMessage, Source } from "@/lib/types";
import { CloseIcon, LogoMark } from "../icons";
import { Card, CardHeader, Chip, ClassChip, PageHeader, cx, type ChipTone } from "../ui";

const PRIORITY: Record<Priority, { bar: string; chip: ChipTone; label: string; rank: number }> = {
  urgent: { bar: "bg-amber", chip: "amber", label: "Urgent", rank: 0 },
  today: { bar: "bg-sky", chip: "sky", label: "Today", rank: 1 },
  week: { bar: "bg-brand", chip: "brand", label: "This week", rank: 2 },
  later: { bar: "bg-brand/35", chip: "neutral", label: "Coming up", rank: 3 },
  waiting: { bar: "bg-faint", chip: "pending", label: "Awaiting check", rank: 4 },
  done: { bar: "bg-faint", chip: "mint", label: "Done", rank: 5 },
};

const STUDENT_ACTIONS: { label: string; prompt: string; mode: "chat" | "plan" | "quiz" }[] = [
  { label: "Make a study plan", prompt: "Make me a plan for tonight, I have about 2 hours.", mode: "plan" },
  { label: "Quiz me", prompt: "Quiz me", mode: "quiz" },
];

const STAFF_ACTIONS: typeof STUDENT_ACTIONS = [
  { label: "Who is behind?", prompt: "Who is behind on their work?", mode: "chat" },
  { label: "What should I check first?", prompt: "What should I check first?", mode: "chat" },
  { label: "Draft instructions", prompt: "Help me draft instructions for the next piece of work.", mode: "chat" },
];

const SOURCE_DOT: Record<Source["kind"], string> = {
  task: "bg-mint",
  notes: "bg-sky",
  deck: "bg-sky",
  thread: "bg-brand",
};

function PlanTable({ state, rows }: { state: AppState; rows: NonNullable<ChatMessage["plan"]> }) {
  return (
    <ol className="mt-2.5 overflow-hidden rounded-[8px] border border-line bg-white">
      {rows.map((row, i) => (
        <li key={i} className="flex items-center gap-2.5 border-t border-line px-3 py-2 first:border-t-0">
          <span className="w-12 shrink-0 text-[11.5px] font-bold text-brand">{row.minutes} min</span>
          <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-ink">{row.title}</span>
          <ClassChip cls={classById(state, row.classId)} />
        </li>
      ))}
    </ol>
  );
}

function QuizBubble({ quiz }: { quiz: NonNullable<ChatMessage["quiz"]> }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="mt-2.5 rounded-[10px] bg-white px-3 py-2.5">
      <p className="text-[13px] font-semibold text-ink">{quiz.front}</p>
      {shown ? (
        <p className="mt-1.5 text-[12.5px] leading-[18px] text-muted">{quiz.back}</p>
      ) : (
        <button type="button" onClick={() => setShown(true)} className="mt-1.5 text-[12px] font-semibold text-brand hover:underline">
          Show answer
        </button>
      )}
    </div>
  );
}

function Message({ state, message }: { state: AppState; message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-[14px] bg-brand px-3.5 py-3 text-[13.5px] leading-5 text-white">{message.text}</p>
      </div>
    );
  }
  if (message.pending) {
    return (
      <div className="flex w-fit items-center gap-1.5 rounded-[14px] bg-brand-soft px-4 py-3.5" aria-label="Clarion is thinking">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-bounce rounded-full bg-brand" style={{ animationDelay: `${i * 140}ms` }} />
        ))}
      </div>
    );
  }
  return (
    <div
      className={cx(
        "max-w-full rounded-[14px] px-3.5 py-3 text-[13.5px] leading-5 whitespace-pre-line",
        message.error ? "bg-amber-soft text-ink" : "bg-brand-soft text-ink",
      )}
    >
      <p>{message.text}</p>
      {message.plan && <PlanTable state={state} rows={message.plan} />}
      {message.quiz && <QuizBubble key={message.id} quiz={message.quiz} />}
    </div>
  );
}

/** Staff: work to check (oldest first), then upcoming work and how many have handed it in. */
function StaffPriorityList({ state, now }: { state: AppState; now: Date }) {
  const today = toISODate(now);
  const classId = state.aiContextClassId;
  const reviews = pendingReviews(state).filter((r) => !classId || r.task.classId === classId);
  const upcoming = sortTasks(state.tasks.filter((t) => teaches(state, t.classId) && (!classId || t.classId === classId) && t.due >= today)).slice(0, 6);
  const rows = [
    ...reviews.map((r) => {
      const days = diffDays(today, r.submission.submittedAt.slice(0, 10));
      return {
        key: r.submission.id,
        href: taskHref(r.task.id),
        title: r.task.title,
        detail: `${r.submission.studentName} · handed in ${timeAgo(r.submission.submittedAt, now)}`,
        classId: r.task.classId,
        bar: days >= 2 ? "bg-amber" : "bg-sky",
        chip: { tone: (days >= 2 ? "amber" : "sky") as ChipTone, label: "To check" },
      };
    }),
    ...upcoming.map((t) => {
      const p = taskProgress(state, t);
      const due = dueLabel(t.due, today);
      return {
        key: t.id,
        href: taskHref(t.id),
        title: t.title,
        detail: `${p.handedIn} of ${p.total} handed in`,
        classId: t.classId,
        bar: "bg-brand",
        chip: { tone: due.tone as ChipTone, label: due.label },
      };
    }),
  ];
  return (
    <>
      <div className="mt-3 h-px bg-line" />
      {rows.length === 0 ? (
        <p className="pt-3 text-[12.5px] text-muted">Nothing to check and nothing due. Ask Clarion for lesson ideas.</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.key} className="border-t border-line first:border-t-0">
              <Link href={r.href} className="group flex w-full items-center gap-3.5 py-[13px]">
                <span className={cx("h-[34px] w-1 shrink-0 rounded-[2px]", r.bar)} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-ink group-hover:text-brand">{r.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <ClassChip cls={classById(state, r.classId)} />
                    <span className="text-[11.5px] text-faint">{r.detail}</span>
                  </span>
                </span>
                <Chip tone={r.chip.tone}>{r.chip.label}</Chip>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function StudyHelperView() {
  const state = useAppState()!;
  const now = useNow();
  const today = toISODate(now);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contextClass = classById(state, state.aiContextClassId);
  const staff = isStaff(state);

  const items = useMemo(() => {
    const relevant = state.tasks.filter(
      (t) =>
        (!contextClass || t.classId === contextClass.id) &&
        (t.status !== "verified" || diffDays(today, t.due) <= 7),
    );
    return sortTasks(relevant).sort((a, b) => PRIORITY[priorityOf(a, today)].rank - PRIORITY[priorityOf(b, today)].rank);
  }, [state.tasks, contextClass, today]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [state.chat.length]);

  const lastAnswer = [...state.chat].reverse().find((m) => m.role === "ai" && !m.pending);
  const thinking = state.chat.some((m) => m.pending);

  const send = (text: string, mode?: "chat" | "plan" | "quiz") => {
    if (!text.trim() || thinking) return;
    const lower = text.toLowerCase();
    const inferred = mode ?? (/\bplan\b|schedule|tonight/.test(lower) ? "plan" : /quiz|test me/.test(lower) ? "quiz" : "chat");
    void actions.ask(text, inferred);
    setDraft("");
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader
        title={staff ? "AI Helper" : "Study Helper"}
        subtitle={staff ? "What needs you first across your classes, and a helper that knows them." : "Sorted by what needs you first, not by class."}
      />

      <div className="flex flex-1 flex-col gap-5 lg:flex-row">
        <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-4">
          <Card className="order-3 flex flex-col lg:order-none lg:flex-1">
            <CardHeader title={contextClass ? `What needs you first in ${contextClass.name}` : "What needs you first"}>
              <span className="flex-1" />
              {!staff && (
                <Chip tone="neutral">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </Chip>
              )}
            </CardHeader>
            {staff ? (
              <StaffPriorityList state={state} now={now} />
            ) : (
              <>
                <div className="mt-3 h-px bg-line" />
                <ul>
                  {items.map((t) => {
                    const p = PRIORITY[priorityOf(t, today)];
                    const done = t.status !== "open";
                    return (
                      <li key={t.id} className="border-t border-line first:border-t-0">
                        <button
                          type="button"
                          onClick={() => {
                            setDraft(`Help me get started on ${t.title}`);
                            inputRef.current?.focus();
                          }}
                          className="flex w-full items-center gap-3.5 py-[13px] text-left"
                        >
                          <span className={cx("h-[34px] w-1 shrink-0 rounded-[2px]", p.bar)} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className={cx("block text-[14px] font-semibold", done ? "text-faint" : "text-ink")}>{t.title}</span>
                            <span className="mt-1 block">
                              <ClassChip cls={classById(state, t.classId)} />
                            </span>
                          </span>
                          <Chip tone={p.chip}>{p.label}</Chip>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Card>

          <form
            className="order-2 flex items-center gap-3 rounded-full border border-line bg-white py-2 pr-2 pl-[18px] focus-within:ring-2 focus-within:ring-brand/20 lg:order-none"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <label htmlFor="ask" className="sr-only">
              Ask Clarion
            </label>
            <input
              id="ask"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                contextClass
                  ? `Ask about ${contextClass.name}`
                  : staff
                    ? "Ask about your classes, students' work or a lesson idea"
                    : "Ask about your classes, tasks or notes"
              }
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim() || thinking}
              className="rounded-full bg-ink px-[22px] py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-ink-hover disabled:opacity-50"
            >
              {thinking ? "Thinking…" : "Send"}
            </button>
          </form>
        </div>

        <div className="contents lg:flex lg:w-[380px] lg:shrink-0 lg:flex-col lg:gap-5">
          <Card className="order-1 flex flex-col gap-3.5 lg:order-none">
            <div className="flex items-center gap-[9px]">
              <LogoMark size={22} />
              <h2 className="text-[15px] font-bold">Clarion</h2>
              <span className="flex-1" />
              {contextClass ? (
                <button
                  type="button"
                  onClick={() => actions.setAiContext(null)}
                  aria-label={`Stop focusing on ${contextClass.name}`}
                  className="flex items-center gap-1 rounded-full bg-neutral-tag px-[9px] py-1 text-[11px] font-semibold text-neutral-tag-ink hover:text-ink"
                >
                  {contextClass.name}
                  <CloseIcon width={10} height={10} />
                </button>
              ) : (
                <Chip tone="neutral" className="text-[11px]">
                  Knows your classes
                </Chip>
              )}
            </div>
            <div
              ref={scrollRef}
              className="flex max-h-[min(440px,calc(var(--screen)*0.55))] flex-col gap-3.5 overflow-y-auto pr-0.5"
              aria-live="polite"
              aria-label="Conversation"
            >
              {state.chat.map((m) => (
                <Message key={m.id} state={state} message={m} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(staff ? STAFF_ACTIONS : STUDENT_ACTIONS).map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => send(a.prompt, a.mode)}
                  disabled={thinking}
                  className="rounded-full border border-line bg-white px-3 py-2 text-[12.5px] font-semibold text-brand hover:bg-brand-soft disabled:opacity-50"
                >
                  {a.label}
                </button>
              ))}
              {state.chat.length > 1 && (
                <button
                  type="button"
                  onClick={() => actions.clearChat()}
                  disabled={thinking}
                  className="ml-auto rounded-full px-3 py-2 text-[12.5px] font-semibold text-muted hover:text-ink"
                >
                  Clear
                </button>
              )}
            </div>
          </Card>

          <Card className="order-4 flex flex-col gap-3 lg:order-none">
            <h2 className="text-[14.5px] font-bold">Every answer shows its sources</h2>
            {lastAnswer?.sources?.length ? (
              <ul className="flex flex-col gap-3">
                {lastAnswer.sources.map((s, i) => (
                  <li key={i} className="flex items-center gap-[9px] text-[12.5px] text-muted">
                    <span className={cx("size-2 shrink-0 rounded-[2px]", SOURCE_DOT[s.kind])} aria-hidden="true" />
                    {s.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-muted">
                {state.mode === "live" ? "The last answer used general knowledge, not your files." : "The last answer did not use any of your files."}
              </p>
            )}
            <p className="rounded-control bg-canvas px-3 py-2.5 text-[12px] text-muted">
              {staff ? "Clarion only sees the classes you teach. Student names never leave your school's Clarion." : "Teachers can review AI chats for safety."}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
