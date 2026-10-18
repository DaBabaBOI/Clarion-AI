import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskFromUrl } from "@/components/tasks/task-view";
import { PageSkeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Task" };

export default function TaskPage() {
  // The task id is in ?id=, which only the browser knows, so it streams in behind a skeleton.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TaskFromUrl />
    </Suspense>
  );
}
