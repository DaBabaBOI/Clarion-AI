"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useNow } from "@/lib/client-hooks";
import { greeting, longDate, toISODate } from "@/lib/dates";
import { classById, earnedPoints, isStaff, latestTeacherPost, sortTasks, suggestion, taskStats, unreadPosts } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import type { TaskStatus } from "@/lib/types";
import { LogoMark } from "../icons";
import { AddTaskModal } from "../tasks/add-task-modal";
import { TaskRow } from "../tasks/task-row";
import { StaffDashboard } from "./staff-dashboard";
import { StatCard } from "./stat-card";
import { WeekCard } from "./week-card";
import { Avatar, Button, ButtonLink, Card, CardHeader, Chip, EmptyState, PageHeader, Segmented, TextButton } from "../ui";

const TASK_VIEWS: { value: TaskStatus; label: string }[] = [
  { value: "open", label: "To do" },
  { value: "submitted", label: "Handed in" },
  { value: "verified", label: "Done" },
];

const PREVIEW = 6;

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
  const [view, setView] = useState<TaskStatus>("open");

  const stats = taskStats(state, now);
  // To do and handed in run soonest due first; done work shows the latest first.
  const tasks = useMemo(() => {
    const sorted = sortTasks(state.tasks.filter((t) => t.status === view));
    return view === "verified" ? sorted.reverse() : sorted;
  }, [state.tasks, view]);
  const visible = showAll ? tasks : tasks.slice(0, PREVIEW);
  const waiting = state.tasks.filter((t) => t.status === "submitted").length;
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

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Card className="flex min-w-0 flex-1 flex-col">
          <CardHeader title="Your tasks">
            <span className="flex-1" />
            {tasks.length > PREVIEW && (
              <TextButton onClick={() => setShowAll((v) => !v)}>{showAll ? "Show less" : `View all ${tasks.length}`}</TextButton>
            )}
            <Segmented
              label="Show tasks"
              options={TASK_VIEWS}
              value={view}
              onChange={(v) => {
                setView(v);
                setShowAll(false);
              }}
            />
          </CardHeader>
          <div className="mt-3 h-px bg-line" />
          {visible.length === 0 ? (
            <div className="mt-4">
              <TaskEmptyState view={view} hasTasks={state.tasks.length > 0} waiting={waiting} onAdd={() => setAdding(true)} />
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

          <section className="rounded-card border border-line bg-white px-5 py-[18px]">
            <div className="flex items-center gap-2">
              <LogoMark size={20} />
              <h2 className="text-[13px] font-bold text-ink">Clarion suggests</h2>
            </div>
            <p className="mt-3 text-[13.5px] leading-5 text-ink">
              {tip
                ? tip.reason
                : state.decks.length
                  ? "You are all caught up. A short flashcard review keeps it that way."
                  : "You are all caught up. Ask the AI Helper to quiz you on what you covered this week."}
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

function TaskEmptyState({ view, hasTasks, waiting, onAdd }: { view: TaskStatus; hasTasks: boolean; waiting: number; onAdd: () => void }) {
  if (view === "submitted") {
    return <EmptyState title="Nothing handed in" body="Tick a task to hand it in. It waits here until your teacher checks it." />;
  }
  if (view === "verified") {
    return <EmptyState title="Nothing done yet" body="Work your teacher has verified shows up here, with the points it earned." />;
  }
  if (!hasTasks) {
    return (
      <EmptyState
        title="Nothing to do yet"
        body="Work your teachers set shows up here. You can add your own tasks too."
        action={
          <Button variant="secondary" size="sm" onClick={onAdd}>
            Add a task
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      title="All clear"
      body={
        waiting
          ? `Nothing left to do. ${waiting} handed in and waiting for your teacher to check.`
          : "Nothing left to do. Add your own task or check a class for new work."
      }
    />
  );
}
