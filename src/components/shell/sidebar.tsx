"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/lib/store";
import { unreadPosts } from "@/lib/selectors";
import { Avatar, cx } from "../ui";
import { NAV_ITEMS } from "./nav";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const state = useAppState();
  const unread = state ? unreadPosts(state) : 0;

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-[11px] rounded-control px-3 py-2.5 text-[13.5px] font-semibold transition-colors",
              active ? "bg-neutral-tag text-ink" : "text-muted hover:bg-canvas hover:text-ink",
            )}
          >
            <Icon className={active ? "text-ink" : "text-faint"} />
            <span className="flex-1">{label}</span>
            {href === "/discussions" && unread > 0 && (
              <span
                className="grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10.5px] font-bold leading-[18px] text-white"
                aria-label={`${unread} unread`}
              >
                {unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarProfile() {
  const state = useAppState();
  const name = state?.student.shortName ?? "";
  return (
    <div className="flex items-center gap-2.5 py-2 pl-1.5">
      {state ? <Avatar name={state.student.fullName} size={30} /> : <span className="size-[30px] rounded-full bg-neutral-tag" />}
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[12.5px] font-semibold text-ink">{name || " "}</p>
        <p className="text-[11px] text-faint">{state?.student.yearGroup ?? " "}</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-16 hidden h-[calc(var(--screen)-4rem)] w-[232px] shrink-0 flex-col justify-between border-r border-line bg-white px-3.5 py-[18px] lg:flex">
      <SidebarNav />
      <SidebarProfile />
    </aside>
  );
}
