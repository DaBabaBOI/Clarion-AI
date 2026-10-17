import type { Metadata } from "next";
import { RoadToGloryView } from "@/components/glory/road-to-glory-view";

export const metadata: Metadata = { title: "Road to Glory" };

export default function RoadToGloryPage() {
  return <RoadToGloryView />;
}
