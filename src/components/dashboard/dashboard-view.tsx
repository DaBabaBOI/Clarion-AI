"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useNow } from "@/lib/client-hooks";
import { diffDays, greeting, longDate, monthName, parseISODate, toISODate, WEEKDAYS } from "@/lib/dates";
import {
  classById,
  earnedPoints,
  latestTeacherPost,
  sortTasks,
  suggestion,
  taskStats,
  unreadPosts,
  weekDays,
} from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import { LogoMark } from "../icons";
import { AddTaskModal } from "../tasks/add-task-modal";
import { TaskRow } from "../tasks/task-row";
import { Avatar, Button, ButtonLink, Card, CardHeader, Chip, EmptyState, PageHeader, TextButton, cx } from "../ui";

const STAT_TONES = {
  sky: { bar: "bg-sky", text: "text-sky" },
  amber: { bar: "bg-amber", text: "text-amber" },
  mint: { bar: "bg-mint", text: "text-mint" },
  brand: { bar: "bg-brand", text: "text-brand" },
} as const;

function StatCard({ value, label, tone, href }: { value: number; label: string; tone: keyof typeof STAT_TONES; href?: string }) {
  const body = (
    <>
      <span className={cx("h-1 w-[26px] rounded-[2px]", STAT_TONES[tone].bar)} />
      <span className={cx("text-[27px] font-bold leading-none", STAT_TONES[tone].text)}>{value}</span>
      <span className="text-[12.5px] text-muted">{label}</span>
    </>
  );
  const className = "flex flex-col gap-2.5 rounded-card border border-line bg-white px-5 py-4";
  return href ? (
    <Link href={href} className={cx(className, "transition hover:border-faint")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function DashboardView() {
  const state = useAppState()!;
  const now = useNow();
  const today = toISODate(now);
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const stats = taskStats(state, now);
  const tasks = useMemo(() => sortTasks(state.tasks), [state.tasks]);
  const visible = showAll ? tasks : tasks.slice(0, 5);
  const days = weekDays(now);
  const tip = suggestion(state, now);
  const recent = latestTeacherPost(state);
  const unread = unreadPosts(state);

  const dueOn = (day: string) => state.tasks.filter((t) => t.status === "open" && t.due === day);
  const dayDetail = selectedDay ? dueOn(selectedDay) : [];

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
                <TaskRow key={t.id} task={t} cls={classById(state, t.classId)} today={today} />
              ))}
            </ul>
          )}
        </Card>

        <div className="flex w-full flex-col gap-5 lg:w-[372px] lg:shrink-0">
          <Card>
            <CardHeader title="This week" small>
              <span className="flex-1" />
              <span className="text-[12.5px] text-muted">{monthName(now)}</span>
            </CardHeader>
            <div className="mt-3.5 grid grid-cols-7 gap-1.5" role="group" aria-label="Days this week">
              {days.map((d) => {
                const isToday = d === today;
                const due = dueOn(d);
                const selected = selectedDay === d;
                const date = parseISODate(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDay(selected ? null : d)}
                    aria-pressed={selected}
                    aria-label={`${WEEKDAYS[date.getDay()]} ${date.getDate()}${due.length ? `, ${due.length} due` : ""}`}
                    className={cx(
                      "flex flex-col items-center gap-1.5 rounded-[11px] py-[9px] transition",
                      isToday ? "bg-brand-gradient text-white" : "hover:bg-canvas",
                      selected && !isToday && "bg-canvas ring-1 ring-line",
                      selected && isToday && "ring-2 ring-brand/30 ring-offset-1",
                    )}
                  >
                    <span className={cx("text-[11px] font-semibold", isToday ? "text-white" : "text-faint")}>
                      {WEEKDAYS[date.getDay()][0]}
                    </span>
                    <span className={cx("text-[14px] font-bold", isToday ? "text-white" : "text-ink")}>{date.getDate()}</span>
                    <span className={cx("size-[5px] rounded-full", due.length ? (isToday ? "bg-white" : "bg-amber") : "bg-transparent")} />
                  </button>
                );
              })}
            </div>
            {selectedDay && (
              <div className="mt-3 rounded-[11px] bg-canvas px-3 py-2.5 text-[12.5px]">
                <p className="font-semibold text-ink">
                  {selectedDay === today ? "Today" : WEEKDAYS[parseISODate(selectedDay).getDay()]}
                  {diffDays(selectedDay, today) < 0 && " (past)"}
                </p>
                {dayDetail.length === 0 ? (
                  <p className="mt-0.5 text-muted">Nothing due.</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 text-muted">
                    {dayDetail.map((t) => (
                      <li key={t.id}>
                        {t.title}
                        {t.classId && <span className="text-faint"> · {classById(state, t.classId)?.name}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>

          <section className="rounded-card bg-soft-gradient px-5 py-[18px]">
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

      <AddTaskModal open={adding} onClose={() => setAdding(false)} classes={state.classes} />
    </div>
  );
}
