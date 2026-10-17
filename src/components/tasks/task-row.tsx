"use client";

import { toast } from "@/lib/client-hooks";
import { dueLabel, shortDate } from "@/lib/dates";
import { actions } from "@/lib/store";
import type { SchoolClass, Task } from "@/lib/types";
import { ClassChip, StatusChip, TaskCheckbox, cx } from "../ui";

export function toggleWithFeedback(task: Task) {
  actions.toggleTask(task.id);
  if (task.status === "open") {
    toast(task.classId ? "Handed in. Points arrive when your teacher verifies it." : "Marked as done", "success");
  } else if (task.status === "submitted") {
    toast("Moved back to your open tasks");
  }
}

export function TaskRow({
  task,
  cls,
  today,
  showClass = true,
  showSetOn = false,
}: {
  task: Task;
  cls: SchoolClass | null;
  today: string;
  showClass?: boolean;
  showSetOn?: boolean;
}) {
  const muted = task.status === "verified";
  return (
    <li className={cx("flex items-center gap-[13px] border-t border-line first:border-t-0", showSetOn ? "py-[13px]" : "py-3.5")}>
      <TaskCheckbox status={task.status} label={task.title} onToggle={() => toggleWithFeedback(task)} />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-[13px] gap-y-1.5">
        <div className="min-w-0">
          <p className={cx("text-[14px] font-semibold", muted ? "text-faint" : "text-ink")}>{task.title}</p>
          {showSetOn && <p className="mt-[3px] text-[11.5px] text-faint">Set {shortDate(task.setOn)}</p>}
        </div>
        {showClass && <ClassChip cls={cls} />}
      </div>
      <StatusChip status={task.status} due={dueLabel(task.due, today)} />
    </li>
  );
}
