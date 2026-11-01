"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { act, startBattle, type Action, type BattleState, type LogLine, type Outcome } from "@/lib/game/battle";
import type { Monster } from "@/lib/game/monsters";
import type { HeroStats } from "@/lib/game/rules";
import { sfx } from "@/lib/game/sfx";
import { heroSprite, monsterSprite } from "@/lib/game/sprites";
import { cx } from "../ui";
import { GameDialog, GameIcon, PixelButton, StatBar } from "./game-ui";
import { PixelArt } from "./pixel-art";

/** Sky and ground for each region's arena. */
const ARENA: Record<string, { sky: string; ground: string; edge: string }> = {
  greenvale: { sky: "#7ec8ff", ground: "#5aa83a", edge: "#4c9631" },
  "whispering-woods": { sky: "#2f5d3a", ground: "#2f7a3a", edge: "#1f5c2a" },
  "crystal-caves": { sky: "#2a2238", ground: "#4a4a5e", edge: "#6b6b7e" },
  "ruined-keep": { sky: "#3a2f4d", ground: "#6b6b7e", edge: "#4a4a5e" },
  "dragons-peak": { sky: "#5a1e1e", ground: "#3a2f3a", edge: "#ff6a00" },
};

const DAMAGE: LogLine["kind"][] = ["hit", "crit", "breath", "burn"];

interface Popup {
  id: number;
  target: "hero" | "foe";
  text: string;
  color: string;
}

