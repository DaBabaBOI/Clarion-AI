import type { Metadata } from "next";
import { ClassesView } from "@/components/classes/classes-view";

export const metadata: Metadata = { title: "My classes" };

export default function ClassesPage() {
  return <ClassesView />;
}
