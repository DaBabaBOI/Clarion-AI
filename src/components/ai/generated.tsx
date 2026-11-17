"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "@/lib/client-hooks";
import { classHref } from "@/lib/routes";
import { isStaff, teaches } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import type { GeneratedDeck, GeneratedQuiz } from "@/lib/types";
import { CheckIcon } from "../icons";
import { Button, cx } from "../ui";

// What the AI Helper's preset functions make: a multiple-choice quiz the app
// marks as you go, and a flashcard deck you can flip through and keep.

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function quizAsText(quiz: GeneratedQuiz): string {
  return [
    quiz.title,
    "",
    ...quiz.questions.flatMap((q, i) => [
      `${i + 1}. ${q.question}`,
      ...q.options.map((o, j) => `   ${LETTERS[j]}) ${o}`),
      `   Answer: ${LETTERS[q.correct]}. ${q.explanation}`,
      "",
    ]),
  ].join("\n");
}

function copy(text: string, what: string) {
  void navigator.clipboard
    ?.writeText(text)
    .then(() => toast(`${what} copied`, "success"))
    .catch(() => toast(`Could not copy the ${what.toLowerCase()}`));
}

/** One question at a time: pick an answer, see if it was right and why, then move on. */
export function McqQuiz({ quiz }: { quiz: GeneratedQuiz }) {
  const state = useAppState()!;
  const staff = isStaff(state);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>(() => quiz.questions.map(() => null));
  const total = quiz.questions.length;
  const finished = index >= total;
  const score = picks.filter((p, i) => p === quiz.questions[i]?.correct).length;

  const restart = () => {
    setPicks(quiz.questions.map(() => null));
    setIndex(0);
  };

  if (finished) {
    const missed = quiz.questions.filter((q, i) => picks[i] !== q.correct);
    const verdict = score === total ? "Perfect score." : score >= total * 0.6 ? "Nice work." : "Keep going, you are learning what to revise.";
    return (
      <div className="mt-2.5 rounded-[12px] border border-line bg-white px-3.5 py-3" aria-live="polite">
        <p className="text-[11px] font-bold tracking-wide text-brand uppercase">{quiz.title}</p>
        <p className="mt-1.5 text-[20px] font-bold text-ink">
          {score} of {total}
        </p>
        <p className="text-[12.5px] text-muted">{verdict}</p>
        {missed.length > 0 && (
          <ul className="mt-2.5 flex flex-col gap-1.5 border-t border-line pt-2.5">
            {missed.map((q) => (
              <li key={q.question} className="text-[12px] leading-[17px] text-muted">
                <span className="font-semibold text-ink">{q.question}</span> {q.options[q.correct]}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="xs" pill onClick={restart}>
            Try again
          </Button>
          {missed.length > 0 && !staff && (
            <SaveMissed quiz={quiz} missed={missed} />
          )}
          {staff && (
            <Button size="xs" pill variant="secondary" onClick={() => copy(quizAsText(quiz), "Quiz")}>
              Copy quiz
            </Button>
          )}
        </div>
      </div>
    );
  }

  const q = quiz.questions[index];
  const picked = picks[index];
  const answered = picked !== null;

  return (
    <div className="mt-2.5 rounded-[12px] border border-line bg-white px-3.5 py-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[11px] font-bold tracking-wide text-brand uppercase">{quiz.title}</p>
        <span className="text-[11px] font-semibold text-faint">
          {index + 1} / {total}
        </span>
      </div>
      <div className="mt-1.5 flex gap-1" aria-hidden="true">
        {quiz.questions.map((qq, i) => (
          <span
            key={i}
            className={cx(
              "h-1 flex-1 rounded-full",
              picks[i] === null ? (i === index ? "bg-brand/40" : "bg-line") : picks[i] === qq.correct ? "bg-mint" : "bg-amber",
            )}
          />
        ))}
      </div>
      <p className="mt-2.5 text-[13.5px] leading-[19px] font-semibold text-ink">{q.question}</p>
      <div className="mt-2 flex flex-col gap-1.5" role="group" aria-label="Answers">
        {q.options.map((option, i) => {
          const right = answered && i === q.correct;
          const wrong = answered && i === picked && i !== q.correct;
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => setPicks((p) => p.map((v, j) => (j === index ? i : v)))}
              aria-label={`${LETTERS[i]}: ${option}${right ? " (correct)" : wrong ? " (your answer, wrong)" : ""}`}
              className={cx(
                "flex items-start gap-2.5 rounded-[9px] border px-2.5 py-2 text-left text-[12.5px] leading-[17px] transition",
                right
                  ? "border-mint bg-mint-soft text-ink"
                  : wrong
                    ? "border-amber bg-amber-soft text-ink"
                    : answered
                      ? "border-line text-faint"
                      : "border-line text-ink hover:border-brand hover:bg-brand-soft",
              )}
            >
              <span
                className={cx(
                  "grid size-5 shrink-0 place-items-center rounded-full text-[10.5px] font-bold",
                  right ? "bg-mint text-white" : wrong ? "bg-amber text-white" : "bg-canvas text-muted",
                )}
                aria-hidden="true"
              >
                {right ? <CheckIcon width={10} height={10} /> : LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1">{option}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-2.5 flex flex-col items-start gap-2" aria-live="polite">
          <p className="text-[12px] leading-[17px] text-muted">
            <span className={cx("font-bold", picked === q.correct ? "text-mint-solid" : "text-amber-solid")}>
              {picked === q.correct ? "Correct. " : `Not quite: it is ${LETTERS[q.correct]}. `}
            </span>
            {q.explanation}
          </p>
          <Button size="xs" pill onClick={() => setIndex((i) => i + 1)}>
            {index + 1 < total ? "Next question" : "See my score"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Students: turn the questions they got wrong into flashcards. */
function SaveMissed({ quiz, missed }: { quiz: GeneratedQuiz; missed: GeneratedQuiz["questions"] }) {
  const deck: GeneratedDeck = {
    title: `${quiz.title.replace(/\s*quiz$/i, "")}: to revise`.slice(0, 80),
    cards: missed.map((q) => ({ front: q.question, back: `${q.options[q.correct]}. ${q.explanation}`.trim() })),
  };
  const [open, setOpen] = useState(false);
  if (open) return <SaveDeck deck={deck} compact />;
  return (
    <Button size="xs" pill variant="secondary" onClick={() => setOpen(true)}>
      Make flashcards of the ones I missed
    </Button>
  );
}

/** Where a generated deck can go: a student's classes, or the classes a teacher teaches. */
function SaveDeck({ deck, compact = false }: { deck: GeneratedDeck; compact?: boolean }) {
  const state = useAppState()!;
  const staff = isStaff(state);
  const classes = state.classes.filter((c) => (staff ? teaches(state, c.id) : true));
  const preferred = classes.find((c) => c.id === state.aiContextClassId) ?? classes[0];
  const [classId, setClassId] = useState(preferred?.id ?? "");
  const [saving, setSaving] = useState(false);
  const selectId = useId();
  const saved = state.decks.some((d) => d.classId === classId && d.title === deck.title.trim().slice(0, 80));
  const cls = classes.find((c) => c.id === classId);

  if (!classes.length) {
    return <p className="text-[12px] text-muted">Join a class to keep decks.</p>;
  }
  if (saved && cls) {
    return (
      <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-mint-solid">
        <CheckIcon width={12} height={12} />
        {staff ? `Shared with ${cls.name}` : `Saved to ${cls.name}`}
        <Link href={classHref(cls.id)} className="text-brand hover:underline">
          Open
        </Link>
      </p>
    );
  }
  return (
    <div className={cx("flex flex-wrap items-center gap-2", compact && "w-full")}>
      {classes.length > 1 && (
        <>
          <label htmlFor={selectId} className="sr-only">
            Class
          </label>
          <select
            id={selectId}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="h-[30px] max-w-[150px] rounded-full border border-line bg-white px-2.5 text-[12px] text-ink focus:border-brand focus:outline-none"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </>
      )}
      <Button
        size="xs"
        pill
        disabled={saving || !classId}
        onClick={async () => {
          setSaving(true);
          await actions.saveGeneratedDeck(deck, classId);
          setSaving(false);
        }}
      >
        {saving ? "Saving…" : staff ? `Share with ${classes.length > 1 ? "class" : (cls?.name ?? "class")}` : "Save to my flashcards"}
      </Button>
    </div>
  );
}

/** Flip through the deck the AI made, see every card, and keep it. */
export function DeckPreview({ deck }: { deck: GeneratedDeck }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [all, setAll] = useState(false);
  const card = deck.cards[index % deck.cards.length];
  const go = (step: number) => {
    setIndex((i) => (i + step + deck.cards.length) % deck.cards.length);
    setFlipped(false);
  };

  return (
    <div className="mt-2.5 rounded-[12px] border border-line bg-white px-3.5 py-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[11px] font-bold tracking-wide text-brand uppercase">{deck.title}</p>
        <span className="text-[11px] font-semibold text-faint">{deck.cards.length} cards</span>
      </div>
      {all ? (
        <ol className="mt-2 flex max-h-[260px] flex-col gap-1.5 overflow-y-auto">
          {deck.cards.map((c, i) => (
            <li key={i} className="rounded-[8px] bg-canvas px-2.5 py-2 text-[12px] leading-[17px]">
              <p className="font-semibold text-ink">{c.front}</p>
              <p className="mt-0.5 text-muted">{c.back}</p>
            </li>
          ))}
        </ol>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setFlipped((v) => !v)}
            aria-label={flipped ? `Answer: ${card.back}. Tap to see the question.` : `Question: ${card.front}. Tap to flip.`}
            className={cx(
              "mt-2 flex min-h-[104px] w-full flex-col items-center justify-center gap-1.5 rounded-[10px] px-4 py-4 text-center transition",
              flipped ? "bg-sky-soft" : "bg-brand-soft",
            )}
          >
            <span className="text-[9.5px] font-bold tracking-wide text-brand">{flipped ? "BACK" : "FRONT"}</span>
            <span className="text-[13.5px] leading-[19px] font-semibold text-ink">{flipped ? card.back : card.front}</span>
          </button>
          <div className="mt-2 flex items-center gap-2">
            <Button size="xs" variant="secondary" pill onClick={() => go(-1)} aria-label="Previous card">
              ←
            </Button>
            <span className="flex-1 text-center text-[11.5px] text-faint">
              Card {(index % deck.cards.length) + 1} of {deck.cards.length}
            </span>
            <Button size="xs" variant="secondary" pill onClick={() => go(1)} aria-label="Next card">
              →
            </Button>
          </div>
        </>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
        <SaveDeck deck={deck} />
        <span className="flex-1" />
        <button type="button" onClick={() => setAll((v) => !v)} className="text-[12px] font-semibold text-brand hover:underline">
          {all ? "Flip through" : "See all cards"}
        </button>
      </div>
    </div>
  );
}
