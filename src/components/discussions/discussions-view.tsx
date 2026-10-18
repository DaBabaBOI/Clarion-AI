"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNow } from "@/lib/client-hooks";
import { timeAgo, timeAgoShort } from "@/lib/dates";
import { classById, sortThreads } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import type { AppState, Thread } from "@/lib/types";
import { ArrowLeftIcon, CloseIcon, SearchIcon } from "../icons";
import { Avatar, Button, Chip, ClassChip, EmptyState, PageHeader, cx } from "../ui";
import { NewThreadModal } from "./new-thread-modal";

type Filter = "all" | "unread" | "pinned" | "teacher";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "pinned", label: "Pinned" },
  { value: "teacher", label: "Teacher" },
];

function matches(thread: Thread, filter: Filter, query: string) {
  if (filter === "unread" && thread.unread === 0) return false;
  if (filter === "pinned" && !thread.pinned) return false;
  if (filter === "teacher" && !thread.posts.some((p) => p.role === "teacher")) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return thread.title.toLowerCase().includes(q) || thread.posts.some((p) => p.body.toLowerCase().includes(q));
}

function ThreadView({ state, thread, onBack }: { state: AppState; thread: Thread; onBack: () => void }) {
  const now = useNow();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const cls = classById(state, thread.classId);
  const direct = thread.visibility === "direct";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [thread.posts.length]);

  return (
    <section className="flex min-h-[560px] min-w-0 flex-1 flex-col rounded-card border border-line bg-white px-5 py-[18px]">
      <div className="flex flex-wrap items-center gap-2.5 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1.5 grid size-8 place-items-center rounded-full text-muted hover:bg-canvas lg:hidden"
          aria-label="Back to threads"
        >
          <ArrowLeftIcon />
        </button>
        <h2 className="text-[18px] font-bold">{thread.title}</h2>
        {thread.pinned && <Chip tone="brand">Pinned</Chip>}
        {direct && <Chip tone="pending">Direct</Chip>}
        <span className="flex-1" />
        <span className="text-[12.5px] text-faint">
          {direct ? `Only you and ${cls?.teacher ?? "your teacher"}` : `${(cls?.studentCount ?? 1) - 1} classmates`}
        </span>
      </div>
      <div className="h-px bg-line" />
      <div className="flex flex-1 flex-col gap-4 py-4">
        {thread.posts.map((p) => {
          const teacher = p.role === "teacher";
          return (
            <article key={p.id} className={cx("flex gap-3", teacher && "rounded-[14px] bg-brand-soft p-3.5")}>
              <Avatar name={p.author} size={34} me={p.mine} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-semibold">{p.mine ? "You" : p.author}</span>
                  {teacher && (
                    <Chip tone="teacher" size="sm">
                      Teacher
                    </Chip>
                  )}
                  <time dateTime={p.at} className="text-[11.5px] text-faint">
                    {timeAgo(p.at, now)}
                  </time>
                </div>
                <p className="mt-[5px] text-[13.5px] leading-5 whitespace-pre-line text-ink">{p.body}</p>
              </div>
            </article>
          );
        })}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-center gap-[11px]"
        onSubmit={(e) => {
          e.preventDefault();
          actions.postReply(thread.id, draft);
          setDraft("");
        }}
      >
        <Avatar name={state.student.fullName} me />
        <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line bg-white py-[7px] pr-2 pl-4 focus-within:ring-2 focus-within:ring-brand/20">
          <label htmlFor="reply" className="sr-only">
            Reply
          </label>
          <input
            id="reply"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={direct ? `Reply to ${cls?.teacher ?? "your teacher"}` : `Reply in ${cls?.name ?? "class"}`}
            autoComplete="off"
            maxLength={2000}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] placeholder:text-faint focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-full bg-brand px-5 py-[9px] text-[13px] font-semibold text-white transition hover:bg-brand-deep disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </form>
    </section>
  );
}

