"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useAppState } from "@/lib/store";
import { unreadPosts } from "@/lib/selectors";
import { Avatar, cx } from "../ui";
import { NAV_ITEMS } from "./nav";

type NavProps = { onNavigate?: () => void };

/**
 * The current path is request data on dynamic routes such as /classes/[id],
 * so the active state streams in; until then the links render without it.
 */
export function SidebarNav(props: NavProps) {
  return (
    <Suspense fallback={<NavList pathname={null} {...props} />}>
      <ActiveNav {...props} />
    </Suspense>
  );
}

function ActiveNav(props: NavProps) {
  return <NavList pathname={usePathname()} {...props} />;
}

function NavList({ pathname, onNavigate }: NavProps & { pathname: string | null }) {
  const state = useAppState();
  const unread = state ? unreadPosts(state) : 0;

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-[11px] rounded-control px-3 py-2.5 text-[13.5px] font-semibold transition-colors",
              active ? "bg-brand-gradient text-white" : "text-muted hover:bg-canvas hover:text-ink",
            )}
          >
            <Icon className={active ? "text-white" : "text-faint"} />
            <span className="flex-1">{label}</span>
            {href === "/discussions" && unread > 0 && (
              <span
                className={cx(
                  "grid min-w-[18px] place-items-center rounded-full px-1 text-[10.5px] font-bold leading-[18px]",
                  active ? "bg-white text-brand" : "bg-brand text-white",
                )}
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
      {state ? <Avatar name={state.student.fullName} size={30} /> : <span className="size-[30px] rounded-full bg-brand-soft" />}
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[12.5px] font-semibold text-ink">{name || " "}</p>
        <p className="text-[11px] text-faint">{state?.student.yearGroup ?? " "}</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[232px] shrink-0 flex-col justify-between border-r border-line bg-white px-3.5 py-[18px] lg:flex">
      <SidebarNav />
      <SidebarProfile />
    </aside>
  );
}
