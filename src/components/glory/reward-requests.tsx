"use client";

import { timeAgo } from "@/lib/dates";
import { actions } from "@/lib/store";
import type { RewardRequest } from "@/lib/types";
import { CheckIcon, CloseIcon } from "../icons";
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
            <li key={r.id} className="flex items-center gap-2.5 border-t border-line py-2.5 first:border-t-0 first:pt-0 last:pb-0">
              <Avatar name={r.studentName} size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-[18px] font-semibold text-ink">{r.rewardTitle}</p>
                <p className="truncate text-[11.5px] text-faint">
                  {r.studentName} · {r.cost} pts · {timeAgo(r.at, now)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={`Decline ${r.rewardTitle} for ${r.studentName}`}
                  title="Decline and refund the points"
                  onClick={() => actions.decideReward(r.id, false)}
                >
                  <CloseIcon width={12} height={12} />
                </Button>
                <Button
                  size="icon"
                  aria-label={`Approve ${r.rewardTitle} for ${r.studentName}`}
                  title="Approve"
                  onClick={() => actions.decideReward(r.id, true)}
                >
                  <CheckIcon width={14} height={14} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
