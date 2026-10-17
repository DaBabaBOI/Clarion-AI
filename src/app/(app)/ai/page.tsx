import type { Metadata } from "next";
import { StudyHelperView } from "@/components/ai/study-helper-view";

export const metadata: Metadata = { title: "AI Helper" };

export default function AiHelperPage() {
  return <StudyHelperView />;
}
