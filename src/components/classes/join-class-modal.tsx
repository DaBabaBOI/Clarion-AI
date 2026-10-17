"use client";

import { useState } from "react";
import { toast } from "@/lib/client-hooks";
import type { SchoolClass } from "@/lib/types";
import { CODE_LENGTH, CodeInput } from "../code-input";
import { Button, Modal } from "../ui";

export function JoinClassModal({ open, onClose, classes }: { open: boolean; onClose: () => void; classes: SchoolClass[] }) {
  return (
    <Modal open={open} onClose={onClose} title="Join a class" description="Type the six character code your teacher shared.">
      {open && <JoinForm classes={classes} onDone={onClose} />}
    </Modal>
  );
}

function JoinForm({ classes, onDone }: { classes: SchoolClass[]; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length < CODE_LENGTH) {
          setMessage("Class codes have six characters.");
          return;
        }
        const existing = classes.find((c) => c.code === code);
        if (existing) {
          setMessage(`You are already in ${existing.name}.`);
          return;
        }
        // Joining needs the school's class list, which lives in Supabase.
        toast("Class codes work once your school is connected");
        onDone();
      }}
    >
      <CodeInput value={code} onChange={(v) => (setCode(v), setMessage(null))} />
      {message && (
        <p role="alert" className="text-[12.5px] font-semibold text-amber">
          {message}
        </p>
      )}
      <div className="flex justify-end gap-2.5">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Join class</Button>
      </div>
    </form>
  );
}
