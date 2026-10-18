"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { initStore, useAppState, useStoreStatus } from "@/lib/store";
import { Button, PageSkeleton } from "../ui";
import { Sidebar } from "./sidebar";
import { Splash } from "./splash";
import { Toaster } from "./toaster";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  const state = useAppState();
  const { status, error } = useStoreStatus();
  const router = useRouter();

  // Load the signed-in user's data (or the demo), and send everyone else to sign in.
  useEffect(() => {
    if (status !== "idle") return;
    void initStore();
  }, [status]);

  useEffect(() => {
    if (status === "signed-out") router.replace("/sign-in");
  }, [status, router]);

  return (
    <>
      <Splash />
      <TopBar />
      <div className="flex">
        <Sidebar />
        <main id="content" className="flex min-h-[calc(var(--screen)-4rem)] min-w-0 flex-1 flex-col px-4 py-6 sm:px-[30px] sm:py-[26px]">
          {state ? (
            children
          ) : status === "error" ? (
            <div className="m-auto flex max-w-sm flex-col items-center gap-3 text-center">
              <h1 className="text-[18px] font-bold">Clarion could not load</h1>
              <p className="text-[13px] leading-5 text-muted">{error || "Check your internet connection and try again."}</p>
              <Button onClick={() => void initStore()}>Try again</Button>
            </div>
          ) : (
            <PageSkeleton />
          )}
        </main>
      </div>
      <Toaster />
    </>
  );
}
