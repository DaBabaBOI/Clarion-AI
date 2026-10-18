"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast, useNow } from "@/lib/client-hooks";
import { diffDays, dueLabel, longDate, parseISODate, shortDate, timeAgo, toISODate } from "@/lib/dates";
import { classHref } from "@/lib/routes";
import { classById, pendingReviews, roster, taskProgress, taskResources, teaches, workFiles } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import type { AppState, Member, Submission, Task } from "@/lib/types";
import { LogoMark } from "../icons";
import { AddAttachment, AttachmentChips, AttachmentList } from "./attachments";
import { ReviewRow } from "./review-list";
import { toggleWithFeedback } from "./task-row";
import { Avatar, Button, Card, CardHeader, Chip, ClassChipLink, EmptyState, ProgressBar, TextButton, cx } from "../ui";

/** The task page for `?id=`. Keyed so moving between tasks starts each one fresh. */
export function TaskFromUrl() {
  const taskId = useSearchParams().get("id") ?? "";
  return <TaskView key={taskId} taskId={taskId} />;
}

function TaskView({ taskId }: { taskId: string }) {
  const state = useAppState()!;
  const now = useNow();
  const task = state.tasks.find((t) => t.id === taskId);

  if (!task) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/dashboard" className="text-[12.5px] font-semibold text-brand">
          ← Dashboard
        </Link>
        <EmptyState title="Task not found" body="It may have been deleted by your teacher, or the link is wrong." />
      </div>
    );
  }

  const cls = classById(state, task.classId);
  const teaching = teaches(state, task.classId);
  const today = toISODate(now);
  const due = dueLabel(task.due, today);
  const dueText = due.label === "Overdue" ? "Overdue" : `Due ${/^(Today|Tomorrow)$/.test(due.label) ? due.label.toLowerCase() : due.label}`;
  // Who can change the instructions and resources: the class teacher, or the owner of a reminder.
  const canEdit = teaching || !task.classId;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-[7px] text-[12.5px]">
        <Link href="/dashboard" className="font-semibold text-brand hover:underline underline-offset-2">
          Dashboard
        </Link>
        {cls && (
          <>
            <span className="text-faint">/</span>
            <Link href={classHref(cls.id)} className="font-semibold text-brand hover:underline underline-offset-2">
              {cls.name}
            </Link>
          </>
        )}
        <span className="text-faint">/</span>
        <span className="truncate text-faint" aria-current="page">
          {task.title}
        </span>
      </nav>

      <header className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <ClassChipLink cls={cls} />
          {task.status === "verified" && !teaching ? (
            <Chip tone="mint">Done</Chip>
          ) : (
            <Chip tone={due.tone}>{dueText}</Chip>
          )}
          {task.classId && <Chip tone="brand">{task.points} points</Chip>}
        </div>
        <h1 className="text-[25px] font-bold leading-tight text-ink">{task.title}</h1>
        <p className="text-[13px] text-muted">
          {task.classId ? `Set by ${cls?.teacher ?? "your teacher"} on ${shortDate(task.setOn)}` : "Your own reminder"} · due{" "}
          {longDate(parseISODate(task.due))}
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Instructions task={task} canEdit={canEdit} />
          <Resources state={state} task={task} canEdit={canEdit} />
          {teaching && <ClassWork state={state} task={task} now={now} />}
        </div>

        <aside className="flex w-full flex-col gap-5 lg:w-[372px] lg:shrink-0">
          {teaching ? (
            <ProgressCard state={state} task={task} today={today} />
          ) : task.classId ? (
            <YourWork state={state} task={task} now={now} />
          ) : (
            <ReminderCard task={task} />
          )}
          {!teaching && <HelpCard task={task} />}
        </aside>
      </div>
    </div>
  );
}

function Instructions({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(task.details ?? "");
  const label = task.classId ? "Instructions" : "Notes";

  return (
    <Card>
      <CardHeader title={label}>
        <span className="flex-1" />
        {canEdit && !editing && (
          <TextButton
            onClick={() => {
              setText(task.details ?? "");
              setEditing(true);
            }}
          >
            {task.details ? "Edit" : `Add ${label.toLowerCase()}`}
          </TextButton>
        )}
      </CardHeader>
      {editing ? (
        <form
          className="mt-3 flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            actions.setTaskDetails(task.id, text);
            setEditing(false);
            toast(`${label} saved`, "success");
          }}
        >
          <label htmlFor="task-details" className="sr-only">
            {label}
          </label>
          <textarea
            id="task-details"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={4000}
            autoFocus
            className="w-full rounded-control border border-line bg-white px-3.5 py-3 text-[14px] leading-[21px] text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            placeholder={task.classId ? "What should students do, and what should they hand in?" : "Anything to remember"}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      ) : task.details ? (
        <p className="mt-3 whitespace-pre-line text-[14px] leading-[22px] text-ink">{task.details}</p>
      ) : (
        <p className="mt-3 text-[13px] leading-5 text-muted">
          {task.classId
            ? canEdit
              ? "No instructions yet. Add them so students know exactly what to hand in."
              : "Your teacher has not added instructions. Ask in the class discussion if anything is unclear."
            : "No notes on this reminder."}
        </p>
      )}
    </Card>
  );
}