export function DiscussionsView() {
  const state = useAppState()!;
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const classFilter = classById(state, state.discussionClassId);

  const threads = useMemo(
    () =>
      sortThreads(state.threads).filter(
        (t) => (!classFilter || t.classId === classFilter.id) && matches(t, filter, query),
      ),
    [state.threads, classFilter, filter, query],
  );
  const selected =
    state.threads.find((t) => t.id === state.selectedThreadId && threads.includes(t)) ?? threads[0] ?? null;

  const open = (id: string) => {
    actions.openThread(id);
    setMobileThread(true);
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader
        title="Discussions"
        subtitle="Every thread from every class, newest first."
        actions={<Button onClick={() => setCreating(true)}>New thread</Button>}
      />

      <div className="flex flex-1 flex-col gap-5 lg:flex-row">
        <section
          aria-label="Threads"
          className={cx(
            "flex w-full flex-col gap-3 rounded-card border border-line bg-white px-3.5 py-4 lg:w-[352px] lg:shrink-0",
            mobileThread && "hidden lg:flex",
          )}
        >
          <label className="flex h-10 items-center gap-[9px] rounded-control bg-canvas px-3 text-faint focus-within:ring-2 focus-within:ring-brand/20">
            <SearchIcon />
            <span className="sr-only">Search threads</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search threads"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-faint focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-[7px]" role="radiogroup" aria-label="Filter threads">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cx(
                  "rounded-full text-[11.5px] font-semibold transition",
                  filter === f.value ? "bg-brand px-[11px] py-[5px] text-white" : "bg-canvas px-[9px] py-1 text-muted hover:text-ink",
                )}
              >
                {f.label}
              </button>
            ))}
            {classFilter && (
              <button
                type="button"
                onClick={() => actions.setDiscussionClass(null)}
                className="flex items-center gap-1 rounded-full bg-brand-tag px-[9px] py-1 text-[11.5px] font-semibold text-brand-tag-ink"
                aria-label={`Showing ${classFilter.name} only. Show all classes.`}
              >
                {classFilter.name}
                <CloseIcon width={10} height={10} />
              </button>
            )}
          </div>
          {threads.length === 0 ? (
            <EmptyState title="No threads" body="Try another filter, or start a new thread." />
          ) : (
            <ul className="flex flex-col gap-1">
              {threads.map((t) => {
                const active = selected?.id === t.id;
                const last = t.posts[t.posts.length - 1];
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => open(t.id)}
                      aria-current={active ? "true" : undefined}
                      className={cx(
                        "flex w-full flex-col gap-1.5 rounded-[12px] px-3 py-[11px] text-left transition",
                        active ? "bg-brand-soft" : "hover:bg-canvas",
                      )}
                    >
                      <span className="flex w-full items-center gap-[7px]">
                        <ClassChip cls={classById(state, t.classId)} onWhite={active} />
                        {t.visibility === "direct" && <Chip tone="pending">Direct</Chip>}
                        {t.unread > 0 && <span className="size-[7px] rounded-full bg-amber" aria-label="Unread" />}
                        <span className="flex-1" />
                        {last && <span className="text-[11px] text-faint">{timeAgoShort(last.at, now)}</span>}
                      </span>
                      <span className="text-[13.5px] font-semibold text-ink">{t.title}</span>
                      {last && (
                        <span className="line-clamp-2 text-[12.5px] text-muted">
                          {last.mine ? "You" : last.author}: {last.body}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className={cx("min-w-0 flex-1", !mobileThread && "hidden lg:flex", mobileThread && "flex")}>
          {selected ? (
            <ThreadView key={selected.id} state={state} thread={selected} onBack={() => setMobileThread(false)} />
          ) : (
            <div className="flex-1">
              <EmptyState title="Pick a thread" body="Choose a thread on the left to read it." />
            </div>
          )}
        </div>
      </div>

      <NewThreadModal
        open={creating}
        onClose={() => setCreating(false)}
        classes={state.classes}
        defaultClassId={classFilter?.id ?? null}
        onCreated={() => setMobileThread(true)}
      />
    </div>
  );
}
