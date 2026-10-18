import Link from "next/link";
import { cx } from "../ui";

const STAT_TONES = {
  sky: { bar: "bg-sky", text: "text-sky" },
  amber: { bar: "bg-amber", text: "text-amber" },
  mint: { bar: "bg-mint", text: "text-mint" },
  brand: { bar: "bg-brand", text: "text-brand" },
} as const;

export function StatCard({ value, label, tone, href }: { value: number; label: string; tone: keyof typeof STAT_TONES; href?: string }) {
  const body = (
    <>
      <span className={cx("h-1 w-[26px] rounded-[2px]", STAT_TONES[tone].bar)} />
      <span className={cx("text-[27px] font-bold leading-none", STAT_TONES[tone].text)}>{value}</span>
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
