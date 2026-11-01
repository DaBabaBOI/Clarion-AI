import type { BoardRow } from "@/lib/selectors";
import { Avatar, cx } from "../ui";

const RANK_STYLE: Record<number, string> = {
  1: "border-gold bg-gold-soft text-amber",
  2: "border-silver bg-silver-soft text-silver",
  3: "border-bronze bg-bronze-soft text-bronze",
};

/** One leaderboard row, used on the staff class boards. */
export function BoardRowView({ row, hidden, school }: { row: BoardRow; hidden: boolean; school: boolean }) {
  const name = row.me ? (hidden ? "You (hidden)" : `${row.name} (you)`) : school ? `Student · ${row.group}` : row.name;
  return (
    <li className={cx("flex items-center gap-3 px-2 py-2.5", row.me && "rounded-[12px] bg-brand-soft")}>
      <span
        className={cx(
          "grid size-[27px] shrink-0 place-items-center rounded-full text-[11.5px] font-bold",
          RANK_STYLE[row.rank] ? cx("border-[1.5px]", RANK_STYLE[row.rank]) : "text-faint",
        )}
      >
        {row.rank}
      </span>
      {school && !row.me ? (
        <span className="size-[26px] shrink-0 rounded-full bg-canvas" aria-hidden="true" />
      ) : (
        <Avatar name={row.me && hidden ? "?" : row.name} size={26} me={row.me} />
      )}
      <span className={cx("min-w-0 flex-1 truncate text-[13.5px] font-semibold", row.me ? "text-brand" : "text-ink")}>{name}</span>
      <span className={cx("text-[13.5px] font-semibold", row.me ? "text-brand" : "text-muted")}>{row.points}</span>
    </li>
  );
}
