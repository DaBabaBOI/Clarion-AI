"use client";

import Link from "next/link";
import { useState } from "react";
import { diffDays, toISODate } from "@/lib/dates";
import { classHref } from "@/lib/routes";
import type { ClassOverview } from "@/lib/types";
import { CLASS_SWATCH, Card, CardHeader, Chip, TextButton, cx } from "../ui";

/** Classes shown before "View all", unless more than this need attention. */
const PREVIEW = 4;

function waitingDays(row: ClassOverview, today: string): number {
  return row.oldestWaiting ? diffDays(today, toISODate(new Date(row.oldestWaiting))) : 0;
}

/** Work left unchecked for three days, or a lot of missing work, needs a nudge. */
export function needsAttention(row: ClassOverview, today: string): boolean {
  return waitingDays(row, today) >= 3 || row.missing >= Math.max(5, row.students / 2);
}

export function schoolTotals(rows: ClassOverview[]) {
  return {
    classes: rows.length,
    students: rows.reduce((n, r) => n + r.students, 0),
    waiting: rows.reduce((n, r) => n + r.waiting, 0),
    verified: rows.reduce((n, r) => n + r.verifiedThisWeek, 0),
  };
}

/** Coordinators: every class in the school, counts only, the ones needing a nudge first. */
export function SchoolOverview({ rows, now }: { rows: ClassOverview[]; now: Date }) {
  const [showAll, setShowAll] = useState(false);
  const today = toISODate(now);
  const sorted = [...rows].sort((a, b) => Number(needsAttention(b, today)) - Number(needsAttention(a, today)) || a.name.localeCompare(b.name));
  const flagged = rows.filter((r) => needsAttention(r, today)).length;
  const preview = Math.max(PREVIEW, flagged);
  const visible = showAll ? sorted : sorted.slice(0, preview);

  return (
    <Card>
      <CardHeader title="School overview">
        {flagged > 0 && <Chip tone="solid-amber">{flagged} need attention</Chip>}
        <span className="flex-1" />
        {rows.length > preview && (
          <TextButton onClick={() => setShowAll((v) => !v)}>{showAll ? "Show less" : `View all ${rows.length} classes`}</TextButton>
        )}
      </CardHeader>
      <div className="-mx-5 mt-3 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-y border-line bg-canvas text-[11.5px] font-semibold text-muted">
              <th scope="col" className="py-2.5 pr-3 pl-5 font-semibold">
                Class
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Students
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Due this week
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                To check
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Missing
              </th>
              <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-semibold">
                Verified this week
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const days = waitingDays(r, today);
              const name = (
                <span className="font-semibold text-ink">
                  {r.name}
                </span>
              );
              return (
                <tr key={r.classId} className="border-b border-line last:border-b-0">
                  <td className="py-2.5 pr-3 pl-5">
                    <div className="flex items-center gap-2.5">
                      <span className={cx("size-3 shrink-0 rounded-[4px]", CLASS_SWATCH[r.color])} aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {r.member ? (
                            <Link href={classHref(r.classId)} className="hover:text-brand hover:underline underline-offset-2">
                              {name}
                            </Link>
                          ) : (
                            name
                          )}
                          {needsAttention(r, today) && <Chip tone="amber">Needs attention</Chip>}
                        </div>
                        <p className="truncate text-[11.5px] text-faint">{r.teachers || "No teacher yet"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{r.students}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{r.dueThisWeek}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span className={r.waiting ? "font-semibold text-ink" : "text-faint"}>{r.waiting}</span>
                    {days >= 1 && <span className={cx("block text-[11px]", days >= 3 ? "text-amber" : "text-faint")}>oldest {days}d</span>}
                  </td>
                  <td className={cx("px-3 py-2.5 text-right tabular-nums", r.missing ? "font-semibold text-amber" : "text-faint")}>{r.missing}</td>
                  <td className="py-2.5 pr-5 pl-3 text-right tabular-nums text-mint">{r.verifiedThisWeek}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11.5px] text-faint">Counts only. Student names stay with their teachers.</p>
    </Card>
  );
}
