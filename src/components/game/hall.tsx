"use client";

import { useState } from "react";
import { MONSTERS } from "@/lib/game/monsters";
import { levelFor } from "@/lib/game/rules";
import { monsterSprite } from "@/lib/game/sprites";
import { classBoard, schoolBoard } from "@/lib/selectors";
import { actions } from "@/lib/store";
import type { AppState } from "@/lib/types";
import { Switch, cx } from "../ui";
import { GameIcon, GamePanel } from "./game-ui";
import { PixelArt } from "./pixel-art";

const MEDAL = ["#ffd23f", "#c9d3dd", "#cd7e41"];

/** The leaderboard, as a hall of heroes with their levels. */
export function HallOfHeroes({ state }: { state: AppState }) {
  const [scope, setScope] = useState<"class" | "school">("class");
  const rows = scope === "class" ? classBoard(state) : schoolBoard(state);
  const me = rows.find((r) => r.me);
  const top = rows.slice(0, 5);
  const hidden = !state.showOnLeaderboard;
  const shown = me && me.rank > top.length ? [...top, me] : top;

  return (
    <GamePanel
      title="Hall of Heroes"
      right={
        <div className="flex gap-1">
          {(["class", "school"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => setScope(s)}
              className={cx("px-2 py-1 font-pixel text-[7px] uppercase", scope === s ? "bg-game-gold text-[#2b1a00]" : "bg-game-panel-2 text-game-muted")}
            >
              {s === "class" ? "Classmates" : "School"}
            </button>
          ))}
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="text-[15px] text-game-muted">No heroes yet. Points appear once work is verified.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {shown.map((r) => {
            const name = r.me ? (hidden ? "You (hidden)" : "You") : scope === "school" ? `Hero of ${r.group}` : r.name;
            return (
              <li key={r.id} className={cx("flex items-center gap-2.5 px-2 py-1.5", r.me ? "bg-game-panel-2" : "")}>
                <span className="w-6 text-center font-pixel text-[10px]" style={{ color: MEDAL[r.rank - 1] ?? "var(--color-game-muted)" }}>
                  {r.rank}
                </span>
                <span className={cx("min-w-0 flex-1 truncate text-[16px]", r.me && "text-game-gold")}>{name}</span>
                <span className="font-pixel text-[8px] text-game-muted">LV {levelFor(r.points)}</span>
                <span className="w-12 text-right font-pixel text-[9px]">{r.points}</span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-[13px] leading-4 text-game-muted">Ranked by XP from homework. Spending gold never drops you.</p>
      <div className="flex items-center gap-3 border-t-2 border-game-panel-2 pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px]">Show my name</p>
          <p className="text-[13px] text-game-muted">{hidden ? "Classmates see “Hidden student”." : "Classmates can see your name and XP."}</p>
        </div>
        <Switch checked={!hidden} onChange={(v) => actions.setLeaderboardVisibility(v)} label="Show my name on the leaderboard" />
      </div>
    </GamePanel>
  );
}

/** Every monster in the realm: a silhouette until beaten, then a trophy and a title. */
export function TrophyCase({ wins }: { wins: Record<string, number> }) {
  const titles = MONSTERS.filter((m) => wins[m.key]).map((m) => m.title);
  return (
    <GamePanel title="Trophies" right={<span className="font-pixel text-[8px] text-game-muted">{titles.length}/{MONSTERS.length}</span>}>
      <ul className="grid grid-cols-3 gap-2">
        {MONSTERS.map((m) => {
          const n = wins[m.key] ?? 0;
          return (
            <li key={m.key} className="pixel-inset flex flex-col items-center gap-1 p-1.5" title={n ? `${m.name}: beaten ${n}×` : "Not beaten yet"}>
              <span className={cx(!n && "brightness-0 opacity-40")}>
                <PixelArt grid={monsterSprite(m.sprite, m.palette)} scale={m.sprite === "dragon" ? 1.3 : 1.7} title={n ? m.name : "Unknown monster"} />
              </span>
              <span className="text-center font-pixel text-[6px] leading-3 text-game-muted">{n ? `${m.name} ×${n}` : "???"}</span>
            </li>
          );
        })}
      </ul>
      {titles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {titles.map((t) => (
            <span key={t} className="flex items-center gap-1 bg-game-panel-2 px-2 py-1 text-[13px]">
              <GameIcon kind="star" scale={1} /> {t}
            </span>
          ))}
        </div>
      )}
    </GamePanel>
  );
}
