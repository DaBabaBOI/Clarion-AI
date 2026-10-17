"use client";

import type { ReactNode } from "react";
import { useAppState } from "@/lib/store";
import { PageSkeleton } from "../ui";
import { Sidebar } from "./sidebar";
import { Splash } from "./splash";
import { Toaster } from "./toaster";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  const state = useAppState();
  return (
    <>
      <Splash />
      <TopBar />
      <div className="flex">
        <Sidebar />
        <main id="content" className="flex min-h-[calc(100dvh-4rem)] min-w-0 flex-1 flex-col px-4 py-6 sm:px-[30px] sm:py-[26px]">
          {state ? children : <PageSkeleton />}
        </main>
      </div>
      <Toaster />
    </>
  );
}
