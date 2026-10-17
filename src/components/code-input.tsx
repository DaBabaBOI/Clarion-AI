"use client";

import { useRef } from "react";
import { cx } from "./ui";

export const CODE_LENGTH = 6;

/**
 * Six boxes for a class code. Filled boxes get the brand outline so the
 * format is obvious without a help label (Figma note 6 on the sign-in screen).
 */
export function CodeInput({ value, onChange, label = "Class code" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.padEnd(CODE_LENGTH, " ").slice(0, CODE_LENGTH).split("");

  const setAt = (i: number, ch: string) => {
    const next = chars.map((c, j) => (j === i ? ch : c)).join("").replace(/\s+$/, "");
    onChange(next.replace(/ /g, ""));
  };

  return (
    <div role="group" aria-label={label} className="flex gap-2.5">
      {chars.map((c, i) => {
        const filled = c.trim() !== "";
        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            aria-label={`${label}, character ${i + 1} of ${CODE_LENGTH}`}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={1}
            value={c.trim()}
            onChange={(e) => {
              const ch = e.target.value.replace(/[^a-z0-9]/gi, "").slice(-1).toUpperCase();
              if (!ch) return;
              setAt(i, ch);
              refs.current[Math.min(i + 1, CODE_LENGTH - 1)]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace") {
                e.preventDefault();
                if (filled) setAt(i, " ");
                else if (i > 0) {
                  setAt(i - 1, " ");
                  refs.current[i - 1]?.focus();
                }
              }
              if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowRight" && i < CODE_LENGTH - 1) refs.current[i + 1]?.focus();
            }}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = e.clipboardData.getData("text").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, CODE_LENGTH);
              onChange(pasted);
              refs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
            }}
            className={cx(
              "h-[54px] w-full min-w-0 rounded-control text-center text-[19px] font-bold text-ink uppercase focus:outline-none focus:ring-2 focus:ring-brand/25",
              filled ? "border-[1.5px] border-brand bg-white" : "border border-line bg-canvas",
            )}
          />
        );
      })}
    </div>
  );
}
