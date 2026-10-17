"use client";

import Link from "next/link";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import type { ClassColor, SchoolClass, TaskStatus } from "@/lib/types";
import { CheckIcon, CloseIcon } from "./icons";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ── Surfaces ────────────────────────────────────────────────────────────────

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-card border border-line bg-white px-5 py-[18px]", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  children,
  small = false,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  small?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-center gap-x-2.5 gap-y-1.5", className)}>
      <h2 className={cx("font-bold whitespace-nowrap text-ink", small ? "text-[15px]" : "text-[16.5px]")}>{title}</h2>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="min-w-[min(100%,240px)] flex-1">
        <h1 className="text-[25px] font-bold leading-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[13.5px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx("h-px w-full bg-line", className)} />;
}

// ── Chips ───────────────────────────────────────────────────────────────────

export type ChipTone =
  | "amber"
  | "sky"
  | "mint"
  | "brand"
  | "neutral"
  | "white"
  | "teacher"
  | "solid-mint"
  | "solid-amber"
  | "pending";

const CHIP_TONES: Record<ChipTone, string> = {
  amber: "bg-amber-soft text-amber",
  sky: "bg-sky-soft text-sky",
  mint: "bg-mint-soft text-mint",
  brand: "bg-brand-soft text-brand",
  neutral: "bg-canvas text-muted",
  white: "bg-white text-muted",
  teacher: "bg-brand text-white",
  "solid-mint": "bg-mint text-white",
  "solid-amber": "bg-amber text-white",
  pending: "border border-dashed border-faint bg-white text-muted",
};

