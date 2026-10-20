"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast, useNow } from "@/lib/client-hooks";
import { classHref, taskHref } from "@/lib/routes";
import { balance, classById, isStaff, pendingReviews, streak } from "@/lib/selectors";
import { actions, auth, useAppState } from "@/lib/store";
import type { AppState, Role } from "@/lib/types";
import { CloseIcon, LogoMark, MenuIcon, SearchIcon } from "../icons";
import { Avatar, Chip, ClassChip, Segmented, cx } from "../ui";
import { SidebarNav, SidebarProfile } from "./sidebar";

interface SearchResult {
  key: string;
  kind: "Task" | "Class" | "Thread";
  title: string;
  detail: string;
  classId: string | null;
  href: string;
  threadId?: string;
}

function search(state: AppState, query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const results: SearchResult[] = [];
  for (const c of state.classes) {
    if (c.name.toLowerCase().includes(q) || c.teacher.toLowerCase().includes(q)) {
      results.push({ key: c.id, kind: "Class", title: c.name, detail: c.teacher, classId: c.id, href: classHref(c.id) });
    }
  }
  for (const t of state.tasks) {
    if (t.title.toLowerCase().includes(q)) {
      results.push({
        key: t.id,
        kind: "Task",
        title: t.title,
        detail: classById(state, t.classId)?.name ?? "Personal",
        classId: t.classId,
        href: taskHref(t.id),
      });
    }
  }
  for (const th of state.threads) {
    const hit = th.title.toLowerCase().includes(q) || th.posts.some((p) => p.body.toLowerCase().includes(q));
    if (hit) {
      const last = th.posts[th.posts.length - 1];
      results.push({
        key: th.id,
        kind: "Thread",
        title: th.title,
        detail: last ? `${last.author}: ${last.body}` : "",
        classId: th.classId,
        href: "/discussions",
        threadId: th.id,
      });
    }
  }
  return results.slice(0, 8);
}

