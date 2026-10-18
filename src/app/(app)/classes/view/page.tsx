import type { Metadata } from "next";
import { Suspense } from "react";
import { ClassDetailFromUrl } from "@/components/classes/class-detail-view";
import { PageSkeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Class" };

export default function ClassPage() {
  // The class id is in ?id=, which only the browser knows, so it streams in behind a skeleton.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClassDetailFromUrl />
    </Suspense>
  );
}
