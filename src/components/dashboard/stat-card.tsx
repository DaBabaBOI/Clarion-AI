import Link from "next/link";
import { cx } from "../ui";

// The number stays ink; a short coloured bar says which kind of stat it is.
const STAT_TONES = {
  sky: { bar: "bg-sky" },
  amber: { bar: "bg-amber" },
  mint: { bar: "bg-mint" },
  brand: { bar: "bg-brand" },
} as const;

export function StatCard({ value, label, tone, href }: { value: number; label: string; tone: keyof typeof STAT_TONES; href?: string }) {
  const body = (
    <>
      <span className={cx("h-1 w-[26px] rounded-[2px]", STAT_TONES[tone].bar)} />
      <span className="text-[27px] font-bold leading-none text-ink">{value}</span>
      <span className="text-[12.5px] text-muted">{label}</span>
    </>
  );
  const className = "flex flex-col gap-2.5 rounded-card border border-line bg-white px-5 py-4";
  return href ? (
    <Link href={href} className={cx(className, "transition hover:border-faint")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
