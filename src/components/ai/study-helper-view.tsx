"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { presetsFor } from "@/lib/ai-presets";
import { useNow } from "@/lib/client-hooks";
import { diffDays, dueLabel, timeAgo, toISODate } from "@/lib/dates";
import { taskHref } from "@/lib/routes";
import { classById, isStaff, pendingReviews, priorityOf, sortTasks, taskProgress, teaches, type Priority } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import type { AiPresetInfo, AppState, ChatMessage, Source } from "@/lib/types";
import { CloseIcon, LogoMark } from "../icons";
import { Button, Card, CardHeader, Chip, ClassChip, PageHeader, cx, type ChipTone } from "../ui";
import { RateAnswer, StudentFeedbackCard, canRate } from "./feedback";
import { DeckPreview, McqQuiz } from "./generated";

const PRIORITY: Record<Priority, { bar: string; chip: ChipTone; label: string; rank: number }> = {
  urgent: { bar: "bg-amber", chip: "amber", label: "Urgent", rank: 0 },
  today: { bar: "bg-sky", chip: "sky", label: "Today", rank: 1 },
  week: { bar: "bg-brand", chip: "brand", label: "This week", rank: 2 },
  later: { bar: "bg-brand/35", chip: "neutral", label: "Coming up", rank: 3 },
  waiting: { bar: "bg-faint", chip: "pending", label: "Awaiting check", rank: 4 },
  done: { bar: "bg-faint", chip: "mint", label: "Done", rank: 5 },
};

const OUTPUT_DOT: Record<AiPresetInfo["output"], string> = {
  flashcards: "bg-sky",
  quiz: "bg-amber",
  plan: "bg-mint",
  chat: "bg-brand",
};

const RUN_LABEL: Record<AiPresetInfo["output"], string> = {
  flashcards: "Make the deck",
  quiz: "Start the quiz",
  plan: "Plan it",
  chat: "Ask",
};

/** Typed requests for a quiz or flashcards go to those functions, so they come back interactive. */
function presetFromText(text: string, presets: AiPresetInfo[]): { preset: AiPresetInfo; topic: string } | null {
  const match = text
    .trim()
    .match(/^(?:please\s+)?(?:can you\s+)?(quiz me|test me|give me a quiz|make (?:me )?(?:a )?quiz|make (?:me )?(?:some )?flashcards|make (?:me )?a deck|flashcards)(?:\s+(?:on|about|for))?\s*(.*?)[?.!]*$/i);
  if (!match) return null;
  const output = /flashcards|deck/i.test(match[1]) ? "flashcards" : "quiz";
  const preset = presets.find((p) => p.output === output);
  return preset ? { preset, topic: match[2] } : null;
}

