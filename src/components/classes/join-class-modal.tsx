"use client";

import { useState } from "react";
import { toast } from "@/lib/client-hooks";
import { actions } from "@/lib/store";
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
  const [joining, setJoining] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
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
        setJoining(true);
        const result = await actions.joinClass(code);
        setJoining(false);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        toast(result.message, "success");
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
        <Button type="submit" disabled={joining}>
          {joining ? "Joining…" : "Join class"}
        </Button>
      </div>
    </form>
  );
}
