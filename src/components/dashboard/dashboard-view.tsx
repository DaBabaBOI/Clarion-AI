"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useNow } from "@/lib/client-hooks";
import { greeting, longDate, toISODate } from "@/lib/dates";
import { classById, earnedPoints, isStaff, latestTeacherPost, sortTasks, suggestion, taskStats, unreadPosts } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import { LogoMark } from "../icons";
import { AddTaskModal } from "../tasks/add-task-modal";
import { TaskRow } from "../tasks/task-row";
import { StaffDashboard } from "./staff-dashboard";
import { StatCard } from "./stat-card";
import { WeekCard } from "./week-card";
import { Avatar, Button, ButtonLink, Card, CardHeader, Chip, EmptyState, PageHeader, TextButton } from "../ui";

export function DashboardView() {
  const state = useAppState()!;
  return isStaff(state) ? <StaffDashboard /> : <StudentDashboard />;
}

function StudentDashboard() {
  const state = useAppState()!;
  const now = useNow();
  const today = toISODate(now);
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const stats = taskStats(state, now);
  const tasks = useMemo(() => sortTasks(state.tasks), [state.tasks]);
  const visible = showAll ? tasks : tasks.slice(0, 5);
  const tip = suggestion(state, now);
  const recent = latestTeacherPost(state);
  const unread = unreadPosts(state);

  const dueOn = (day: string) => state.tasks.filter((t) => t.status === "open" && t.due === day);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader
        title={`${greeting(now)}, ${state.student.firstName}`}
        subtitle={`${longDate(now)} · ${stats.dueThisWeek} task${stats.dueThisWeek === 1 ? "" : "s"} due this week`}
        actions={<Button onClick={() => setAdding(true)}>Add task</Button>}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard value={stats.dueThisWeek} label="Due this week" tone="sky" />
        <StatCard value={stats.overdue} label="Overdue" tone="amber" />
        <StatCard value={stats.completed} label="Completed" tone="mint" />
        <StatCard value={earnedPoints(state)} label="Points earned" tone="brand" href="/road-to-glory" />
      </div>

      <div className="flex flex-1 flex-col gap-5 lg:flex-row lg:items-stretch">
        <Card className="flex min-w-0 flex-1 flex-col">
          <CardHeader title="Your tasks">
            <span className="flex-1" />
            {tasks.length > 5 && (
              <TextButton onClick={() => setShowAll((v) => !v)}>{showAll ? "Show less" : `View all ${tasks.length}`}</TextButton>
            )}
          </CardHeader>
          <div className="mt-3 h-px bg-line" />
          {visible.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="All clear" body="Nothing is due. Add your own task or check a class for new work." />
            </div>
          ) : (
            <ul>
              {visible.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  cls={classById(state, t.classId)}
                  today={today}
                  teaching={!!t.classId && state.teachingClassIds.includes(t.classId)}
                />
              ))}
            </ul>
          )}
        </Card>

        <div className="flex w-full flex-col gap-5 lg:w-[372px] lg:shrink-0">
          <WeekCard now={now} dueOn={dueOn} />

          <section className="rounded-card bg-brand-soft px-5 py-[18px]">
            <div className="flex items-center gap-2">
              <LogoMark size={20} />
              <h2 className="text-[13px] font-bold text-brand">Clarion suggests</h2>
            </div>
            <p className="mt-3 text-[13.5px] leading-5 text-ink">
              {tip ? tip.reason : "You are all caught up. A short flashcard review keeps it that way."}
            </p>
            <ButtonLink
              href="/ai"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => actions.setAiContext(null)}
            >
              Open AI Helper
            </ButtonLink>
          </section>

          {recent && (
            <Link
              href="/discussions"
              onClick={() => actions.openThread(recent.thread.id)}
              className="block rounded-card border border-line bg-white px-5 py-[18px] transition hover:border-faint"
            >
              <div className="flex items-center">
                <h2 className="text-[15px] font-bold text-ink">Recent discussion</h2>
                <span className="flex-1" />
                {unread > 0 && <Chip tone="brand">{unread} new</Chip>}
              </div>
              <div className="mt-[13px] flex gap-[11px]">
                <Avatar name={recent.post.author} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-[7px]">
                    <span className="text-[12.5px] font-semibold text-ink">{recent.post.author}</span>
                    <Chip tone="teacher" size="sm">
                      Teacher
                    </Chip>
                  </div>
                  <p className="mt-[3px] line-clamp-2 text-[12.5px] leading-[18px] text-muted">{recent.post.body}</p>
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>

      <AddTaskModal
        open={adding}
        onClose={() => setAdding(false)}
        teachingClasses={state.classes.filter((c) => state.teachingClassIds.includes(c.id))}
      />
    </div>
  );
}
