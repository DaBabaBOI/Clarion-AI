"use client";

import Link from "next/link";
import { useState } from "react";
import { useNow } from "@/lib/client-hooks";
import { diffDays, dueLabel, numberWord, toISODate } from "@/lib/dates";
import { classHref } from "@/lib/routes";
import { cardsInClass, isStaff, nextDeadline, pendingReviews, roster, taskProgress, taskStats, teaches, unreadPosts } from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import type { AppState, SchoolClass } from "@/lib/types";
import { Button, ButtonLink, CLASS_SWATCH, Chip, EmptyState, PageHeader, StatusChip, cx } from "../ui";
import { JoinClassModal } from "./join-class-modal";

function Count({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cx("text-[19px] font-bold leading-tight", value === 0 ? "text-faint" : tone)}>{value}</span>
      <span className="text-[11px] text-faint">{label}</span>
    </div>
  );
}

function ClassCard({ state, cls, today }: { state: AppState; cls: SchoolClass; today: string }) {
  const teaching = teaches(state, cls.id);
  const open = state.tasks.filter((t) => t.classId === cls.id && t.status === "open");
  const reviews = teaching ? pendingReviews(state, cls.id) : [];
  // Students: something is overdue. Teachers: work has waited two days or more to be checked.
  const attention = teaching
    ? reviews.some((r) => diffDays(today, r.submission.submittedAt.slice(0, 10)) >= 2)
    : open.some((t) => diffDays(t.due, today) < 0);
  const next = teaching
    ? (state.tasks.filter((t) => t.classId === cls.id && t.due >= today).sort((a, b) => a.due.localeCompare(b.due))[0] ?? null)
    : nextDeadline(state, cls.id);
  const progress = teaching && next ? taskProgress(state, next) : null;
  const due = next ? dueLabel(next.due, today) : null;
  const href = classHref(cls.id);

  return (
    <article className="flex flex-col gap-3.5 rounded-card border border-line bg-white px-5 py-[18px]">
      <div className="flex items-center gap-[11px]">
        <span className={cx("size-[34px] shrink-0 rounded-[9px]", CLASS_SWATCH[cls.color])} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold leading-tight text-ink">
            <Link href={href} className="hover:underline underline-offset-2">
              {cls.name}
            </Link>
          </h2>
          <p className="text-[12.5px] text-muted">{teaching ? `Code ${cls.code}` : cls.teacher}</p>
        </div>
        {attention && (
          <Chip tone="solid-amber" size="sm">
            Needs attention
          </Chip>
        )}
      </div>
      <div className="h-px bg-line" />
      <div className="flex gap-[34px]">
        {teaching ? (
          <>
            <Count value={reviews.length} label="to check" tone="text-amber" />
            <Count value={roster(state, cls.id).length} label="students" tone="text-brand" />
            <Count value={unreadPosts(state, cls.id)} label="new posts" tone="text-sky" />
          </>
        ) : (
          <>
            <Count value={open.length} label="tasks due" tone="text-amber" />
            <Count value={unreadPosts(state, cls.id)} label="new posts" tone="text-brand" />
            <Count value={cardsInClass(state, cls.id)} label="flashcards" tone="text-sky" />
          </>
        )}
      </div>
      <div className="flex items-center gap-2.5 rounded-[11px] bg-canvas px-3 py-2.5">
        <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-muted">
          {next ? `Next: ${next.title}` : "No deadlines set"}
        </p>
        {progress && (
          <Chip tone="neutral">
            {progress.handedIn}/{progress.total} in
          </Chip>
        )}
        {next && due && (progress ? <Chip tone={due.tone}>{due.label}</Chip> : <StatusChip status={next.status} due={due} returned={next.returned} />)}
      </div>
      <ButtonLink href={href} size="sm" full variant="secondary">
        Open class
      </ButtonLink>
    </article>
  );
}

export function ClassesView() {
  const state = useAppState()!;
  const now = useNow();
  const today = toISODate(now);
  const [joining, setJoining] = useState(false);
  const { open } = taskStats(state, now);
  const staff = isStaff(state);
  const toCheck = pendingReviews(state).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My classes"
        subtitle={
          staff
            ? `You teach ${numberWord(state.teachingClassIds.length, true)} class${state.teachingClassIds.length === 1 ? "" : "es"}, ${numberWord(toCheck, true)} piece${toCheck === 1 ? "" : "s"} of work to check.`
            : `${numberWord(state.classes.length)} classes this term, ${numberWord(open, true)} task${open === 1 ? "" : "s"} still open.`
        }
        actions={
          !staff && (
            <Button variant="secondary" onClick={() => setJoining(true)}>
              Join a class
            </Button>
          )
        }
      />
      {state.classes.length === 0 && (
        <EmptyState title="No classes yet" body="Classes you teach or join show up here." />
      )}
      <div className="grid gap-[18px] md:grid-cols-2">
        {state.classes.map((c) => (
          <ClassCard key={c.id} state={state} cls={c} today={today} />
        ))}
      </div>
      <JoinClassModal open={joining} onClose={() => setJoining(false)} classes={state.classes} />
    </div>
  );
}