function SearchBox({
  state,
  className,
  onNavigate,
}: {
  state: AppState | null;
  className?: string;
  onNavigate?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => (state ? search(state, query) : []), [state, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = (r: SearchResult) => {
    if (r.threadId) actions.openThread(r.threadId);
    setOpen(false);
    setQuery("");
    onNavigate?.();
    router.push(r.href);
  };

  return (
    <div ref={wrapRef} className={cx("relative", className)}>
      <label className="flex h-[38px] items-center gap-[9px] rounded-full bg-canvas px-3.5 text-faint focus-within:ring-2 focus-within:ring-brand/25">
        <SearchIcon />
        <span className="sr-only">Search</span>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && results[0]) go(results[0]);
          }}
          placeholder="Search tasks, classes, discussions"
          aria-controls={listId}
          aria-expanded={open && results.length > 0}
          role="combobox"
          autoComplete="off"
          className="h-full w-full bg-transparent text-[13px] text-ink placeholder:text-faint focus:outline-none"
        />
      </label>
      {open && query.trim().length >= 2 && (
        <div
          id={listId}
          role="listbox"
          className="absolute top-[calc(100%+6px)] left-0 z-40 w-full min-w-[320px] overflow-hidden rounded-[14px] border border-line bg-white py-1.5 shadow-pop"
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-[12.5px] text-muted">Nothing matches “{query.trim()}”.</p>
          ) : (
            results.map((r) => (
              <button
                key={`${r.kind}-${r.key}`}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => go(r)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-canvas"
              >
                <span className="w-12 shrink-0 text-[10.5px] font-bold tracking-wide text-faint uppercase">{r.kind}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{r.title}</span>
                  <span className="block truncate text-[11.5px] text-muted">{r.detail}</span>
                </span>
                {r.kind !== "Class" && state && <ClassChip cls={classById(state, r.classId)} />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const DEMO_ROLES: { value: Role; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "admin", label: "Coordinator" },
];

function AccountMenu({ state }: { state: AppState | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        onClick={() => setOpen((v) => !v)}
        className="grid size-8 place-items-center rounded-full"
      >
        {state ? <Avatar name={state.student.fullName} me /> : <span className="size-8 rounded-full bg-neutral-tag" />}
      </button>
      {open && state && (
        <div role="menu" className="absolute top-[calc(100%+8px)] right-0 z-40 w-[280px] max-w-[calc(100vw-32px)] rounded-[14px] border border-line bg-white p-1.5 shadow-pop">
          <div className="px-3 py-2.5">
            <p className="text-[13px] font-semibold">{state.student.fullName}</p>
            <p className="truncate text-[11.5px] text-muted">{state.student.email}</p>
            <p className="mt-1.5">
              <Chip tone={state.mode === "live" ? "mint" : "neutral"} size="sm">
                {state.mode === "live" ? `Signed in · ${state.student.yearGroup || "Student"}` : "Demo mode"}
              </Chip>
            </p>
          </div>
          <div className="my-1 h-px bg-line" />
          {state.mode === "demo" && (
            <div className="px-3 pt-1 pb-2.5">
              <p className="mb-1.5 text-[11.5px] font-semibold text-muted">View the demo as</p>
              <Segmented<Role>
                label="View the demo as"
                value={state.role}
                onChange={(role) => {
                  actions.switchDemoRole(role);
                  setOpen(false);
                  router.push("/dashboard");
                }}
                options={DEMO_ROLES}
              />
            </div>
          )}
          {state.mode === "demo" && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                actions.resetDemo();
                setOpen(false);
                toast("Demo data reset");
              }}
              className="w-full rounded-[10px] px-3 py-2 text-left text-[13px] text-ink hover:bg-canvas"
            >
              Reset demo data
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await auth.signOut();
              router.push("/sign-in");
            }}
            className="w-full rounded-[10px] px-3 py-2 text-left text-[13px] text-ink hover:bg-canvas"
          >
            {state.mode === "demo" ? "Leave the demo" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const state = useAppState();
  const now = useNow();
  const [drawer, setDrawer] = useState(false);
  const days = state ? streak(state, now) : 0;
  const pts = state ? balance(state) : 0;
  const toCheck = state ? pendingReviews(state).length : 0;

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3.5 border-b border-line bg-white px-4 sm:px-6">
        <button
          type="button"
          className="-ml-1 grid size-9 place-items-center rounded-[10px] text-muted hover:bg-canvas lg:hidden"
          aria-label="Open menu"
          onClick={() => setDrawer(true)}
        >
          <MenuIcon />
        </button>
        <Link href="/dashboard" className="flex items-center gap-[9px]">
          <LogoMark />
          <span className="text-[18px] font-bold text-ink">Clarion</span>
        </Link>
        <span className="hidden w-2.5 md:block" />
        <SearchBox state={state} className="hidden w-[360px] md:block" />
        <div className="flex-1" />
        {state && isStaff(state) && toCheck > 0 && (
          <Link href="/dashboard">
            <Chip tone="amber" className="text-[12px]">
              {toCheck} to check
            </Chip>
          </Link>
        )}
        {state && !isStaff(state) && (
          <div className="flex items-center gap-2">
            {days > 0 && (
              <Link href="/road-to-glory" className="hidden sm:block">
                <Chip tone="amber" className="text-[12px]">
                  {days} day streak
                </Chip>
              </Link>
            )}
            <Link href="/road-to-glory">
              <Chip tone="brand" className="text-[12px]">
                {pts} pts
              </Chip>
            </Link>
          </div>
        )}
        <AccountMenu state={state} />
      </header>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/30" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[272px] flex-col justify-between bg-white px-3.5 py-4 shadow-pop">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                <span className="flex items-center gap-[9px]">
                  <LogoMark />
                  <span className="text-[18px] font-bold">Clarion</span>
                </span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setDrawer(false)}
                  className="grid size-8 place-items-center rounded-full text-muted hover:bg-canvas"
                >
                  <CloseIcon />
                </button>
              </div>
              <SearchBox state={state} onNavigate={() => setDrawer(false)} />
              <SidebarNav onNavigate={() => setDrawer(false)} />
            </div>
            <SidebarProfile />
          </div>
        </div>
      )}
    </>
  );
}
