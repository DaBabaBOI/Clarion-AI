import type { Metadata } from "next";
import { Suspense } from "react";
import { ClassDetailView } from "@/components/classes/class-detail-view";
import { PageSkeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Class" };

async function ClassDetail({ params }: { params: PageProps<"/classes/[classId]">["params"] }) {
  const { classId } = await params;
  return <ClassDetailView classId={classId} />;
}

export default function ClassPage({ params }: PageProps<"/classes/[classId]">) {
  // The class id is request data, so it streams in behind a skeleton.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClassDetail params={params} />
    </Suspense>
  );
}
