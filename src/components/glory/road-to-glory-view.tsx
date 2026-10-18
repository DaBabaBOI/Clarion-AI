"use client";

import { useState } from "react";
import { toast, useNow } from "@/lib/client-hooks";
import { parseISODate, timeAgo, toISODate, WEEKDAYS } from "@/lib/dates";
import {
  badgesWithProgress,
  balance,
  classBoard,
  classById,
  dayIsPast,
  earnedPoints,
  isStaff,
  milestoneProgress,
  pendingPoints,
  pointsByDay,
  pointsThisWeek,
  schoolBoard,
  streak,
  weekDays,
  type BoardRow,
} from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import type { AppState, Badge, Milestone, Reward } from "@/lib/types";
import { CheckIcon, LockIcon, RewardGlyph } from "../icons";
import { StaffGloryView } from "./staff-glory";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  ClassChip,
  EmptyState,
  Modal,
  PageHeader,
  PixelBadge,
  ProgressBar,
  Segmented,
  Switch,
  cx,
} from "../ui";

// Road to Glory, redesigned. Compared with the Figma frame it adds:
//  • The road: a level path driven by lifetime verified points, so there is a
//    long-term goal beyond the weekly streak.
//  • Waiting for your teacher: the anti-gaming rule shown as a live queue of
//    handed-in work instead of a static info card.
//  • A privacy switch on the leaderboard; the school board is anonymised.
// Streak, badges, rewards and the leaderboard keep the Figma styling.

// ── The road ────────────────────────────────────────────────────────────────

