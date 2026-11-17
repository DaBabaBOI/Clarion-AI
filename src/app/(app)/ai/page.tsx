import type { Metadata } from "next";
import { Suspense } from "react";
import { StudyHelperView } from "@/components/ai/study-helper-view";
import { PageSkeleton } from "@/components/ui";

export const metadata: Metadata = { title: "AI Helper" };

export default function AiHelperPage() {
  // ?preset= (from "Generate a deck" on a class page) is only known in the browser.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StudyHelperView />
    </Suspense>
  );
}