function Resources({ state, task, canEdit }: { state: AppState; task: Task; canEdit: boolean }) {
  const items = taskResources(state, task.id);
  return (
    <Card>
      <CardHeader title="Attachments">
        {items.length > 0 && <Chip tone="neutral">{items.length}</Chip>}
      </CardHeader>
      <div className="mt-3 flex flex-col gap-3">
        {items.length > 0 ? (
          <AttachmentList items={items} onRemove={canEdit ? (a) => void actions.removeAttachment(a.id) : undefined} />
        ) : (
          <p className="text-[13px] text-muted">
            {canEdit ? "Share worksheets, slides or links with the class." : "Nothing attached to this task."}
          </p>
        )}
        {canEdit && <AddAttachment taskId={task.id} asWork={false} />}
      </div>
    </Card>
  );
}

// ── Students ────────────────────────────────────────────────────────────────

function Step({ done, tone = "brand", title, detail }: { done: boolean; tone?: "brand" | "mint" | "amber"; title: string; detail: string }) {
  const fill = { brand: "bg-brand border-brand", mint: "bg-mint border-mint", amber: "bg-amber border-amber" }[tone];
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      <span className={cx("relative z-10 mt-0.5 size-3.5 shrink-0 rounded-full border-2", done ? fill : "border-line bg-white")} aria-hidden="true" />
      <div className="min-w-0">
        <p className={cx("text-[13px] font-semibold", done ? "text-ink" : "text-muted")}>{title}</p>
        <p className="text-[12px] text-faint">{detail}</p>
      </div>
    </li>
  );
}

function YourWork({ state, task, now }: { state: AppState; task: Task; now: Date }) {
  const files = workFiles(state, task.id, state.student.id);
  const open = task.status === "open";
  const today = toISODate(now);
  const late = open && diffDays(task.due, today) < 0;

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title="Your work" small />

      <ol className="relative before:absolute before:top-2 before:bottom-2 before:left-[6px] before:w-0.5 before:bg-line">
        <Step done title="Set" detail={`${shortDate(task.setOn)} by ${classById(state, task.classId)?.teacher ?? "your teacher"}`} />
        <Step
          done={!open}
          title={open ? "Not handed in yet" : "Handed in"}
          detail={open ? (late ? "This is overdue. Hand it in as soon as you can." : `Due ${shortDate(task.due)}`) : task.submittedAt ? timeAgo(task.submittedAt, now) : ""}
        />
        <Step
          done={task.status === "verified" || !!task.returned}
          tone={task.returned ? "amber" : "mint"}
          title={task.status === "verified" ? `Verified · +${task.points} points` : task.returned ? "Returned by your teacher" : "Checked by your teacher"}
          detail={
            task.status === "verified"
              ? "Points are on your Road to Glory."
              : task.returned
                ? "Fix it, then hand it in again."
                : "Points arrive once your teacher verifies it."
          }
        />
      </ol>

      <div className="flex flex-col gap-2.5">
        <p className="text-[12.5px] font-semibold text-muted">Attached work</p>
        {files.length > 0 ? (
          <AttachmentList items={files} onRemove={open ? (a) => void actions.removeAttachment(a.id) : undefined} />
        ) : (
          <p className="text-[12.5px] text-faint">{open ? "Attach your file or a link before you hand in." : "No files were attached."}</p>
        )}
        {open && <AddAttachment taskId={task.id} asWork />}
        {task.status === "submitted" && <p className="text-[11.5px] text-faint">Take it back to change your files.</p>}
      </div>

      {task.status === "verified" ? (
        <p className="rounded-[10px] bg-mint-soft px-3 py-2.5 text-[12.5px] font-semibold text-mint">Verified. Nothing more to do.</p>
      ) : open ? (
        <Button full onClick={() => toggleWithFeedback(task)}>
          {task.returned ? "Hand in again" : files.length ? `Hand in with ${files.length} attachment${files.length === 1 ? "" : "s"}` : "Hand in"}
        </Button>
      ) : (
        <Button variant="secondary" full onClick={() => toggleWithFeedback(task)}>
          Take it back
        </Button>
      )}
    </Card>
  );
}

function ReminderCard({ task }: { task: Task }) {
  const done = task.status !== "open";
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader title="Reminder" small>
        {done && <Chip tone="mint">Done</Chip>}
      </CardHeader>
      <p className="text-[12.5px] leading-[19px] text-muted">Reminders are just for you. They never earn points, so there is nothing to hand in.</p>
      <Button variant={done ? "secondary" : "primary"} full onClick={() => toggleWithFeedback(task)}>
        {done ? "Mark as not done" : "Mark as done"}
      </Button>
    </Card>
  );
}

