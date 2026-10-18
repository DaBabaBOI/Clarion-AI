"use client";

import Link from "next/link";
import { toast } from "@/lib/client-hooks";
import { dueLabel, shortDate } from "@/lib/dates";
import { taskHref } from "@/lib/routes";
import { taskProgress, taskResources } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import type { SchoolClass, Task } from "@/lib/types";
import { ChevronRightIcon, PaperclipIcon } from "../icons";
import { Chip, ClassChipLink, StatusChip, TaskCheckbox, cx } from "../ui";

export function toggleWithFeedback(task: Task) {
  actions.toggleTask(task.id);
  if (task.status === "open") {
    toast(task.classId ? "Handed in. Points arrive when your teacher verifies it." : "Marked as done", "success");
  } else if (task.status === "submitted" || !task.classId) {
    toast("Moved back to your open tasks");
  }
}

/**
 * A task in a list. The title opens the task page (its link covers the whole
 * row), while the checkbox and the class chip sit above it and keep their own
 * actions: hand in, and open the class.
 */
export function TaskRow({
  task,
  cls,
  today,
  showClass = true,
  showSetOn = false,
  teaching = false,
}: {
  task: Task;
  cls: SchoolClass | null;
  today: string;
  showClass?: boolean;
  showSetOn?: boolean;
  /** The viewer teaches this class: show how the class is getting on instead of a checkbox. */
  teaching?: boolean;
}) {
  const state = useAppState()!;
  const muted = task.status === "verified" && !teaching;
  const files = taskResources(state, task.id).length;
  const progress = teaching ? taskProgress(state, task) : null;
  const due = dueLabel(task.due, today);

  return (
    <li
      className={cx(
        "group relative flex items-center gap-[13px] border-t border-line first:border-t-0",
        showSetOn ? "py-[13px]" : "py-3.5",
      )}
    >
      {teaching ? (
        <span className="size-5 shrink-0 rounded-[6px] border-[1.5px] border-dashed border-line" title="You set this work" aria-hidden="true" />
      ) : (
        <span className="relative z-10 flex">
          <TaskCheckbox status={task.status} label={task.title} personal={!task.classId} onToggle={() => toggleWithFeedback(task)} />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-[13px] gap-y-1.5">
        <div className="min-w-0">
          <Link
            href={taskHref(task.id)}
            className={cx(
              "text-[14px] font-semibold transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-brand",
              muted ? "text-faint" : "text-ink",
            )}
          >
            {task.title}
          </Link>
          {showSetOn && <p className="mt-[3px] text-[11.5px] text-faint">Set {shortDate(task.setOn)}</p>}
        </div>
        {showClass && <ClassChipLink cls={cls} />}
        {files > 0 && (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-faint" title={`${files} attachment${files === 1 ? "" : "s"}`}>
            <PaperclipIcon width={12} height={12} />
            {files}
            <span className="sr-only"> attachment{files === 1 ? "" : "s"}</span>
          </span>
        )}
      </div>
      {progress ? (
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {progress.waiting > 0 && <Chip tone="pending">{progress.waiting} to check</Chip>}
          <Chip tone="neutral">
            {progress.handedIn}/{progress.total} in
          </Chip>
          <Chip tone={due.tone}>{due.label}</Chip>
        </div>
      ) : (
        <StatusChip status={task.status} due={due} returned={task.returned} />
      )}
      <ChevronRightIcon className="hidden shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-brand sm:block" />
    </li>
  );
}
