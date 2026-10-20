"use client";

import Link from "next/link";
import { useState } from "react";
import { diffDays, monthName, parseISODate, toISODate, WEEKDAYS } from "@/lib/dates";
import { taskHref } from "@/lib/routes";
import { classById, weekDays } from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import type { Task } from "@/lib/types";
import { Card, CardHeader, cx } from "../ui";

/** Monday to Sunday with a dot on days something is due. Pick a day to see what. */
export function WeekCard({ now, dueOn }: { now: Date; dueOn: (day: string) => Task[] }) {
  const state = useAppState()!;
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const today = toISODate(now);
  const days = weekDays(now);
  const dayDetail = selectedDay ? dueOn(selectedDay) : [];
  // A week that runs into the next month names both.
  const first = parseISODate(days[0]);
  const last = parseISODate(days[6]);
  const month = first.getMonth() === last.getMonth() ? monthName(first) : `${monthName(first)} – ${monthName(last)}`;

  return (
    <Card>
      <CardHeader title="This week" small>
        <span className="flex-1" />
        <span className="text-[12.5px] text-muted">{month}</span>
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
                isToday ? "bg-ink text-white" : "hover:bg-canvas",
                selected && !isToday && "bg-canvas ring-1 ring-line",
                selected && isToday && "ring-2 ring-ink/25 ring-offset-1",
              )}
            >
              <span className={cx("text-[11px] font-semibold", isToday ? "text-white" : "text-faint")}>{WEEKDAYS[date.getDay()][0]}</span>
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
                  <Link href={taskHref(t.id)} className="hover:text-brand hover:underline underline-offset-2">
                    {t.title}
                  </Link>
                  {t.classId && <span className="text-faint"> · {classById(state, t.classId)?.name}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
