"use client";

import Link from "next/link";
import { useState } from "react";
import { toast, useNow } from "@/lib/client-hooks";
import { timeAgo } from "@/lib/dates";
import { classHref } from "@/lib/routes";
import { classById } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import type { AppState, ChatMessage, SchoolClass } from "@/lib/types";
import { LogoMark, ThumbDownIcon, ThumbUpIcon } from "../icons";
import { Avatar, Button, Card, CardHeader, Chip, ClassChip, EmptyState, cx } from "../ui";

// The AI Helper's feedback loop, in three places: students rate answers in the
// chat, teachers write notes Clarion follows for their class, and staff see
// how students rated answers about their classes.

const REASONS = ["Too long", "Too vague", "Wrong", "Not about my work"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Real answers can be rated: not the greeting, and (live) only ones saved with an id. */
export function canRate(state: AppState, m: ChatMessage): boolean {
  if (m.role !== "ai" || m.pending || m.error || m.id === "greeting" || m.id === "m-hello") return false;
  return state.mode === "demo" || UUID.test(m.id);
}

export function RateAnswer({ message }: { message: ChatMessage }) {
  const [askWhy, setAskWhy] = useState(false);

  const rate = (rating: 1 | -1) => {
    const next = message.rating === rating ? null : rating;
    actions.rateAnswer(message.id, next);
    setAskWhy(next === -1);
    if (next === 1) toast("Thanks! Clarion will keep answering like this.", "success");
  };

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-ink/5 pt-2">
      <span className="mr-0.5 text-[11px] font-semibold text-muted">Helpful?</span>
      {(
        [
          [1, "Helpful", ThumbUpIcon],
          [-1, "Not helpful", ThumbDownIcon],
        ] as const
      ).map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={message.rating === value}
          title={label}
          onClick={() => rate(value)}
          className={cx(
            "grid size-7 place-items-center rounded-full border transition",
            message.rating === value
              ? value === 1
                ? "border-mint-solid bg-mint-solid text-white"
                : "border-amber-solid bg-amber-solid text-white"
              : "border-line bg-white text-muted hover:text-ink",
          )}
        >
          <Icon />
        </button>
      ))}
      {message.rating === -1 &&
        (askWhy || !message.ratingComment ? (
          REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => {
                actions.rateAnswer(message.id, -1, reason);
                setAskWhy(false);
                toast("Thanks. Clarion will use this next time.", "success");
              }}
              className={cx(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                message.ratingComment === reason ? "border-amber-solid bg-amber-tag text-amber-tag-ink" : "border-line bg-white text-muted hover:text-ink",
              )}
            >
              {reason}
            </button>
          ))
        ) : (
          <button type="button" onClick={() => setAskWhy(true)} className="text-[11px] text-muted hover:text-ink">
            “{message.ratingComment}” · change
          </button>
        ))}
    </div>
  );
}

/** Teachers: the note Clarion reads before answering anything about this class. */
export function ClassNotesCard({ cls }: { cls: SchoolClass }) {
  const state = useAppState()!;
  const saved = state.classNotes[cls.id] ?? "";
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const changed = draft.trim() !== saved;

  return (
    <Card id="clarion-notes" className="flex flex-col gap-3 scroll-mt-24">
      <div className="flex items-center gap-2">
        <LogoMark size={20} />
        <h2 className="text-[15px] font-bold">Notes for Clarion</h2>
        <span className="flex-1" />
        {saved && <Chip tone="mint">Clarion is following this</Chip>}
      </div>
      <p className="text-[12.5px] leading-[18px] text-muted">
        Clarion reads this before answering any question about {cls.name}: what the next test covers, the method you teach, or what to avoid.
      </p>
      <label htmlFor={`notes-${cls.id}`} className="sr-only">
        Notes for Clarion about {cls.name}
      </label>
      <textarea
        id={`notes-${cls.id}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={2000}
        rows={4}
        placeholder="For example: Friday's test covers cells and photosynthesis only. Use the word equation, not the balanced one."
        className="w-full resize-y rounded-control border border-line bg-white px-3 py-2.5 text-[13px] leading-[19px] text-ink placeholder:text-faint focus:border-brand focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[11px] text-faint">{draft.length}/2000</span>
        {changed && (
          <Button variant="secondary" size="sm" onClick={() => setDraft(saved)}>
            Undo
          </Button>
        )}
        <Button
          size="sm"
          disabled={!changed || saving}
          onClick={async () => {
            setSaving(true);
            const ok = await actions.saveClassNote(cls.id, draft);
            setSaving(false);
            if (ok) toast(draft.trim() ? "Clarion will follow your note" : "Note cleared", "success");
          }}
        >
          {saving ? "Saving…" : "Save note"}
        </Button>
      </div>
    </Card>
  );
}

/** Staff: how students rated Clarion's answers about their classes. */
export function StudentFeedbackCard() {
  const state = useAppState()!;
  const now = useNow();
  const items = state.answerFeedback;
  const helpful = items.filter((f) => f.rating === 1).length;
  const unhelpful = items.length - helpful;
  // Unhelpful answers first: they are the ones a note can fix.
  const shown = [...items].sort((a, b) => a.rating - b.rating || b.at.localeCompare(a.at)).slice(0, 3);

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader title="How students rate answers" small>
        <span className="flex-1" />
        {items.length > 0 && (
          <span className="flex items-center gap-2 text-[12px] font-semibold">
            <span className="flex items-center gap-1 text-mint-tag-ink">
              <ThumbUpIcon /> {helpful}
            </span>
            <span className="flex items-center gap-1 text-amber-tag-ink">
              <ThumbDownIcon /> {unhelpful}
            </span>
          </span>
        )}
      </CardHeader>
      {shown.length === 0 ? (
        <EmptyState title="No ratings yet" body="When students rate an answer about your class, it shows here with what they asked." />
      ) : (
        <ul className="flex flex-col">
          {shown.map((f) => {
            const cls = classById(state, f.classId);
            return (
              <li key={f.id} className="flex gap-2.5 border-t border-line py-3 first:border-t-0 first:pt-0">
                <Avatar name={f.studentName} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12.5px] font-semibold">{f.studentName}</span>
                    <Chip tone={f.rating === 1 ? "mint" : "amber"} size="sm">
                      {f.rating === 1 ? "Helpful" : f.comment ?? "Not helpful"}
                    </Chip>
                    <span className="text-[11px] text-faint">{timeAgo(f.at, now)}</span>
                  </div>
                  {f.question && <p className="mt-1 line-clamp-2 text-[12.5px] leading-[18px] text-ink">“{f.question}”</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {cls && <ClassChip cls={cls} />}
                    {cls && f.rating === -1 && (
                      <Link href={`${classHref(cls.id)}#clarion-notes`} className="text-[11.5px] font-semibold text-brand hover:underline underline-offset-2">
                        Add a note for Clarion
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