function HelpCard({ task }: { task: Task }) {
  const router = useRouter();
  return (
    <section className="flex flex-col gap-3 rounded-card bg-brand-soft px-5 py-[18px]">
      <div className="flex items-center gap-2">
        <LogoMark size={20} />
        <h2 className="text-[13px] font-bold text-brand">Stuck?</h2>
      </div>
      <p className="text-[13px] leading-5 text-ink">Clarion knows this task and your class notes. Ask it where to start.</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            actions.setAiContext(task.classId);
            void actions.ask(`Help me get started on "${task.title}"`);
            router.push("/ai");
          }}
        >
          Ask Clarion
        </Button>
        {task.classId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              actions.setDiscussionClass(task.classId);
              router.push("/discussions");
            }}
          >
            Ask the class
          </Button>
        )}
      </div>
    </section>
  );
}

// ── Teachers ────────────────────────────────────────────────────────────────

function ProgressCard({ state, task, today }: { state: AppState; task: Task; today: string }) {
  const router = useRouter();
  const p = taskProgress(state, task);
  const missing = Math.max(0, p.total - p.handedIn);
  const past = diffDays(task.due, today) < 0;
  return (
    <Card className="flex flex-col gap-3.5">
      <CardHeader title="Class progress" small />
      <div>
        <p className="text-[27px] font-bold leading-none text-ink">
          {p.handedIn}
          <span className="text-[15px] font-semibold text-faint">/{p.total}</span>
        </p>
        <p className="mt-1 text-[12.5px] text-muted">handed in</p>
      </div>
      <ProgressBar value={p.handedIn} max={Math.max(1, p.total)} tone="brand" label="Handed in" />
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "to check", value: p.waiting, tone: p.waiting ? "text-amber" : "text-faint" },
          { label: "verified", value: p.verified, tone: p.verified ? "text-mint" : "text-faint" },
          { label: past ? "missing" : "not yet", value: missing, tone: missing && past ? "text-amber" : "text-faint" },
        ].map((s) => (
          <div key={s.label} className="rounded-[10px] bg-canvas px-2 py-2.5">
            <dd className={cx("text-[18px] font-bold leading-none", s.tone)}>{s.value}</dd>
            <dt className="mt-1 text-[11px] text-faint">{s.label}</dt>
          </div>
        ))}
      </dl>
      <Button
        variant="secondary"
        size="sm"
        full
        onClick={() => {
          actions.setDiscussionClass(task.classId);
          router.push("/discussions");
        }}
      >
        Post a reminder to the class
      </Button>
    </Card>
  );
}

type Row = { member: Member; submission: Submission | undefined };

const ORDER = { submitted: 0, returned: 2, missing: 1, verified: 3 } as const;

/** Every student in the class and where they are with this task. */
function ClassWork({ state, task, now }: { state: AppState; task: Task; now: Date }) {
  const reviews = pendingReviews(state).filter((r) => r.task.id === task.id);
  const rows: Row[] = roster(state, task.classId!)
    .map((member) => ({ member, submission: state.submissions.find((s) => s.taskId === task.id && s.studentId === member.userId) }))
    .filter((r) => r.submission?.status !== "submitted")
    .sort((a, b) => ORDER[a.submission?.status ?? "missing"] - ORDER[b.submission?.status ?? "missing"] || a.member.name.localeCompare(b.member.name));

  return (
    <>
      <Card>
        <CardHeader title="To check">
          <Chip tone={reviews.length ? "pending" : "neutral"}>{reviews.length}</Chip>
        </CardHeader>
        <div className="mt-3 h-px bg-line" />
        {reviews.length === 0 ? (
          <p className="pt-3 text-[12.5px] text-muted">Nothing waiting. Work shows up here as students hand it in.</p>
        ) : (
          <ul>
            {reviews.map((r) => (
              <ReviewRow key={r.submission.id} review={r} now={now} showTask={false} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Everyone else">
          <span className="text-[12.5px] text-muted">{rows.length} students</span>
        </CardHeader>
        <div className="mt-3 h-px bg-line" />
        <ul>
          {rows.map(({ member, submission }) => {
            const files = workFiles(state, task.id, member.userId);
            const status = submission?.status;
            return (
              <li key={member.userId} className="flex flex-wrap items-start gap-3 border-t border-line py-3 first:border-t-0">
                <Avatar name={member.name} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink">{member.name}</p>
                  {submission && <p className="text-[11.5px] text-faint">Handed in {timeAgo(submission.submittedAt, now)}</p>}
                  {files.length > 0 && <AttachmentChips items={files} />}
                </div>
                {status === "verified" ? (
                  <Chip tone="mint">Verified</Chip>
                ) : status === "returned" ? (
                  <Chip tone="amber">Returned</Chip>
                ) : (
                  <Chip tone="neutral">Not handed in</Chip>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
