"use client";

import { timeAgo } from "@/lib/dates";
import { actions } from "@/lib/store";
import type { RewardRequest } from "@/lib/types";
import { Avatar, Button, Card, CardHeader, Chip } from "../ui";

/** Staff approve or decline rewards that affect the class. Declining refunds the points. */
export function RewardRequestsCard({ requests, now }: { requests: RewardRequest[]; now: Date }) {
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader title="Reward requests" small>
        <Chip tone={requests.length ? "pending" : "neutral"}>{requests.length}</Chip>
      </CardHeader>
      {requests.length === 0 ? (
        <p className="text-[12.5px] text-muted">No requests waiting. Students ask here when a reward affects the class.</p>
      ) : (
        <ul className="flex flex-col">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line py-3 first:border-t-0 first:pt-0">
              <Avatar name={r.studentName} size={28} />
              <div className="min-w-0 flex-1 basis-[150px]">
                <p className="text-[13px] font-semibold text-ink">{r.rewardTitle}</p>
                <p className="text-[11.5px] text-faint">
                  {r.studentName} · {r.cost} pts · {timeAgo(r.at, now)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => actions.decideReward(r.id, false)}>
                  Decline
                </Button>
                <Button size="sm" onClick={() => actions.decideReward(r.id, true)}>
                  Approve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
