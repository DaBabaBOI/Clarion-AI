import type { ComponentType, SVGProps } from "react";
import { ClassesIcon, DashboardIcon, DiscussionsIcon, SparkleIcon, StarIcon } from "../icons";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// Order follows the Figma sidebar: My classes sits under Dashboard because it
// is the second most used destination.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/classes", label: "My classes", icon: ClassesIcon },
  { href: "/ai", label: "AI Helper", icon: SparkleIcon },
  { href: "/discussions", label: "Discussions", icon: DiscussionsIcon },
  { href: "/road-to-glory", label: "Road to Glory", icon: StarIcon },
];
