"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "@/lib/client-hooks";
import type { Outcome } from "@/lib/game/battle";
import type { Item, Slot } from "@/lib/game/items";
import { REGIONS, regionOf, type Monster, type Region } from "@/lib/game/monsters";
import { heroStats, scrolls } from "@/lib/game/rules";
import { setMuted, sfx, useMuted } from "@/lib/game/sfx";
import { balance, earnedPoints, isStaff, pendingPoints } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import { BattleDialog } from "../game/battle";
import { pixelify, pressStart } from "../game/fonts";
import { GameIcon, PixelButton } from "../game/game-ui";
import { HallOfHeroes, TrophyCase } from "../game/hall";
import { HeroPanel } from "../game/hero-panel";
import { ItemGet } from "../game/item-get";
import { Blacksmith, type ShopTab } from "../game/shop";
import { WorldMap } from "../game/world-map";
import { cx } from "../ui";
import { StaffGloryView } from "./staff-glory";

// Road to Glory, a medieval pixel RPG. Homework handed in on time earns gold
// (points, once a teacher verifies the work) and quest scrolls; gold buys
// gear at the Blacksmith; scrolls pay for battles in the realm.

export function RoadToGloryView() {
  const state = useAppState()!;
  return isStaff(state) ? <StaffGloryView /> : <HeroGame />;
}

const STEPS: { icon: "scroll" | "coin" | "sword"; text: string }[] = [
  { icon: "scroll", text: "Hand in homework on time: earn gold and a quest scroll" },
  { icon: "coin", text: "Spend gold on gear at the Blacksmith" },
  { icon: "sword", text: "Spend scrolls fighting monsters in the realm" },
];

function HeroGame() {
  const state = useAppState()!;
  const xp = earnedPoints(state);
  const gold = balance(state);
  const pending = pendingPoints(state);
  const stats = useMemo(() => heroStats(xp, state.hero), [xp, state.hero]);
  const scrollsLeft = scrolls(state);
  const wins = useMemo(() => {
    const out: Record<string, number> = {};
    for (const b of state.hero.battles) if (b.won) out[b.monster] = (out[b.monster] ?? 0) + 1;
    return out;
  }, [state.hero.battles]);

  const [region, setRegion] = useState<Region>(() => [...REGIONS].reverse().find((r) => stats.level >= r.level) ?? REGIONS[0]);
  const [fight, setFight] = useState<Monster | null>(null);
  const [firstWin, setFirstWin] = useState(false);
  const [got, setGot] = useState<Item | null>(null);
  const [tab, setTab] = useState<ShopTab>("weapon");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const muted = useMuted();
  const shopRef = useRef<HTMLDivElement>(null);
  const name = state.student.firstName;

  const openSlot = (slot: Slot, item: Item | undefined) => {
    sfx.select();
    setTab(slot);
    setSelectedKey(item?.key ?? null);
    shopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startFight = (monster: Monster) => {
    if (scrollsLeft <= 0) {
      sfx.error();
      toast("No quest scrolls left. Hand in homework on time to earn more.");
      return;
    }
    setFirstWin(!wins[monster.key]);
    setFight(monster);
  };

  const finishFight = (outcome: Outcome) => {
    const monster = fight;
    setFight(null);
    if (monster) actions.recordBattle(monster.key, outcome === "won");
  };

  return (
    <div
      className={cx(
        pressStart.variable,
        pixelify.variable,
        "font-game flex flex-col gap-5 bg-game-bg p-4 text-game-ink shadow-[0_0_0_3px_#0d0a18] sm:p-6",
      )}
    >
      <header className="relative flex flex-wrap items-end gap-x-6 gap-y-4 overflow-hidden">
        {/* A few stars over the title. */}
        {[
          [4, 10],
          [22, 4],
          [41, 14],
          [63, 6],
          [78, 16],
          [92, 3],
        ].map(([left, top], i) => (
          <span
            key={i}
            className="absolute size-[3px] bg-white motion-safe:animate-[game-twinkle_1.6s_steps(2)_infinite]"
            style={{ left: `${left}%`, top, animationDelay: `${i * 0.27}s` }}
            aria-hidden="true"
          />
        ))}
        <div className="min-w-[min(100%,280px)] flex-1">
          <h1 className="font-pixel text-[22px] leading-9 text-game-gold [text-shadow:3px_3px_0_#a86b00,6px_6px_0_#0d0a18] sm:text-[28px]">
            Road to Glory
          </h1>
          <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[15px] leading-5">
            {STEPS.map((s, i) => (
              <li key={s.text} className="flex items-center gap-2">
                <span className="font-pixel text-[9px] text-game-gold">{i + 1}</span>
                <GameIcon kind={s.icon} />
                {s.text}
              </li>
            ))}
          </ol>
          <p className="mt-1.5 text-[13.5px] text-game-muted">Gold arrives when your teacher verifies the work. Late work earns half.</p>
        </div>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <span className="pixel-panel flex items-center gap-1.5 px-2.5 py-2 font-pixel text-[8px] text-game-gold" title="Gold waiting for your teacher to verify your work">
              <GameIcon kind="coin" scale={1.5} />+{pending} waiting
            </span>
          )}
          <PixelButton
            tone="stone"
            size="sm"
            aria-pressed={!muted}
            onClick={() => {
              setMuted(!muted);
              if (muted) sfx.select();
            }}
          >
            {muted ? "Sound off" : "Sound on"}
          </PixelButton>
        </div>
      </header>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <HeroPanel name={name} stats={stats} gold={gold} scrolls={scrollsLeft} onSlot={openSlot} />
        <WorldMap level={stats.level} hero={stats} selected={region} onSelect={setRegion} onFight={startFight} scrolls={scrollsLeft} wins={wins} />
      </div>

      <div ref={shopRef} className="flex scroll-mt-24 flex-col gap-5 lg:flex-row lg:items-start">
        <Blacksmith
          state={state}
          xp={xp}
          stats={stats}
          gold={gold}
          tab={tab}
          onTab={(t) => {
            setTab(t);
            setSelectedKey(null);
          }}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onBought={setGot}
        />
        <div className="flex flex-col gap-5 lg:w-[360px] lg:shrink-0">
          <HallOfHeroes state={state} />
          <TrophyCase wins={wins} />
        </div>
      </div>

      <BattleDialog
        monster={fight}
        stats={stats}
        region={(fight && regionOf(fight.key)?.key) || region.key}
        firstWin={firstWin}
        onDone={finishFight}
      />
      <ItemGet item={got} stats={stats} onClose={() => setGot(null)} />
    </div>
  );
}
