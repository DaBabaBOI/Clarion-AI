"use client";

import { useState } from "react";
import { toast } from "@/lib/client-hooks";
import { addDays, toISODate } from "@/lib/dates";
import { actions } from "@/lib/store";
import type { SchoolClass } from "@/lib/types";
import { Button, Field, Modal, inputClass } from "../ui";

export function AddTaskModal({
  open,
  onClose,
  classes,
  defaultClassId = null,
}: {
  open: boolean;
  onClose: () => void;
  classes: SchoolClass[];
  defaultClassId?: string | null;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a task"
      description="Your own reminders sit next to class work. Only teachers can attach points to a task."
    >
      {/* Remount the form each time so it starts empty. */}
      {open && <AddTaskForm classes={classes} defaultClassId={defaultClassId} onDone={onClose} />}
    </Modal>
  );
}

function AddTaskForm({
  classes,
  defaultClassId,
  onDone,
}: {
  classes: SchoolClass[];
  defaultClassId: string | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState<string>(defaultClassId ?? "");
  const [due, setDue] = useState(() => toISODate(addDays(new Date(), 1)));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        actions.addTask({ title, classId: classId || null, due });
        toast("Task added", "success");
        onDone();
      }}
    >
      <Field label="What do you need to do?" htmlFor="task-title">
        <input
          id="task-title"
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Revise enzymes for 20 minutes"
          required
          autoFocus
          maxLength={120}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Class" htmlFor="task-class">
          <select id="task-class" className={inputClass} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Personal</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due" htmlFor="task-due">
          <input id="task-due" type="date" className={inputClass} value={due} onChange={(e) => setDue(e.target.value)} required />
        </Field>
      </div>
      <div className="mt-1 flex justify-end gap-2.5">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Add task</Button>
      </div>
    </form>
  );
}