/** The one-tap functions: pick one, add a topic if it takes one, and go. */
function PresetBar({
  presets,
  disabled,
  initialKey,
  canClear,
}: {
  presets: AiPresetInfo[];
  disabled: boolean;
  initialKey: string | null;
  canClear: boolean;
}) {
  const [active, setActive] = useState<AiPresetInfo | null>(() => presets.find((p) => p.key === initialKey && p.topicHint) ?? null);
  const [topic, setTopic] = useState("");

  const run = (preset: AiPresetInfo, text: string) => {
    void actions.runPreset(preset.key, text);
    setActive(null);
    setTopic("");
  };
  const pick = (preset: AiPresetInfo) => {
    if (active?.key === preset.key) return setActive(null);
    if (!preset.topicHint) return run(preset, "");
    setActive(preset);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {active && (
        <form
          className="rounded-[12px] bg-canvas px-3 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!disabled) run(active, topic);
          }}
        >
          <div className="flex items-center gap-2">
            <span className={cx("size-2 shrink-0 rounded-[2px]", OUTPUT_DOT[active.output])} aria-hidden="true" />
            <p className="text-[12.5px] font-bold text-ink">{active.label}</p>
            <p className="min-w-0 flex-1 truncate text-[11.5px] text-muted">{active.description}</p>
            <button type="button" onClick={() => setActive(null)} aria-label="Close" className="text-faint hover:text-ink">
              <CloseIcon width={11} height={11} />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label htmlFor="preset-topic" className="sr-only">
              {active.topicHint}
            </label>
            <input
              id="preset-topic"
              autoFocus
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={200}
              placeholder={active.topicHint}
              autoComplete="off"
              className="h-[34px] min-w-0 flex-1 rounded-full border border-line bg-white px-3.5 text-[13px] text-ink placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
            />
            <Button type="submit" size="xs" pill disabled={disabled} className="h-[34px] px-3.5">
              {RUN_LABEL[active.output]}
            </Button>
          </div>
        </form>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Clarion functions">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => pick(p)}
            disabled={disabled}
            title={p.description}
            aria-pressed={active?.key === p.key}
            className={cx(
              "flex items-center gap-1.5 rounded-full border px-3 py-[7px] text-[12.5px] font-semibold transition disabled:opacity-50",
              active?.key === p.key ? "border-brand bg-brand-soft text-brand" : "border-line bg-white text-brand hover:bg-brand-soft",
            )}
          >
            <span className={cx("size-[7px] rounded-[2px]", OUTPUT_DOT[p.output])} aria-hidden="true" />
            {p.label}
          </button>
        ))}
        {canClear && (
          <button
            type="button"
            onClick={() => actions.clearChat()}
            disabled={disabled}
            className="ml-auto rounded-full px-3 py-2 text-[12.5px] font-semibold text-muted hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

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
      {message.deck && <DeckPreview key={`deck-${message.id}`} deck={message.deck} />}
      {message.mcq && <McqQuiz key={`mcq-${message.id}`} quiz={message.mcq} />}
      {canRate(state, message) && <RateAnswer message={message} />}
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
  const presets = presetsFor(state.aiPresets, staff);
  // "Generate a deck" on a class page opens a function here: /ai?preset=flashcards
  const initialPreset = useSearchParams().get("preset");

  const items = useMemo(() => {
    const relevant = state.tasks.filter(
      (t) =>
        (!contextClass || t.classId === contextClass.id) &&
        (t.status !== "verified" || diffDays(today, t.due) <= 7),
    );
    return sortTasks(relevant).sort((a, b) => PRIORITY[priorityOf(a, today)].rank - PRIORITY[priorityOf(b, today)].rank);
  }, [state.tasks, contextClass, today]);

  // New messages scroll into view; a quiz or deck is shown from its start.
  const last = state.chat[state.chat.length - 1];
  const tall = Boolean(last && !last.pending && (last.mcq || last.deck));
  useEffect(() => {
    const el = scrollRef.current;
    const answer = el?.lastElementChild as HTMLElement | null;
    if (!el) return;
    el.scrollTo({ top: tall && answer ? answer.offsetTop - 4 : el.scrollHeight, behavior: "smooth" });
  }, [state.chat.length, last?.id, tall]);

  const lastAnswer = [...state.chat].reverse().find((m) => m.role === "ai" && !m.pending);
  const thinking = state.chat.some((m) => m.pending);

  const send = (text: string) => {
    if (!text.trim() || thinking) return;
    const asked = presetFromText(text, presets);
    if (asked) void actions.runPreset(asked.preset.key, asked.topic);
    else void actions.ask(text, !staff && /\bplan\b|schedule|tonight/i.test(text) ? "plan" : "chat");
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
              className="rounded-full bg-brand px-[22px] py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand-deep disabled:opacity-50"
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
              className="relative flex max-h-[min(580px,calc(var(--screen)*0.6))] flex-col gap-3.5 overflow-y-auto pr-0.5"
              aria-live="polite"
              aria-label="Conversation"
            >
              {state.chat.map((m) => (
                <Message key={m.id} state={state} message={m} />
              ))}
            </div>
            <PresetBar presets={presets} disabled={thinking} initialKey={initialPreset} canClear={state.chat.length > 1} />
          </Card>

          {staff && (
            <div className="order-5 lg:order-none">
              <StudentFeedbackCard />
            </div>
          )}

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