export function Chip({
  tone = "neutral",
  size = "md",
  className,
  children,
}: {
  tone?: ChipTone;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold leading-tight",
        size === "sm" ? "px-[9px] py-1 text-[10.5px]" : "px-[9px] py-1 text-[11.5px]",
        CHIP_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const CLASS_TONE: Record<ClassColor, ChipTone> = { mint: "mint", sky: "sky", brand: "brand", amber: "amber" };

export const CLASS_SWATCH: Record<ClassColor, string> = {
  mint: "bg-mint",
  sky: "bg-sky",
  brand: "bg-brand",
  amber: "bg-amber",
};

export const CLASS_TEXT: Record<ClassColor, string> = {
  mint: "text-mint",
  sky: "text-sky",
  brand: "text-brand",
  amber: "text-amber",
};

export function ClassChip({ cls, onWhite = false }: { cls: SchoolClass | null; onWhite?: boolean }) {
  if (!cls) return <Chip tone="neutral">Personal</Chip>;
  return (
    <Chip tone={onWhite ? "white" : CLASS_TONE[cls.color]} className={onWhite ? CLASS_TEXT[cls.color] : undefined}>
      {cls.name}
    </Chip>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-gradient text-white hover:brightness-105 active:brightness-95",
  secondary: "border border-line bg-white text-ink hover:bg-canvas",
  ghost: "text-brand hover:bg-brand-soft",
};

function buttonClass(variant: ButtonVariant, size: "sm" | "md", full?: boolean, pill?: boolean) {
  return cx(
    "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50",
    pill ? "rounded-full" : "rounded-control",
    size === "sm" ? "px-4 py-[9px] text-[13px]" : "px-4 py-2.5 text-[13.5px]",
    BUTTON_VARIANTS[variant],
    full && "w-full",
  );
}

export function Button({
  variant = "primary",
  size = "md",
  full,
  pill,
  className,
  type = "button",
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md"; full?: boolean; pill?: boolean }) {
  return <button type={type} className={cx(buttonClass(variant, size, full, pill), className)} {...rest} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  full,
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md"; full?: boolean }) {
  return <Link className={cx(buttonClass(variant, size, full), className)} {...rest} />;
}

export function TextButton({ className, ...rest }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cx("text-[12.5px] font-semibold text-brand hover:underline underline-offset-2", className)}
      {...rest}
    />
  );
}

// ── Task checkbox ───────────────────────────────────────────────────────────

/**
 * Three visual states: empty (open), gradient tick (handed in, waiting for the
 * teacher) and green tick (verified). Verified tasks are locked.
 */
export function TaskCheckbox({
  status,
  label,
  onToggle,
}: {
  status: TaskStatus;
  label: string;
  onToggle: () => void;
}) {
  const verified = status === "verified";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={status !== "open"}
      aria-disabled={verified}
      aria-label={
        verified ? `${label}: verified by your teacher` : status === "submitted" ? `${label}: handed in, tap to undo` : `Hand in ${label}`
      }
      onClick={verified ? undefined : onToggle}
      className={cx(
        "grid size-5 shrink-0 place-items-center rounded-[6px] text-white transition",
        status === "open" && "border-[1.5px] border-line bg-white hover:border-brand",
        status === "submitted" && "bg-brand-gradient",
        verified && "cursor-default bg-mint",
      )}
    >
      {status !== "open" && <CheckIcon />}
    </button>
  );
}

export function StatusChip({ status, due }: { status: TaskStatus; due: { label: string; tone: "amber" | "sky" | "neutral" } }) {
  if (status === "verified") return <Chip tone="mint">Done</Chip>;
  if (status === "submitted") return <Chip tone="pending">Awaiting check</Chip>;
  return <Chip tone={due.tone}>{due.label}</Chip>;
}

// ── Avatar ──────────────────────────────────────────────────────────────────

export function Avatar({ name, size = 32, me = false }: { name: string; size?: number; me?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter((c) => c && /[A-Za-z]/.test(c))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className={cx(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        me ? "bg-brand-gradient text-white" : "bg-brand-soft text-brand",
      )}
    >
      {initials}
    </span>
  );
}

// ── Switch ──────────────────────────────────────────────────────────────────

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-brand-gradient" : "bg-line",
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-tab transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

// ── Segmented control ───────────────────────────────────────────────────────

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-[10px] bg-canvas p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-[8px] px-3 py-1.5 text-[11.5px] font-semibold transition",
            o.value === value ? "bg-white text-ink shadow-tab" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Pixel badge ─────────────────────────────────────────────────────────────

const PIXEL_FILL = { gold: "bg-gold", mint: "bg-mint", sky: "bg-sky", brand: "bg-brand", locked: "bg-line" };

/** 4×4 grid of 8px blocks with 2px gaps (40×40), sharp on purpose. */
export function PixelBadge({ pattern, color }: { pattern: string; color: keyof typeof PIXEL_FILL }) {
  return (
    <span aria-hidden="true" className="grid size-10 grid-cols-4 gap-0.5 p-px">
      {pattern.split("").map((c, i) => (
        <span key={i} className={cx("size-2", c === "x" && PIXEL_FILL[color])} />
      ))}
    </span>
  );
}

// ── Progress bar ────────────────────────────────────────────────────────────

export function ProgressBar({ value, max, tone = "amber", label }: { value: number; max: number; tone?: "amber" | "brand"; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-1.5 w-full overflow-hidden rounded-full bg-canvas"
    >
      <div className={cx("h-full rounded-full", tone === "amber" ? "bg-amber" : "bg-brand-gradient")} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────

/** Native <dialog>: focus trapping, Escape and the backdrop come for free. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      style={{ maxWidth: `min(${width}px, calc(100vw - 32px))` }}
      className="m-auto w-full rounded-card border border-line bg-white p-0 text-ink shadow-pop backdrop:bg-ink/30 backdrop:backdrop-blur-[2px]"
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-bold">{title}</h2>
              {description && <p className="mt-1 text-[13px] leading-5 text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink"
            >
              <CloseIcon />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

// ── Form fields ─────────────────────────────────────────────────────────────

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={htmlFor} className="text-[12.5px] font-semibold text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputClass =
  "h-[46px] w-full rounded-control border border-line bg-white px-3.5 text-[14px] text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

// ── Loading ─────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-card bg-white/70 ring-1 ring-line", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading">
      <div className="h-[54px] w-72 animate-pulse rounded-lg bg-line/60" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[106px]" />
        ))}
      </div>
      <Skeleton className="h-[420px]" />
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-[12px] bg-canvas px-6 py-8 text-center">
      <p className="text-[13.5px] font-semibold text-ink">{title}</p>
      <p className="max-w-xs text-[12.5px] leading-5 text-muted">{body}</p>
    </div>
  );
}