function Fight({
  monster,
  stats,
  region,
  firstWin,
  onDone,
}: {
  monster: Monster;
  stats: HeroStats;
  region: string;
  firstWin: boolean;
  onDone: (outcome: Outcome) => void;
}) {
  const [battle, setBattle] = useState<BattleState>(() => startBattle(stats, monster, Math.random));
  const [shown, setShown] = useState(0);
  const [shownHp, setHp] = useState({ hero: stats.maxHp, foe: monster.hp });
  const [anim, setAnim] = useState<{ hero: string; foe: string; screen: boolean; n: number }>({ hero: "", foe: "", screen: false, n: 0 });
  const [popups, setPopups] = useState<Popup[]>([]);
  const busy = shown < battle.log.length;
  const over = Boolean(battle.outcome) && !busy;
  const lastRoll = [...battle.log.slice(0, shown)].reverse().find((l) => l.roll)?.roll;
  // Bars follow the lines as they appear, and settle on the true values at the end.
  const hp = over ? { hero: battle.heroHp, foe: battle.foeHp } : shownHp;

  // Reveal the log one line at a time, playing each line's effect.
  useEffect(() => {
    if (!busy) return;
    const line = battle.log[shown];
    const timer = setTimeout(
      () => {
        const amount = line.amount ?? 0;
        if (line.target && amount) {
          const heal = line.kind === "heal";
          const revive = heal && line.text.includes("rise again");
          setHp((h) => {
            const key = line.target!;
            const max = key === "hero" ? stats.maxHp : monster.hp;
            const next = revive ? amount : heal ? h[key] + amount : DAMAGE.includes(line.kind) ? h[key] - amount : h[key];
            return { ...h, [key]: Math.max(0, Math.min(max, next)) };
          });
          setPopups((p) => [
            ...p.slice(-3),
            {
              id: line.id,
              target: line.target!,
              text: heal ? `+${amount}` : `-${amount}`,
              color: heal ? "#6ee07a" : line.kind === "crit" ? "#ffd23f" : "#ffffff",
            },
          ]);
        }
        const heroActs = line.who === "hero" && line.kind !== "heal" && line.kind !== "burn";
        const foeActs = line.who === "foe";
        setAnim((a) => ({
          n: a.n + 1,
          hero: heroActs && line.roll ? "lunge" : line.target === "hero" && DAMAGE.includes(line.kind) ? "hit" : "",
          foe: foeActs && (line.roll || line.kind === "breath") ? "lunge" : line.target === "foe" && DAMAGE.includes(line.kind) ? "hit" : "",
          screen: line.kind === "crit" || line.kind === "breath",
        }));
        if (line.kind === "crit") sfx.crit();
        else if (line.kind === "hit" || line.kind === "breath") (line.target === "hero" ? sfx.hurt : sfx.hit)();
        else if (line.kind === "miss") sfx.miss();
        else if (line.kind === "heal") sfx.heal();
        else if (line.kind === "block") sfx.equip();
        else if (line.kind === "burn") sfx.hurt();
        setShown((n) => n + 1);
      },
      shown === 0 ? 200 : 560,
    );
    return () => clearTimeout(timer);
  }, [busy, shown, battle.log, monster.hp, stats.maxHp]);

  // The fanfare once the last line is shown.
  useEffect(() => {
    if (!over) return;
    if (battle.outcome === "won") sfx.victory();
    if (battle.outcome === "lost") sfx.defeat();
  }, [over, battle.outcome]);

  const choose = useCallback(
    (action: Action) => {
      if (busy || battle.outcome) return;
      if (action === "potion" && battle.potions <= 0) {
        sfx.error();
        return;
      }
      sfx.select();
      setBattle((b) => act(b, action, Math.random));
    },
    [busy, battle.outcome, battle.potions],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Action> = { "1": "attack", "2": "defend", "3": "potion", "4": "flee" };
      if (map[e.key]) choose(map[e.key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose]);

  const scene = ARENA[region] ?? ARENA.greenvale;
  const lines = battle.log.slice(Math.max(0, shown - 3), shown);
  const animClass = (kind: string, flip: boolean) =>
    kind === "lunge"
      ? flip
        ? "motion-safe:animate-[game-lunge-back_0.35s_steps(3)]"
        : "motion-safe:animate-[game-lunge_0.35s_steps(3)]"
      : kind === "hit"
        ? "motion-safe:animate-[game-flash_0.35s_steps(2),game-shake_0.35s_steps(4)]"
        : "";

  return (
    <div className="flex flex-col gap-3">
      <div
        key={anim.screen ? anim.n : "still"}
        className={cx("pixel-inset relative h-[300px] overflow-hidden", anim.screen && "motion-safe:animate-[game-shake_0.3s_steps(4)]")}
        style={{ background: scene.sky }}
      >
        <div className="absolute inset-x-0 bottom-0 h-[42%]" style={{ background: scene.ground }} />
        <div className="absolute inset-x-0 bottom-[42%] h-[4px]" style={{ background: scene.edge }} />
        {/* Battle platforms, like the classic handheld games. */}
        <div className="absolute right-[12%] bottom-[46%] h-4 w-[34%] rounded-[50%] bg-black/20" />
        <div className="absolute bottom-[8%] left-[6%] h-4 w-[34%] rounded-[50%] bg-black/25" />

        <div className="absolute top-3 left-3 w-[46%] max-w-[260px]">
          <div className="pixel-panel p-2">
            <p className="font-pixel text-[9px] leading-4">{monster.name}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="font-pixel text-[7px] text-game-gold">HP</span>
              <StatBar value={hp.foe} max={monster.hp} color={hp.foe / monster.hp > 0.5 ? "#6ee07a" : hp.foe / monster.hp > 0.2 ? "#ffd23f" : "#e8433a"} label={`${monster.name} health`} className="flex-1" />
            </div>
          </div>
        </div>
        <div
          key={`foe-${anim.n}`}
          className={cx("absolute right-[16%] bottom-[44%]", animClass(anim.foe, true), over && battle.outcome === "won" && "opacity-0 transition-opacity duration-700")}
        >
          <PixelArt grid={monsterSprite(monster.sprite, monster.palette)} scale={monster.sprite === "dragon" ? 5 : 6} title={monster.name} />
        </div>

        <div key={`hero-${anim.n}`} className={cx("absolute bottom-[10%] left-[14%]", animClass(anim.hero, false))}>
          <PixelArt grid={heroSprite(stats.items)} scale={5} title="You" />
        </div>
        <div className="absolute right-3 bottom-3 w-[46%] max-w-[260px]">
          <div className="pixel-panel p-2">
            <div className="flex items-center gap-2">
              <p className="flex-1 font-pixel text-[9px] leading-4">You · Lv {stats.level}</p>
              <span className="flex items-center gap-1 font-pixel text-[8px]" title="Potions left">
                <GameIcon kind="potion" scale={1.5} />
                {battle.potions}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="font-pixel text-[7px] text-game-gold">HP</span>
              <StatBar value={hp.hero} max={stats.maxHp} color={hp.hero / stats.maxHp > 0.5 ? "#6ee07a" : hp.hero / stats.maxHp > 0.2 ? "#ffd23f" : "#e8433a"} label="Your health" className="flex-1" />
            </div>
            <p className="mt-1 text-right font-pixel text-[8px]">
              {hp.hero}/{stats.maxHp}
            </p>
          </div>
        </div>

        {popups.map((p) => (
          <span
            key={p.id}
            className="pointer-events-none absolute font-pixel text-[16px] [text-shadow:2px_2px_0_#0d0a18] motion-safe:animate-[game-float_0.9s_ease-out_forwards]"
            style={{
              color: p.color,
              left: p.target === "foe" ? "70%" : "26%",
              top: p.target === "foe" ? "18%" : "48%",
            }}
            aria-hidden="true"
          >
            {p.text}
          </span>
        ))}

        {lastRoll && (
          <div className="pixel-panel absolute top-3 right-3 flex flex-col items-center px-2 py-1.5" aria-label={`Last roll ${lastRoll}`}>
            <span className="font-pixel text-[6px] text-game-muted">D20</span>
            <span className={cx("font-pixel text-[14px]", lastRoll === 20 ? "text-game-gold" : lastRoll === 1 ? "text-game-bad" : "")}>{lastRoll}</span>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 grid place-items-center bg-[#0d0a18]/70">
            <div className="flex flex-col items-center gap-3 text-center motion-safe:animate-[game-rise_0.4s_steps(4)]">
              <p
                className={cx(
                  "font-pixel text-[26px] [text-shadow:3px_3px_0_#0d0a18]",
                  battle.outcome === "won" ? "text-game-gold" : battle.outcome === "lost" ? "text-game-bad" : "text-game-ink",
                )}
              >
                {battle.outcome === "won" ? "VICTORY!" : battle.outcome === "lost" ? "DEFEATED" : "ESCAPED"}
              </p>
              {battle.outcome === "won" && firstWin && (
                <p className="flex items-center gap-2 font-pixel text-[10px] text-game-ink">
                  <GameIcon kind="star" scale={2} /> New title: {monster.title}
                </p>
              )}
              {battle.outcome === "lost" && <p className="max-w-[320px] text-[16px] leading-6">Better gear from the Blacksmith, or a few more levels, will turn this around.</p>}
              <PixelButton onClick={() => onDone(battle.outcome!)}>Return to the realm</PixelButton>
            </div>
          </div>
        )}
      </div>

      <div className="pixel-inset relative min-h-[84px] px-3.5 py-2.5 text-[17px] leading-6" aria-live="polite">
        {lines.map((l) => (
          <p key={l.id} className={cx(l.who === "foe" && "text-[#ffb3b3]", l.kind === "heal" && "text-game-good", l.kind === "crit" && "text-game-gold")}>
            {l.text}
          </p>
        ))}
        {busy && <span className="absolute right-3 bottom-2 font-pixel text-[9px] text-game-gold motion-safe:animate-[game-blink_0.6s_steps(1)_infinite]">▼</span>}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <PixelButton tone="red" disabled={busy || Boolean(battle.outcome)} onClick={() => choose("attack")} aria-keyshortcuts="1">
          1 Attack
        </PixelButton>
        <PixelButton tone="blue" disabled={busy || Boolean(battle.outcome)} onClick={() => choose("defend")} aria-keyshortcuts="2">
          2 Defend
        </PixelButton>
        <PixelButton tone="green" disabled={busy || Boolean(battle.outcome) || battle.potions <= 0} onClick={() => choose("potion")} aria-keyshortcuts="3">
          3 Potion ×{battle.potions}
        </PixelButton>
        <PixelButton tone="stone" disabled={busy || Boolean(battle.outcome)} onClick={() => choose("flee")} aria-keyshortcuts="4">
          4 Flee
        </PixelButton>
      </div>
      <p className="text-center text-[13px] text-game-muted">
        Roll a d20 + {stats.toHit} to hit (AC {monster.ac}). Defend adds +{stats.defend} AC until the {monster.name}&apos;s next attack.
      </p>
    </div>
  );
}

/** The battle screen. Closing it mid-fight counts as running away. */
export function BattleDialog({
  monster,
  stats,
  region,
  firstWin,
  onDone,
}: {
  monster: Monster | null;
  stats: HeroStats;
  region: string;
  firstWin: boolean;
  onDone: (outcome: Outcome) => void;
}) {
  // Each battle is reported once: either from its result screen, or as
  // running away when the dialog is closed early.
  const reported = useRef(false);
  useEffect(() => {
    if (monster) reported.current = false;
  }, [monster]);
  const finish = (outcome: Outcome) => {
    if (reported.current) return;
    reported.current = true;
    onDone(outcome);
  };

  return (
    <GameDialog open={monster !== null} onClose={() => finish("fled")} label={monster ? `Battle: ${monster.name}` : "Battle"} width={720}>
      {monster && <Fight monster={monster} stats={stats} region={region} firstWin={firstWin} onDone={finish} />}
    </GameDialog>
  );
}
