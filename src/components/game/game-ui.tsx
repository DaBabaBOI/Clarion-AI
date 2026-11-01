import type { ComponentProps, ReactNode } from "react";
import { fromMap, outlined } from "@/lib/game/pixels";
import { cx } from "../ui";
import { PixelArt } from "./pixel-art";

// Building blocks for the Road to Glory screen: framed panels, chunky
// buttons, HP and XP bars, and a few tiny pixel icons.

export function GamePanel({
  title,
  right,
  className,
  children,
  ...rest
}: { title?: ReactNode; right?: ReactNode } & ComponentProps<"section">) {
  return (
    <section className={cx("pixel-panel flex flex-col gap-3 p-4 text-game-ink", className)} {...rest}>
      {(title || right) && (
        <div className="flex flex-wrap items-center gap-2">
          {title && <h2 className="font-pixel text-[11px] leading-4 tracking-wide text-game-gold uppercase">{title}</h2>}
          <span className="flex-1" />
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const BUTTON_TONES = {
  gold: "[--btn:var(--color-game-gold)] [--btn-deep:var(--color-game-gold-deep)] text-[#2b1a00]",
  green: "[--btn:#5fd36b] [--btn-deep:#2f8a3a] text-[#0d2a12]",
  red: "[--btn:#ff6b6b] [--btn-deep:#9c2a26] text-[#2b0606]",
  blue: "[--btn:#6fb8ff] [--btn-deep:#2a5aa0] text-[#071a33]",
  stone: "[--btn:#a99fc4] [--btn-deep:#5b5378] text-[#17132a]",
} as const;

export function PixelButton({
  tone = "gold",
  size = "md",
  className,
  type = "button",
  ...rest
}: ComponentProps<"button"> & { tone?: keyof typeof BUTTON_TONES; size?: "sm" | "md" }) {
  return (
    <button
      type={type}
      className={cx(
        "pixel-button font-pixel whitespace-nowrap uppercase disabled:cursor-not-allowed",
        size === "sm" ? "px-2.5 py-1.5 text-[8px] leading-3" : "px-3.5 py-2.5 text-[10px] leading-4",
        BUTTON_TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}

export function StatBar({
  value,
  max,
  color,
  label,
  className,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cx("pixel-inset relative h-3 overflow-hidden", className)}
    >
      <div className="h-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
      {/* Light top edge on the fill, like a lit tube. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-white/25" style={{ width: `${pct}%` }} />
    </div>
  );
}

const ICONS = {
  coin: { rows: [".yyyy.", "yYyyYy", "yYyyYy", "yYyyYy", "yYyyYy", ".yyyy."], pal: { y: "#ffd23f", Y: "#c98f1e" } },
  scroll: {
    rows: ["WwwwwW", ".pppp.", ".pkkp.", ".pppp.", ".pkkp.", "WwwwwW"],
    pal: { w: "#c08a50", W: "#8a5a2b", p: "#f1e3c2", k: "#a8925f" },
  },
  potion: { rows: ["..cc..", "..gg..", ".gggg.", "grrrrg", "grRrrg", ".gggg."], pal: { c: "#a0673a", g: "#bfe3ff", r: "#e8433a", R: "#ffffff" } },
  lock: { rows: [".kkk.", "k...k", "kkkkk", "kyyyk", "kkkkk"], pal: { k: "#a99fc4", y: "#ffd23f" } },
  star: { rows: ["..y..", ".yyy.", "yyyyy", ".yyy.", ".y.y."], pal: { y: "#ffd23f" } },
  heart: { rows: [".r.r.", "rrrrr", "rrrrr", ".rrr.", "..r.."], pal: { r: "#e8433a" } },
  shield: { rows: ["sssss", "sSsSs", "sssss", ".sss.", "..s.."], pal: { s: "#c9d3dd", S: "#8e9aab" } },
  sword: { rows: ["....s", "...s.", "y.s..", ".y...", "y.y.."], pal: { s: "#dfe6ee", y: "#ffd23f" } },
} as const;

const iconGrids = Object.fromEntries(
  Object.entries(ICONS).map(([key, { rows, pal }]) => [key, outlined(fromMap([...rows], pal as Record<string, string>))]),
) as Record<keyof typeof ICONS, ReturnType<typeof outlined>>;

export function GameIcon({ kind, scale = 2, title }: { kind: keyof typeof ICONS; scale?: number; title?: string }) {
  return <PixelArt grid={iconGrids[kind]} scale={scale} title={title} className="inline-block shrink-0" />;
}

/** "120 G" with a coin. */
export function Gold({ amount, className }: { amount: number; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 font-pixel text-[10px] text-game-gold", className)}>
      <GameIcon kind="coin" />
      {amount}
    </span>
  );
}
