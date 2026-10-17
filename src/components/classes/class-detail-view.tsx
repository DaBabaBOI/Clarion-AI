"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast, useNow } from "@/lib/client-hooks";
import { timeAgo, toISODate } from "@/lib/dates";
import { classById, sortThreads, sortTasks, unreadPosts } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import { LogoMark } from "../icons";
import { AddTaskModal } from "../tasks/add-task-modal";
import { TaskRow } from "../tasks/task-row";
import { Avatar, Button, CLASS_SWATCH, Card, CardHeader, Chip, EmptyState, TextButton, cx } from "../ui";
import { FlashcardsCard } from "./flashcards";

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
  const teaching = state.teachingClassIds.includes(cls.id);
  const toReview = state.pendingReviews.filter((r) => r.classId === cls.id);

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
            <Chip tone="neutral">{cls.studentCount} students</Chip>
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
                    <li key={r.submissionId} className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0">
                      <Avatar name={r.studentName} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold">{r.title}</p>
                        <p className="text-[11.5px] text-faint">
                          {r.studentName} · handed in {timeAgo(r.submittedAt, now)} · {r.points} pts
                        </p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => actions.reviewSubmission(r.submissionId, "returned")}>
                        Return
                      </Button>
                      <Button size="sm" onClick={() => actions.reviewSubmission(r.submissionId, "verified")}>
                        Verify
                      </Button>
                    </li>
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
          <FlashcardsCard decks={decks} onGenerate={generateDeck} />
          <section className="flex flex-col gap-[11px] rounded-card bg-calm-gradient px-[18px] py-4">
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
        </div>
      </div>

      <AddTaskModal open={adding} onClose={() => setAdding(false)} teachingClasses={teaching ? [cls] : []} defaultClassId={cls.id} />
    </div>
  );
}
