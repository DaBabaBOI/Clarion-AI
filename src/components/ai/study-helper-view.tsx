"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNow } from "@/lib/client-hooks";
import { diffDays, toISODate } from "@/lib/dates";
import { classById, priorityOf, sortTasks, type Priority } from "@/lib/selectors";
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
        <p className="max-w-[85%] rounded-[14px] bg-brand-gradient px-3.5 py-3 text-[13.5px] leading-5 text-white">{message.text}</p>
      </div>
    );
  }
  return (
    <div className="max-w-full rounded-[14px] bg-brand-soft px-3.5 py-3 text-[13.5px] leading-5 text-ink">
      <p>{message.text}</p>
      {message.plan && <PlanTable state={state} rows={message.plan} />}
      {message.quiz && <QuizBubble key={message.id} quiz={message.quiz} />}
    </div>
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

  const lastAnswer = [...state.chat].reverse().find((m) => m.role === "ai");

  const send = (text: string) => {
    if (!text.trim()) return;
    actions.ask(text);
    setDraft("");
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader title="Study Helper" subtitle="Sorted by what needs you first, not by class." />

      <div className="flex flex-1 flex-col gap-5 lg:flex-row">
        <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-4">
          <Card className="order-3 flex flex-col lg:order-none lg:flex-1">
            <CardHeader title={contextClass ? `What needs you first in ${contextClass.name}` : "What needs you first"}>
              <span className="flex-1" />
              <Chip tone="neutral">
                {items.length} item{items.length === 1 ? "" : "s"}
              </Chip>
            </CardHeader>
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
              placeholder={contextClass ? `Ask about ${contextClass.name}` : "Ask about your classes, tasks or notes"}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="rounded-full bg-brand-gradient px-[22px] py-2.5 text-[13.5px] font-semibold text-white transition disabled:opacity-50"
            >
              Send
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
                  className="flex items-center gap-1 rounded-full bg-canvas px-[9px] py-1 text-[11px] font-semibold text-muted hover:text-ink"
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
              className="flex max-h-[min(440px,55dvh)] flex-col gap-3.5 overflow-y-auto pr-0.5"
              aria-live="polite"
              aria-label="Conversation"
            >
              {state.chat.map((m) => (
                <Message key={m.id} state={state} message={m} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => send("Make me a plan for tonight, I have about 2 hours.")}
                className="rounded-full border border-line bg-white px-3 py-2 text-[12.5px] font-semibold text-brand hover:bg-brand-soft"
              >
                Make a study plan
              </button>
              <button
                type="button"
                onClick={() => send("Quiz me")}
                className="rounded-full border border-line bg-white px-3 py-2 text-[12.5px] font-semibold text-brand hover:bg-brand-soft"
              >
                Quiz me
              </button>
              {state.chat.length > 1 && (
                <button
                  type="button"
                  onClick={() => actions.clearChat()}
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
              <p className="text-[12.5px] text-muted">The last answer did not use any of your files.</p>
            )}
            <p className="rounded-control bg-canvas px-3 py-2.5 text-[12px] text-muted">Teachers can review AI chats for safety.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