function RoadCard({ milestones, points }: { milestones: Milestone[]; points: number }) {
  const progress = milestoneProgress(milestones, points);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = milestones.find((m) => m.id === selectedId) ?? progress.next ?? progress.current;
  const selectedIndex = milestones.indexOf(selected);
  const reached = points >= selected.points;
  const pct = progress.position * 100;

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title="The road">
        <Chip tone="brand">
          Level {progress.reachedIndex + 1} · {progress.current.title}
        </Chip>
        <span className="flex-1" />
        {progress.next ? (
          <span className="text-[12.5px] font-semibold text-muted">
            {progress.next.points - points} pts to {progress.next.title}
          </span>
        ) : (
          <span className="text-[12.5px] font-semibold text-mint">Top of the road</span>
        )}
      </CardHeader>

      <div className="-mx-5 overflow-x-auto px-5 pb-1">
        <div className="relative min-w-[620px] pt-9">
          {/* Track, inset by half a node so the end nodes sit on the ends. */}
          <div className="relative mx-5 h-10">
            <div className="absolute top-1/2 right-0 left-0 h-0 -translate-y-1/2 border-t-2 border-dashed border-line" />
            <div className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-brand-gradient" style={{ width: `${pct}%` }} />

            <div className="absolute -top-9 -translate-x-1/2" style={{ left: `${pct}%` }}>
              <div className="flex flex-col items-center">
                <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-white">You · {points}</span>
                <span className="size-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-ink" />
              </div>
            </div>

            {milestones.map((m, i) => {
              const done = points >= m.points;
              const isNext = progress.next?.id === m.id;
              const left = milestones.length > 1 ? (i / (milestones.length - 1)) * 100 : 0;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  aria-pressed={selected.id === m.id}
                  aria-label={`${m.title}, ${m.points} points, ${done ? "reached" : "locked"}`}
                  className={cx(
                    "absolute top-0 grid size-10 -translate-x-1/2 place-items-center rounded-[2px] text-[13px] font-bold transition",
                    done && "bg-brand text-white",
                    isNext && "border-[1.5px] border-dashed border-brand bg-white text-brand",
                    !done && !isNext && "border border-dashed border-faint bg-canvas text-faint",
                    selected.id === m.id && "ring-2 ring-brand/30 ring-offset-2",
                  )}
                  style={{ left: `${left}%` }}
                >
                  {done ? <CheckIcon width={14} height={14} /> : isNext ? i + 1 : <LockIcon />}
                </button>
              );
            })}
          </div>

          <div className="relative mx-5 mt-2 h-9">
            {milestones.map((m, i) => {
              const left = milestones.length > 1 ? (i / (milestones.length - 1)) * 100 : 0;
              // End labels hug the track ends; the rest centre under their node.
              const first = i === 0;
              const last = i === milestones.length - 1;
              const transform = first ? "translateX(-20px)" : last ? "translateX(calc(-100% + 20px))" : "translateX(-50%)";
              return (
                <div
                  key={m.id}
                  className={cx("absolute top-0 w-24", first ? "text-left" : last ? "text-right" : "text-center")}
                  style={{ left: `${left}%`, transform }}
                >
                  <p className={cx("text-[12.5px] font-semibold", points >= m.points ? "text-ink" : "text-muted")}>{m.title}</p>
                  <p className="text-[11px] text-faint">{m.points} pts</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[11px] bg-canvas px-3.5 py-2.5 text-[12.5px]">
        <span className="font-semibold text-ink">
          Level {selectedIndex + 1}: {selected.title}
        </span>
        <span className="text-muted">Unlocks {selected.unlock.toLowerCase()}</span>
        <span className="flex-1" />
        <span className={cx("font-semibold", reached ? "text-mint" : "text-brand")}>
          {reached ? "Reached" : `${selected.points - points} more verified points`}
        </span>
      </div>
    </Card>
  );
}

// ── This week ───────────────────────────────────────────────────────────────

function StreakCard({ state, today }: { state: AppState; today: Date }) {
  const todayISO = toISODate(today);
  const byDay = pointsByDay(state);
  const days = streak(state, today);

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title="This week">
        <Chip tone="amber" className="text-[12px]">
          {days} day streak
        </Chip>
        <span className="flex-1" />
        <span className="text-[12.5px] font-semibold text-mint">+{pointsThisWeek(state, today)} pts earned</span>
      </CardHeader>
      <ol className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
        {weekDays(today).map((d) => {
          const date = parseISODate(d);
          const pts = byDay.get(d) ?? 0;
          const isToday = d === todayISO;
          const weekend = date.getDay() === 0 || date.getDay() === 6;
          const past = dayIsPast(d, today);
          const label = WEEKDAYS[date.getDay()].slice(0, 3);
          let caption = "";
          if (pts > 0) caption = `+${pts}`;
          else if (isToday) caption = weekend ? "rest" : "today";
          else if (weekend) caption = "rest";
          else if (past) caption = "none";
          return (
            <li
              key={d}
              aria-label={`${WEEKDAYS[date.getDay()]}: ${pts > 0 ? `${pts} verified points` : caption || "coming up"}`}
              className={cx(
                "flex flex-col items-center gap-2 rounded-[14px] py-[13px]",
                pts > 0 && "bg-mint text-white",
                pts === 0 && isToday && "border-[1.5px] border-dashed border-brand bg-white text-brand",
                pts === 0 && !isToday && "bg-canvas text-faint",
              )}
            >
              <span className="text-[11.5px] font-semibold">{label}</span>
              <span
                className={cx(
                  "grid size-6 place-items-center rounded-full",
                  pts > 0 && "bg-white text-mint",
                  pts === 0 && isToday && "border-[1.5px] border-brand",
                  pts === 0 && !isToday && "bg-white",
                )}
              >
                {pts > 0 && <CheckIcon />}
              </span>
              <span className="h-3.5 text-[11px] font-bold leading-[14px]">{caption}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// ── Waiting for your teacher ────────────────────────────────────────────────

function WaitingCard({ state, now }: { state: AppState; now: Date }) {
  const waiting = state.tasks.filter((t) => t.status === "submitted" && t.classId);
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader title="Waiting for your teacher">
        {waiting.length > 0 && <Chip tone="pending">{waiting.length} handed in</Chip>}
      </CardHeader>
      {waiting.length === 0 ? (
        <EmptyState title="Nothing waiting" body="Tick off a class task and it waits here until your teacher checks it." />
      ) : (
        <ul>
          {waiting.map((t) => (
            <li key={t.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">{t.title}</p>
                <p className="mt-0.5 text-[11.5px] text-faint">Handed in {t.submittedAt ? timeAgo(t.submittedAt, now) : "recently"}</p>
              </div>
              <ClassChip cls={classById(state, t.classId)} />
              <Chip tone="pending">+{t.points} pts</Chip>
            </li>
          ))}
        </ul>
      )}
      <p className="rounded-[12px] bg-canvas px-3.5 py-3 text-[12.5px] leading-[19px] text-muted">
        <span className="font-semibold text-ink">Why points wait. </span>A task only pays out once your teacher marks it
        complete, so nobody can tick their way up the leaderboard.
      </p>
    </Card>
  );
}

// ── Badges ──────────────────────────────────────────────────────────────────

const BADGE_TILE: Record<Badge["color"], { tile: string; text: string }> = {
  gold: { tile: "border-gold bg-gold-soft", text: "text-amber" },
  mint: { tile: "border-mint bg-mint-soft", text: "text-mint" },
  sky: { tile: "border-sky bg-sky-soft", text: "text-sky" },
  brand: { tile: "border-brand bg-brand-soft", text: "text-brand" },
};

function badgeCaption(b: Badge) {
  if (b.unlocked || !b.progress) return "Unlocked";
  const left = b.progress.target - b.progress.current;
  return b.progress.unit === "days" ? `${left} day${left === 1 ? "" : "s"} to go` : `${b.progress.current} of ${b.progress.target} ${b.progress.unit}`;
}

function BadgesCard({ badges }: { badges: Badge[] }) {
  const unlocked = badges.filter((b) => b.unlocked).length;
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title="Badges">
        <span className="flex-1" />
        <span className="text-[12.5px] text-faint">
          {unlocked} of {badges.length} unlocked
        </span>
      </CardHeader>
      <ul className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {badges.map((b) => (
          <li
            key={b.id}
            title={b.description}
            className={cx(
              "flex flex-col items-center gap-2 rounded-[2px] px-2 py-4 text-center",
              b.unlocked ? cx("border", BADGE_TILE[b.color].tile) : "border border-dashed border-faint bg-canvas",
            )}
          >
            <PixelBadge pattern={b.pattern} color={b.unlocked ? b.color : "locked"} />
            <span className={cx("text-[12.5px] font-semibold", b.unlocked ? "text-ink" : "text-muted")}>{b.title}</span>
            <span className={cx("text-[11px] font-semibold", b.unlocked ? BADGE_TILE[b.color].text : "text-faint")}>
              {badgeCaption(b)}
            </span>
            <span className="sr-only">{b.description}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Leaderboard ─────────────────────────────────────────────────────────────

const RANK_STYLE: Record<number, string> = {
  1: "border-gold bg-gold-soft text-amber",
  2: "border-silver bg-silver-soft text-silver",
  3: "border-bronze bg-bronze-soft text-bronze",
};

export function BoardRowView({ row, hidden, school }: { row: BoardRow; hidden: boolean; school: boolean }) {
  const name = row.me ? (hidden ? "You (hidden)" : `${row.name} (you)`) : school ? `Student · ${row.group}` : row.name;
  return (
    <li className={cx("flex items-center gap-3 px-2 py-2.5", row.me && "rounded-[12px] bg-brand-soft")}>
      <span
        className={cx(
          "grid size-[27px] shrink-0 place-items-center rounded-full text-[11.5px] font-bold",
          RANK_STYLE[row.rank] ? cx("border-[1.5px]", RANK_STYLE[row.rank]) : "text-faint",
        )}
      >
        {row.rank}
      </span>
      {school && !row.me ? (
        <span className="size-[26px] shrink-0 rounded-full bg-canvas" aria-hidden="true" />
      ) : (
        <Avatar name={row.me && hidden ? "?" : row.name} size={26} me={row.me} />
      )}
      <span className={cx("min-w-0 flex-1 truncate text-[13.5px] font-semibold", row.me ? "text-brand" : "text-ink")}>{name}</span>
      <span className={cx("text-[13.5px] font-semibold", row.me ? "text-brand" : "text-muted")}>{row.points}</span>
    </li>
  );
}

function LeaderboardCard({ state }: { state: AppState }) {
  const [scope, setScope] = useState<"class" | "school">("class");
  const rows = scope === "class" ? classBoard(state) : schoolBoard(state);
  const me = rows.find((r) => r.me);
  const top = rows.slice(0, 4);
  const hidden = !state.showOnLeaderboard;

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader title="Leaderboard">
        <span className="flex-1" />
        <Segmented
          label="Leaderboard scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: "class", label: "Class" },
            { value: "school", label: "School" },
          ]}
        />
      </CardHeader>
      <ol className="flex flex-col">
        {top.map((r) => (
          <BoardRowView key={r.id} row={r} hidden={hidden} school={scope === "school"} />
        ))}
        {me && me.rank > top.length && (
          <>
            <li aria-hidden="true" className="px-2 text-[12px] leading-3 text-faint">
              ⋯
            </li>
            <BoardRowView row={me} hidden={hidden} school={scope === "school"} />
          </>
        )}
      </ol>
      <p className="text-[11.5px] text-faint">
        {scope === "school" ? "Other schools' students are anonymised. " : ""}Ranks use points earned, so spending points never drops you.
      </p>
      {rows.length === 0 && <p className="px-2 text-[12.5px] text-muted">No points yet. They appear once work is verified.</p>}
      <div className={cx("flex items-center gap-3 border-t border-line pt-3", state.role !== "student" && "hidden")}>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">Show my name</p>
          <p className="text-[11.5px] text-muted">{hidden ? "Classmates see “Hidden student”." : "Classmates can see your name and points."}</p>
        </div>
        <Switch checked={!hidden} onChange={(v) => actions.setLeaderboardVisibility(v)} label="Show my name on the leaderboard" />
      </div>
    </Card>
  );
}

// ── Spend your points ───────────────────────────────────────────────────────

const REWARD_TONE: Record<Reward["icon"], string> = {
  game: "border-sky bg-sky-soft text-sky",
  pass: "border-brand bg-brand-soft text-brand",
  theme: "border-faint bg-canvas text-faint",
};

function SpendCard({ state }: { state: AppState }) {
  const available = balance(state);
  const [confirming, setConfirming] = useState<Reward | null>(null);

  return (
    <Card className="flex flex-col gap-1">
      <CardHeader title="Spend your points">
        <span className="flex-1" />
        <Chip tone="neutral">In app only</Chip>
      </CardHeader>
      <p className="text-[12px] text-muted">{available} pts to spend</p>
      <ul className="mt-2">
        {state.rewards.map((r) => {
          const redemption = state.redemptions.find((x) => x.rewardId === r.id);
          const affordable = available >= r.cost;
          return (
            <li key={r.id} className="flex items-center gap-3.5 border-t border-line py-3.5 first:border-t-0">
              <span className={cx("grid size-9 shrink-0 place-items-center rounded-[2px] border-[1.2px]", REWARD_TONE[r.icon])}>
                <RewardGlyph kind={r.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cx("text-[14px] font-semibold", !affordable && !redemption && "text-muted")}>{r.title}</p>
                {!redemption && !affordable ? (
                  <div className="mt-1.5 flex items-center gap-2.5">
                    <div className="w-full max-w-[150px]">
                      <ProgressBar value={available} max={r.cost} label={`${r.title} progress`} />
                    </div>
                    <span className="text-[12px] whitespace-nowrap text-muted">
                      {available} of {r.cost} pts
                    </span>
                  </div>
                ) : (
                  <p className="mt-0.5 text-[12.5px] text-muted">{r.cost} pts</p>
                )}
              </div>
              {redemption ? (
                <Chip tone={redemption.status === "unlocked" ? "mint" : "pending"}>
                  {redemption.status === "unlocked" ? "Unlocked" : "Waiting for teacher"}
                </Chip>
              ) : affordable ? (
                <Button size="sm" onClick={() => setConfirming(r)}>
                  Redeem
                </Button>
              ) : (
                <span className="rounded-control bg-canvas px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap text-faint">
                  {r.cost - available} pts to go
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming ? `Spend ${confirming.cost} pts?` : ""}
        description={
          confirming?.needsTeacher
            ? `“${confirming.title}” goes to your teacher to approve. Your rank stays the same.`
            : "This unlocks straight away. Your rank stays the same."
        }
      >
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Not now
          </Button>
          <Button
            onClick={() => {
              if (confirming && actions.redeem(confirming.id)) {
                toast(confirming.needsTeacher ? "Request sent to your teacher" : `${confirming.title} unlocked`, "success");
              }
              setConfirming(null);
            }}
          >
            Redeem
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function RoadToGloryView() {
  const state = useAppState()!;
  return isStaff(state) ? <StaffGloryView /> : <StudentGloryView />;
}

function StudentGloryView() {
  const state = useAppState()!;
  const now = useNow();
  const earned = earnedPoints(state);
  const pending = pendingPoints(state);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Road to Glory"
        subtitle="Points only count once your teacher verifies the task."
        actions={
          <>
            {pending > 0 && <Chip tone="pending">+{pending} waiting</Chip>}
            <Chip tone="mint" className="px-2.5 py-[5px] text-[12.5px]">
              {earned} pts verified
            </Chip>
          </>
        }
      />

      <RoadCard milestones={state.milestones} points={earned} />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <StreakCard state={state} today={now} />
          <BadgesCard badges={badgesWithProgress(state, now)} />
          <WaitingCard state={state} now={now} />
        </div>
        <div className="flex w-full flex-col gap-5 lg:w-[380px] lg:shrink-0">
          <LeaderboardCard state={state} />
          <SpendCard state={state} />
        </div>
      </div>
    </div>
  );
}
