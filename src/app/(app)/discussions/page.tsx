import type { Metadata } from "next";
import { DiscussionsView } from "@/components/discussions/discussions-view";

export const metadata: Metadata = { title: "Discussions" };

export default function DiscussionsPage() {
  return <DiscussionsView />;
}
