"use client";

import Link from "next/link";
import { timeAgo } from "@/lib/dates";
import { taskHref } from "@/lib/routes";
import { classById, workFiles, type Review } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import { AttachmentChips } from "./attachments";
import { Avatar, Button, ClassChipLink } from "../ui";

/**
 * Handed-in work waiting for the teacher: who, what, the files they attached,
 * and Verify (pays the points) or Return (sends it back to fix).
 */
export function ReviewRow({ review, now, showTask = true }: { review: Review; now: Date; showTask?: boolean }) {
  const state = useAppState()!;
  const { submission: s, task } = review;
  const files = workFiles(state, task.id, s.studentId);

  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2.5 border-t border-line py-3 first:border-t-0">
      <Avatar name={s.studentName} />
      <div className="min-w-0 flex-1 basis-[200px]">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {showTask ? (
            <Link href={taskHref(task.id)} className="text-[14px] font-semibold text-ink hover:text-brand">
              {task.title}
            </Link>
          ) : (
            <span className="text-[14px] font-semibold text-ink">{s.studentName}</span>
          )}
          {showTask && <ClassChipLink cls={classById(state, task.classId)} />}
        </div>
        <p className="mt-0.5 text-[11.5px] text-faint">
          {showTask && `${s.studentName} · `}handed in {timeAgo(s.submittedAt, now)} · {task.points} pts
        </p>
        {files.length > 0 ? (
          <AttachmentChips items={files} />
        ) : (
          <p className="mt-1 text-[11.5px] text-faint">No files attached</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" size="sm" onClick={() => actions.reviewSubmission(s.id, "returned")}>
          Return
        </Button>
        <Button size="sm" onClick={() => actions.reviewSubmission(s.id, "verified")}>
          Verify
        </Button>
      </div>
    </li>
  );
}
