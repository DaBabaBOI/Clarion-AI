"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast, useNow } from "@/lib/client-hooks";
import { timeAgo, toISODate } from "@/lib/dates";
import { classById, pendingReviews, roster, sortThreads, sortTasks, teaches, unreadPosts } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import type { Member, SchoolClass } from "@/lib/types";
import { LogoMark } from "../icons";
import { AddTaskModal } from "../tasks/add-task-modal";
import { ReviewRow } from "../tasks/review-list";
import { TaskRow } from "../tasks/task-row";
import { Avatar, Button, CLASS_SWATCH, Card, CardHeader, Chip, EmptyState, TextButton, cx } from "../ui";
import { FlashcardsCard } from "./flashcards";

/** The class page for `?id=`. Keyed so moving between classes starts each one fresh. */
export function ClassDetailFromUrl() {
  const classId = useSearchParams().get("id") ?? "";
  return <ClassDetailView key={classId} classId={classId} />;
}

/** Teachers: the class list with how many pieces of work each student has handed in. */
function RosterCard({ cls, students }: { cls: SchoolClass; students: Member[] }) {
  const state = useAppState()!;
  const set = state.tasks.filter((t) => t.classId === cls.id);
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader title="Students" small>
        <span className="flex-1" />
        <Chip tone="neutral">Code {cls.code}</Chip>
      </CardHeader>
      {students.length === 0 ? (
        <p className="text-[12.5px] text-muted">No students yet. Share the code {cls.code} so they can join.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {students.map((m) => {
            const handedIn = state.submissions.filter((s) => s.studentId === m.userId && s.status !== "returned" && set.some((t) => t.id === s.taskId)).length;
            return (
              <li key={m.userId} className="flex items-center gap-2.5">
                <Avatar name={m.name} size={26} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{m.name}</span>
                <span className="text-[11.5px] text-faint">
                  {handedIn}/{set.length} handed in
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function ClassDetailView({ classId }: { classId: string }) {
  const state = useAppState()!;
  const now = useNow();
  const router = useRouter();
  const today = toISODate(now);
  const [adding, setAdding] = useState(false);
  const cls = classById(state, classId);

  if (!cls) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/classes" className="text-[12.5px] font-semibold text-brand">
          ← My classes
        </Link>
        <EmptyState title="Class not found" body="It may have been archived, or the link is wrong." />
      </div>
    );
  }

  const tasks = sortTasks(state.tasks.filter((t) => t.classId === cls.id));
  const openCount = tasks.filter((t) => t.status === "open").length;
  const posts = sortThreads(state.threads.filter((t) => t.classId === cls.id && t.visibility === "public"))
    .flatMap((t) => t.posts.map((p) => ({ ...p, threadId: t.id })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 2)
    .reverse();
  const unread = unreadPosts(state, cls.id);
  const decks = state.decks.filter((d) => d.classId === cls.id);
  const teaching = teaches(state, cls.id);
  const toReview = pendingReviews(state, cls.id);
  const students = roster(state, cls.id);

  const askClarion = () => {
    actions.setAiContext(cls.id);
    router.push("/ai");
  };
  const generateDeck = () => toast("Deck generation switches on once the AI model is connected");

  return (
    <div className="flex flex-1 flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-[7px] text-[12.5px]">
        <Link href="/classes" className="font-semibold text-brand hover:underline underline-offset-2">
          My classes
        </Link>
        <span className="text-faint">/</span>
        <span className="text-faint" aria-current="page">
          {cls.name}
        </span>
      </nav>

      <div className="flex flex-wrap items-center gap-3.5">
        <span className={cx("size-11 shrink-0 rounded-[12px]", CLASS_SWATCH[cls.color])} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[25px] font-bold leading-tight">{cls.name}</h1>
          <div className="mt-[5px] flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-muted">{cls.teacher}</span>
            <Chip tone="neutral">Code {cls.code}</Chip>
            <Chip tone="neutral">{teaching ? students.length : cls.studentCount} students</Chip>
          </div>
        </div>
        <Button onClick={askClarion}>Ask Clarion about this class</Button>
      </div>

      <div className="flex flex-1 flex-col gap-5 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {teaching && (
            <Card>
              <CardHeader title="Handed in">
                <Chip tone={toReview.length ? "pending" : "neutral"}>{toReview.length} to verify</Chip>
              </CardHeader>
              <div className="mt-3 h-px bg-line" />
              {toReview.length === 0 ? (
                <p className="pt-3 text-[12.5px] text-muted">Nothing waiting. Handed-in work shows up here for you to verify.</p>
              ) : (
                <ul>
                  {toReview.map((r) => (
                    <ReviewRow key={r.submission.id} review={r} now={now} />
                  ))}
                </ul>
              )}
            </Card>
          )}
          <Card>
            <CardHeader title="Deadlines">
              {openCount > 0 && <Chip tone="amber">{openCount} open</Chip>}
              <span className="flex-1" />
              {teaching && <TextButton onClick={() => setAdding(true)}>Set work</TextButton>}
            </CardHeader>
            <div className="mt-3 h-px bg-line" />
            {tasks.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="No deadlines" body={`${cls.teacher} has not set any work yet.`} />
              </div>
            ) : (
              <ul>
                {tasks.map((t) => (
                  <TaskRow key={t.id} task={t} cls={cls} today={today} showClass={false} showSetOn teaching={teaching} />
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-1 flex-col gap-3.5">
            <CardHeader title="Class discussions">
              {unread > 0 && <Chip tone="brand">{unread} new</Chip>}
              <span className="flex-1" />
              <Link
                href="/discussions"
                onClick={() => actions.setDiscussionClass(cls.id)}
                className="text-[12.5px] font-semibold text-brand hover:underline underline-offset-2"
              >
                View all
              </Link>
            </CardHeader>
            {posts.length === 0 ? (
              <EmptyState title="No posts yet" body="Start a thread from Discussions." />
            ) : (
              posts.map((p) => (
                <div key={p.id} className="flex gap-3">
                  <Avatar name={p.author} me={p.mine} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold">{p.author}</span>
                      {p.role === "teacher" && (
                        <Chip tone="teacher" size="sm">
                          Teacher
                        </Chip>
                      )}
                      <span className="text-[11px] text-faint">{timeAgo(p.at, now)}</span>
                    </div>
                    <p className="mt-1 text-[13px] leading-[19px] text-muted">{p.body}</p>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        <div className="flex w-full flex-col gap-5 lg:w-[380px] lg:shrink-0">
          {teaching && <RosterCard cls={cls} students={students} />}
          <FlashcardsCard decks={decks} onGenerate={generateDeck} />
          {!teaching && (
            <section className="flex flex-col gap-[11px] rounded-card bg-sky-soft px-[18px] py-4">
              <div className="flex items-center gap-2">
                <LogoMark size={20} />
                <h2 className="text-[13px] font-bold text-brand">Ready to prepare</h2>
              </div>
              <p className="text-[12.5px] leading-[19px] text-muted">
                Clarion can build a deck from your {cls.name} notes, then check it against {cls.teacher}&apos;s handouts.
              </p>
              <Button variant="secondary" size="sm" full onClick={generateDeck}>
                Generate a deck
              </Button>
            </section>
          )}
        </div>
      </div>

      <AddTaskModal open={adding} onClose={() => setAdding(false)} teachingClasses={teaching ? [cls] : []} defaultClassId={cls.id} />
    </div>
  );
}
