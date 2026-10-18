"use client";

import { useState } from "react";
import { toast } from "@/lib/client-hooks";
import { addDays, toISODate } from "@/lib/dates";
import { actions } from "@/lib/store";
import type { SchoolClass } from "@/lib/types";
import { Button, Field, Modal, cx, inputClass } from "../ui";

/**
 * Students add personal reminders (never worth points). Teachers can also set
 * work for a class they teach and choose how many points it pays once verified.
 */
export function AddTaskModal({
  open,
  onClose,
  teachingClasses,
  defaultClassId = null,
}: {
  open: boolean;
  onClose: () => void;
  teachingClasses: SchoolClass[];
  defaultClassId?: string | null;
}) {
  const teacher = teachingClasses.length > 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={defaultClassId ? "Set work" : "Add a task"}
      description={
        teacher
          ? "Set work for a class you teach, or add a personal reminder. Points are paid when you verify the work."
          : "Your own reminders sit next to class work. Only teachers can attach points to a task."
      }
    >
      {/* Remount the form each time so it starts empty. */}
      {open && <AddTaskForm teachingClasses={teachingClasses} defaultClassId={defaultClassId} onDone={onClose} />}
    </Modal>
  );
}

function AddTaskForm({
  teachingClasses,
  defaultClassId,
  onDone,
}: {
  teachingClasses: SchoolClass[];
  defaultClassId: string | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState<string>(defaultClassId ?? "");
  const [due, setDue] = useState(() => toISODate(addDays(new Date(), 1)));
  const [points, setPoints] = useState(10);
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || saving) return;
        setSaving(true);
        const ok = await actions.addTask({ title, classId: classId || null, due, points: classId ? points : 0, details });
        setSaving(false);
        if (ok) {
          toast(classId ? "Work set for the class" : "Task added", "success");
          onDone();
        }
      }}
    >
      <Field label="What needs doing?" htmlFor="task-title">
        <input
          id="task-title"
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={classId ? "Enzymes practice questions" : "Revise enzymes for 20 minutes"}
          required
          autoFocus
          maxLength={120}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {teachingClasses.length > 0 && (
          <Field label="For" htmlFor="task-class">
            <select id="task-class" className={inputClass} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Just me (reminder)</option>
              {teachingClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Due" htmlFor="task-due">
          <input id="task-due" type="date" className={inputClass} value={due} onChange={(e) => setDue(e.target.value)} required />
        </Field>
        {classId && (
          <Field label="Points when verified" htmlFor="task-points">
            <input
              id="task-points"
              type="number"
              min={0}
              max={100}
              step={5}
              className={inputClass}
              value={points}
              onChange={(e) => setPoints(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            />
          </Field>
        )}
      </div>
      <Field label={classId ? "Instructions (optional)" : "Notes (optional)"} htmlFor="task-details">
        <textarea
          id="task-details"
          className={cx(inputClass, "h-auto py-3 leading-[21px]")}
          rows={3}
          maxLength={4000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={classId ? "What to do and what to hand in. You can attach files on the task page." : "Anything to remember"}
        />
      </Field>
      <div className="mt-1 flex justify-end gap-2.5">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : classId ? "Set work" : "Add task"}
        </Button>
      </div>
    </form>
  );
}
