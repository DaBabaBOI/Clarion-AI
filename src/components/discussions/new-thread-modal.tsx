"use client";

import { useState } from "react";
import { toast } from "@/lib/client-hooks";
import { actions } from "@/lib/store";
import type { SchoolClass } from "@/lib/types";
import { Button, Field, Modal, cx, inputClass } from "../ui";

export function NewThreadModal({
  open,
  onClose,
  classes,
  defaultClassId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  classes: SchoolClass[];
  defaultClassId: string | null;
  onCreated: (id: string) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New thread"
      description="Ask your class in public, or message your teacher directly."
      width={480}
    >
      {open && <NewThreadForm classes={classes} defaultClassId={defaultClassId} onClose={onClose} onCreated={onCreated} />}
    </Modal>
  );
}

function NewThreadForm({
  classes,
  defaultClassId,
  onClose,
  onCreated,
}: {
  classes: SchoolClass[];
  defaultClassId: string | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [classId, setClassId] = useState(defaultClassId ?? classes[0]?.id ?? "");
  const [visibility, setVisibility] = useState<"public" | "direct">("public");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const teacher = classes.find((c) => c.id === classId)?.teacher ?? "your teacher";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !body.trim() || !classId) return;
        const id = actions.createThread({ classId, title, body, visibility });
        toast(visibility === "direct" ? `Sent to ${teacher}` : "Thread posted", "success");
        onCreated(id);
        onClose();
      }}
    >
      <Field label="Class" htmlFor="thread-class">
        <select id="thread-class" className={inputClass} value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="flex flex-col gap-[7px]">
        <legend className="mb-[7px] text-[12.5px] font-semibold text-muted">Who can see it</legend>
        <div className="grid grid-cols-2 gap-1 rounded-[12px] bg-canvas p-1">
          {(
            [
              ["public", "Whole class"],
              ["direct", `Only ${teacher}`],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={cx(
                "cursor-pointer rounded-[9px] py-[9px] text-center text-[13px] font-semibold transition",
                visibility === value ? "bg-white text-ink shadow-tab" : "text-muted",
              )}
            >
              <input
                type="radio"
                name="visibility"
                value={value}
                checked={visibility === value}
                onChange={() => setVisibility(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Title" htmlFor="thread-title">
        <input
          id="thread-title"
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Question about the worksheet"
          maxLength={80}
          required
        />
      </Field>
      <Field label="Message" htmlFor="thread-body">
        <textarea
          id="thread-body"
          className={cx(inputClass, "h-28 resize-none py-3 leading-5")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message"
          maxLength={2000}
          required
        />
      </Field>
      <div className="flex justify-end gap-2.5">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Post</Button>
      </div>
    </form>
  );
}
