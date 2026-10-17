"use client";

import { useToasts } from "@/lib/client-hooks";
import { CheckIcon } from "../icons";
import { cx } from "../ui";

export function Toaster() {
  const toasts = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            "flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold shadow-pop",
            t.tone === "success" ? "bg-mint text-white" : "bg-ink text-white",
          )}
          style={{ animation: "toast-in 180ms ease-out" }}
        >
          {t.tone === "success" && <CheckIcon />}
          {t.message}
        </div>
      ))}
    </div>
  );
}
