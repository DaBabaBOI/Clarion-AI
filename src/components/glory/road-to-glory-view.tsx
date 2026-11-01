"use client";

import { isStaff } from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { GameApp } from "../game/game-app";
import { StaffGloryView } from "./staff-glory";

// Students get Road to Glory as its own full-screen game (the app shell steps
// aside on this route, see components/shell/app-shell.tsx). Teachers and
// coordinators keep a normal page about their classes.

export function RoadToGloryView() {
  const state = useAppState()!;
  return isStaff(state) ? <StaffGloryView /> : <GameApp />;
}
