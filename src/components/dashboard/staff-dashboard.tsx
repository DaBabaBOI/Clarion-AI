"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useNow } from "@/lib/client-hooks";
import { greeting, longDate, toISODate } from "@/lib/dates";
import { classById, latestStudentPost, pendingReviews, staffStats, staffSuggestion, teaches, unreadPosts } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import { RewardRequestsCard } from "../glory/reward-requests";
import { LogoMark } from "../icons";
import { AddTaskModal } from "../tasks/add-task-modal";
import { ReviewRow } from "../tasks/review-list";
import { TaskRow } from "../tasks/task-row";
import { Avatar, Button, ButtonLink, Card, CardHeader, Chip, EmptyState, PageHeader, Segmented, TextButton } from "../ui";
import { SchoolOverview, schoolTotals } from "./school-overview";
import { StatCard } from "./stat-card";
import { WeekCard } from "./week-card";

/**
 * The dashboard for teachers and coordinators. Same layout as the student
 * one: what needs doing first (work to check), the work they set, and the
 * week, with the coordinator's school overview at the top of the main column.
 */
export function StaffDashboard() {
  const state = useAppState()!;
  const now = useNow();
  const today = toISODate(now);
  const [adding, setAdding] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showAllWork, setShowAllWork] = useState(false);
  const [panel, setPanel] = useState<"check" | "work">("check");

  const coordinator = state.role === "admin" && state.schoolOverview !== null;
  const stats = staffStats(state, now);
  const reviews = pendingReviews(state);
  const teachingClasses = state.classes.filter((c) => teaches(state, c.id));
  // Upcoming work soonest first, then anything due in the last fortnight.
  const work = useMemo(() => {
    const set = state.tasks.filter((t) => teaches(state, t.classId));
    const upcoming = set.filter((t) => t.due >= today).sort((a, b) => a.due.localeCompare(b.due));
    const recent = set.filter((t) => t.due < today).sort((a, b) => b.due.localeCompare(a.due));
    return [...upcoming, ...recent];
  }, [state, today]);
  const latest = latestStudentPost(state);
  const unread = unreadPosts(state);
  const dueOn = (day: string) => state.tasks.filter((t) => teaches(state, t.classId) && t.due === day);
  const totals = coordinator ? schoolTotals(state.schoolOverview!) : null;

  const reviewsToggle = reviews.length > 3 && (
    <TextButton onClick={() => setShowAllReviews((v) => !v)}>{showAllReviews ? "Show less" : `View all ${reviews.length}`}</TextButton>
  );
  const reviewsBody =
    reviews.length === 0 ? (
      <div className="mt-4">
        <EmptyState title="All caught up" body="Handed-in work appears here. Verifying it is what pays students their points." />
      </div>
    ) : (
      <ul>
        {(showAllReviews ? reviews : reviews.slice(0, 3)).map((r) => (
          <ReviewRow key={r.submission.id} review={r} now={now} />
        ))}
      </ul>
    );
  const workToggle = work.length > 4 && (
    <TextButton onClick={() => setShowAllWork((v) => !v)}>{showAllWork ? "Show less" : `View all ${work.length}`}</TextButton>
  );
  const workBody =
    work.length === 0 ? (
      <div className="mt-4">
        <EmptyState
          title="No work set"
          body={teachingClasses.length ? "Set work for a class and it shows up here with who has handed it in." : "You are not teaching a class yet."}
          action={
            teachingClasses.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                Set work
              </Button>
            )
          }
        />
      </div>
    ) : (
      <ul>
        {(showAllWork ? work : work.slice(0, 4)).map((t) => (
          <TaskRow key={t.id} task={t} cls={classById(state, t.classId)} today={today} teaching />
        ))}
      </ul>
    );

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader
        title={`${greeting(now)}, ${state.student.firstName}`}
        subtitle={`${longDate(now)} · ${stats.toCheck ? `${stats.toCheck} piece${stats.toCheck === 1 ? "" : "s"} of work to check` : "nothing to check"}`}
        actions={teachingClasses.length > 0 && <Button onClick={() => setAdding(true)}>Set work</Button>}
      />

      {totals ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard value={totals.classes} label="Classes in school" tone="brand" />
          <StatCard value={totals.students} label="Students" tone="sky" />
          <StatCard value={totals.waiting} label="Waiting to be checked" tone="amber" />
          <StatCard value={totals.verified} label="Verified this week" tone="mint" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard value={stats.toCheck} label="To check" tone="amber" />
          <StatCard value={stats.dueThisWeek} label="Due this week" tone="sky" />
          <StatCard value={stats.students} label="Students" tone="brand" href="/classes" />
          <StatCard value={stats.verifiedThisWeek} label="Verified this week" tone="mint" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {coordinator && <SchoolOverview rows={state.schoolOverview!} now={now} />}

          {coordinator ? (
            // Coordinators have the school overview above, so their own
            // classes share one card: what to check, or the work they set.
            <Card>
              <CardHeader title="Your classes">
                <span className="flex-1" />
                {panel === "check" ? reviewsToggle : workToggle}
                <Segmented
                  label="Show"
                  options={[
                    { value: "check", label: `To check · ${reviews.length}` },
                    { value: "work", label: "Work you set" },
                  ]}
                  value={panel}
                  onChange={setPanel}
                />
              </CardHeader>
              <div className="mt-3 h-px bg-line" />
              {panel === "check" ? reviewsBody : workBody}
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader title="To check">
                  <Chip tone={reviews.length ? "pending" : "neutral"}>{reviews.length}</Chip>
                  <span className="flex-1" />
                  {reviewsToggle}
                </CardHeader>
                <div className="mt-3 h-px bg-line" />
                {reviewsBody}
              </Card>

              <Card>
                <CardHeader title="Work you set">
                  <span className="flex-1" />
                  {workToggle}
                </CardHeader>
                <div className="mt-3 h-px bg-line" />
                {workBody}
              </Card>
            </>
          )}
        </div>

        <div className="flex w-full flex-col gap-4 lg:w-[372px] lg:shrink-0">
          <WeekCard now={now} dueOn={dueOn} />

          <section className="rounded-card bg-brand-soft px-5 py-[18px]">
            <div className="flex items-center gap-2">
              <LogoMark size={20} />
              <h2 className="text-[13px] font-bold text-brand">Clarion suggests</h2>
            </div>
            <p className="mt-3 text-[13.5px] leading-5 text-ink">{staffSuggestion(state, now)}</p>
            <ButtonLink href="/ai" variant="secondary" size="sm" className="mt-3" onClick={() => actions.setAiContext(null)}>
              Open AI Helper
            </ButtonLink>
          </section>

          <RewardRequestsCard requests={state.rewardRequests} now={now} />

          {latest && (
            <Link
              href="/discussions"
              onClick={() => actions.openThread(latest.thread.id)}
              className="block rounded-card border border-line bg-white px-5 py-[18px] transition hover:border-faint"
            >
              <div className="flex items-center">
                <h2 className="text-[15px] font-bold text-ink">Latest from students</h2>
                <span className="flex-1" />
                {unread > 0 && <Chip tone="brand">{unread} new</Chip>}
              </div>
              <div className="mt-[13px] flex gap-[11px]">
                <Avatar name={latest.post.author} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-[7px]">
                    <span className="text-[12.5px] font-semibold text-ink">{latest.post.author}</span>
                    <span className="text-[11.5px] text-faint">in {classById(state, latest.thread.classId)?.name}</span>
                  </div>
                  <p className="mt-[3px] line-clamp-2 text-[12.5px] leading-[18px] text-muted">{latest.post.body}</p>
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>

      <AddTaskModal open={adding} onClose={() => setAdding(false)} teachingClasses={teachingClasses} defaultClassId={teachingClasses[0]?.id ?? null} />
    </div>
  );
}
