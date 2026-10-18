"use client";

import { useState } from "react";
import { useNow } from "@/lib/client-hooks";
import { classById, pendingReviews, staffStats } from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import type { AppState, Reward } from "@/lib/types";
import { RewardGlyph } from "../icons";
import { Card, CardHeader, Chip, EmptyState, PageHeader, Segmented, TextButton, cx } from "../ui";
import { RewardRequestsCard } from "./reward-requests";
import { BoardRowView } from "./road-to-glory-view";

// Road to Glory for teachers and coordinators. Staff are not ranked, so the
// page shows how their classes are doing on the road, the rewards waiting
// for approval, and what students are working towards.

function ClassBoardsCard({ state }: { state: AppState }) {
  const ids = state.teachingClassIds.filter((id) => state.classBoards[id]);
  const [classId, setClassId] = useState(ids[0] ?? "");
  const [showAll, setShowAll] = useState(false);
  const rows = (state.classBoards[classId] ?? []).map((r, i) => ({ ...r, rank: i + 1, me: false }));

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader title="Class leaderboards">
        <span className="flex-1" />
        {ids.length > 1 && (
          <Segmented
            label="Class"
            value={classId}
            onChange={(v) => {
              setClassId(v);
              setShowAll(false);
            }}
            options={ids.map((id) => ({ value: id, label: classById(state, id)?.name ?? "Class" }))}
          />
        )}
      </CardHeader>
      {rows.length === 0 ? (
        <EmptyState title="No points yet" body="Points appear here as you verify work." />
      ) : (
        <ol className="flex flex-col">
          {(showAll ? rows : rows.slice(0, 6)).map((r) => (
            <BoardRowView key={r.id} row={r} hidden={false} school={false} />
          ))}
        </ol>
      )}
      <div className="flex items-center gap-3">
        <p className="flex-1 text-[11.5px] text-faint">Points from verified work in this class. Students who hide their name show as “Hidden student”.</p>
        {rows.length > 6 && <TextButton onClick={() => setShowAll((v) => !v)}>{showAll ? "Show less" : `All ${rows.length}`}</TextButton>}
      </div>
    </Card>
  );
}

/** The levels students see on their road, and how many of yours have reached each one. */
function RoadLevelsCard({ state }: { state: AppState }) {
  const points = state.teachingClassIds.flatMap((id) => (state.classBoards[id] ?? []).map((r) => r.points));
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader title="The road students see" small />
      <ol className="flex flex-col">
        {state.milestones.map((m, i) => {
          const next = state.milestones[i + 1];
          const here = points.filter((p) => p >= m.points && (!next || p < next.points)).length;
          return (
            <li key={m.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-[11.5px] font-bold text-brand">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink">
                  {m.title} <span className="font-normal text-faint">· {m.points} pts</span>
                </p>
                <p className="text-[11.5px] text-faint">Unlocks: {m.unlock}</p>
              </div>
              <Chip tone={here ? "brand" : "neutral"}>
                {here} student{here === 1 ? "" : "s"}
              </Chip>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

const REWARD_TONE: Record<Reward["icon"], string> = {
  game: "border-sky bg-sky-soft text-sky",
  pass: "border-brand bg-brand-soft text-brand",
  theme: "border-faint bg-canvas text-faint",
};

function RewardsOnOfferCard({ rewards }: { rewards: Reward[] }) {
  return (
    <Card className="flex flex-col gap-1">
      <CardHeader title="Rewards on offer" small />
      <ul className="mt-2">
        {rewards.map((r) => (
          <li key={r.id} className="flex items-center gap-3.5 border-t border-line py-3 first:border-t-0">
            <span className={cx("grid size-9 shrink-0 place-items-center rounded-[2px] border-[1.2px]", REWARD_TONE[r.icon])}>
              <RewardGlyph kind={r.icon} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-ink">{r.title}</p>
              <p className="text-[12px] text-muted">{r.cost} pts</p>
            </div>
            <Chip tone={r.needsTeacher ? "pending" : "neutral"}>{r.needsTeacher ? "Needs approval" : "Automatic"}</Chip>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function StaffGloryView() {
  const state = useAppState()!;
  const now = useNow();
  const stats = staffStats(state, now);
  const waitingPoints = pendingReviews(state).reduce((n, r) => n + r.task.points, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Road to Glory"
        subtitle="How your classes are doing. Students only get points when you verify their work."
        actions={
          <>
            {waitingPoints > 0 && <Chip tone="pending">{waitingPoints} pts waiting on you</Chip>}
            <Chip tone="mint" className="px-2.5 py-[5px] text-[12.5px]">
              {stats.verifiedThisWeek} verified this week
            </Chip>
          </>
        }
      />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <ClassBoardsCard state={state} />
          <RoadLevelsCard state={state} />
        </div>
        <div className="flex w-full flex-col gap-5 lg:w-[380px] lg:shrink-0">
          <RewardRequestsCard requests={state.rewardRequests} now={now} />
          <RewardsOnOfferCard rewards={state.rewards} />
        </div>
      </div>
    </div>
  );
}
