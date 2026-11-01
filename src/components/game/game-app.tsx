"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast, useNow } from "@/lib/client-hooks";
import { timeAgo } from "@/lib/dates";
import type { Outcome } from "@/lib/game/battle";
import type { Item, Slot } from "@/lib/game/items";
import { REGIONS, monsterByKey, regionOf, type Monster, type Region } from "@/lib/game/monsters";
import { heroStats, scrolls, type HeroStats } from "@/lib/game/rules";
import { setMuted, sfx, useMuted } from "@/lib/game/sfx";
import { heroSprite, monsterSprite } from "@/lib/game/sprites";
import { balance, earnedPoints, pendingPoints } from "@/lib/selectors";
import { actions, useAppState } from "@/lib/store";
import type { HeroState } from "@/lib/types";
import { cx } from "../ui";
import { BattleDialog } from "./battle";
import { pixelify, pressStart } from "./fonts";
import { GameDialog, GameIcon, GamePanel, Gold, PixelButton } from "./game-ui";
import { HallOfHeroes, TrophyCase } from "./hall";
import { HeroPanel } from "./hero-panel";
import { ItemGet } from "./item-get";
import { PixelArt } from "./pixel-art";
import { Blacksmith, type ShopTab } from "./shop";
import { WorldMap } from "./world-map";

// Road to Glory as its own full-screen game: no Clarion sidebar or top bar,
// a title screen on the way in, a HUD, and game screens picked from a menu.

type Screen = "realm" | "blacksmith" | "hall";

const SCREENS: {
  value: Screen;
  label: string;
  icon: "star" | "coin" | "shield";
}[] = [
  { value: "realm", label: "Realm", icon: "star" },
  { value: "blacksmith", label: "Blacksmith", icon: "coin" },
  { value: "hall", label: "Hall of Heroes", icon: "shield" },
];

const STEPS: {
  icon: "scroll" | "coin" | "sword";
  title: string;
  text: string;
}[] = [
  {
    icon: "scroll",
    title: "Do your homework",
    text: "Hand work in on time. Once your teacher verifies it, its points become gold and XP, and each on-time hand-in gives you a quest scroll. Late work earns half.",
  },
  {
    icon: "coin",
    title: "Gear up",
    text: "Spend gold at the Blacksmith. Better weapons and armour unlock as you level up. What you equip shows on your hero.",
  },
  {
    icon: "sword",
    title: "Fight",
    text: "Each battle in the realm costs a scroll. Roll a d20 to hit, your weapon's dice for damage. Your first win against a monster earns its title.",
  },
];

/** The title screen, on the way in. Click or press a key to skip. */
function TitleScreen({ items, onDone }: { items: HeroStats["items"]; onDone: () => void }) {
  useEffect(() => {
    sfx.fanfare();
    const timer = setTimeout(onDone, 1900);
    const skip = () => onDone();
    window.addEventListener("keydown", skip);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", skip);
    };
  }, [onDone]);

  return (
    <button
      type="button"
      onClick={onDone}
      aria-label="Enter Road to Glory"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-game-edge text-game-ink motion-safe:animate-[game-rise_0.3s_steps(3)]"
    >
      {[
        [8, 12],
        [20, 70],
        [34, 22],
        [52, 82],
        [66, 14],
        [78, 60],
        [90, 30],
      ].map(([left, top], i) => (
        <span
          key={i}
          className="absolute size-[4px] bg-white motion-safe:animate-[game-twinkle_1.2s_steps(2)_infinite]"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            animationDelay: `${i * 0.2}s`,
          }}
          aria-hidden="true"
        />
      ))}
      <div className="motion-safe:animate-[game-bob_1s_steps(2)_infinite]">
        <PixelArt grid={heroSprite(items)} scale={6} />
      </div>
      <p className="text-center font-pixel text-[28px] leading-[44px] text-game-gold [text-shadow:4px_4px_0_#a86b00,8px_8px_0_#000] sm:text-[44px] sm:leading-[64px]">
        Road to Glory
      </p>
      <div className="pixel-inset h-4 w-[260px] overflow-hidden">
        <div className="h-full w-0 bg-game-gold motion-safe:animate-[game-load_1.8s_steps(12)_forwards] motion-reduce:w-full" />
      </div>
      <p className="font-pixel text-[10px] text-game-muted motion-safe:animate-[game-blink_0.8s_steps(1)_infinite]">Press any key</p>
    </button>
  );
}

function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <GameDialog open={open} onClose={onClose} label="How to play" width={560}>
      <div className="flex flex-col gap-4">
        <h2 className="font-pixel text-[13px] text-game-gold">How to play</h2>
        <ol className="flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="pixel-inset flex gap-3 p-3">
              <GameIcon kind={s.icon} scale={4} />
              <div>
                <p className="font-pixel text-[10px] leading-5">
                  {i + 1}. {s.title}
                </p>
                <p className="text-[16px] leading-6">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-[15px] text-game-muted">Your rank in the Hall of Heroes uses XP, so spending gold never drops you.</p>
        <div className="flex justify-end">
          <PixelButton onClick={onClose}>Got it</PixelButton>
        </div>
      </div>
    </GameDialog>
  );
}

/** Recent battles, newest first. */
function AdventureLog({ hero }: { hero: HeroState }) {
  const now = useNow();
  const recent = [...hero.battles].reverse().slice(0, 6);
  return (
    <GamePanel title="Adventure log">
      {recent.length === 0 ? (
        <p className="text-[15px] text-game-muted">No battles yet. Pick a monster in the realm.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {recent.map((b) => {
            const m = monsterByKey(b.monster);
            return (
              <li key={b.id} className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center">
                  {m && <PixelArt grid={monsterSprite(m.sprite, m.palette)} scale={m.sprite === "dragon" ? 1 : 1.4} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[16px]">{m?.name ?? b.monster}</span>
                <span className={cx("font-pixel text-[8px]", b.won ? "text-game-good" : "text-game-bad")}>{b.won ? "WON" : "LOST"}</span>
                <span className="w-16 text-right text-[13px] text-game-muted">{timeAgo(b.at, now)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </GamePanel>
  );
}

function GameMenu({ screen, onGo, className }: { screen: Screen; onGo: (s: Screen) => void; className: string }) {
  return (
    <nav aria-label="Game" className={className}>
      {SCREENS.map((s) => (
        <button
          key={s.value}
          type="button"
          aria-current={screen === s.value ? "page" : undefined}
          onClick={() => onGo(s.value)}
          className={cx(
            "flex flex-1 flex-col items-center gap-1 px-3 py-2.5 font-pixel text-[8px] uppercase md:flex-none md:flex-row md:gap-2 md:px-5 md:text-[10px]",
            screen === s.value ? "bg-game-gold text-[#2b1a00]" : "text-game-muted hover:text-game-ink md:bg-game-panel",
          )}
        >
          <GameIcon kind={s.icon} scale={2} />
          {s.label}
        </button>
      ))}
    </nav>
  );
}

export function GameApp() {
  const state = useAppState()!;
  const router = useRouter();
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

  const [intro, setIntro] = useState(true);
  const endIntro = useCallback(() => setIntro(false), []);
  const [screen, setScreen] = useState<Screen>("realm");
  const [help, setHelp] = useState(false);
  const [region, setRegion] = useState<Region>(() => [...REGIONS].reverse().find((r) => stats.level >= r.level) ?? REGIONS[0]);
  const [fight, setFight] = useState<Monster | null>(null);
  const [firstWin, setFirstWin] = useState(false);
  const [got, setGot] = useState<Item | null>(null);
  const [tab, setTab] = useState<ShopTab>("weapon");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const muted = useMuted();

  // The game draws at full size (the rest of Clarion is zoomed out to fit).
  useEffect(() => {
    document.documentElement.classList.add("game-mode");
    return () => document.documentElement.classList.remove("game-mode");
  }, []);

  const go = (next: Screen) => {
    if (next !== screen) sfx.select();
    setScreen(next);
    window.scrollTo({ top: 0 });
  };

  const openSlot = (slot: Slot, item: Item | undefined) => {
    setTab(slot);
    setSelectedKey(item?.key ?? null);
    go("blacksmith");
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

  // On phones the map or shop comes first and the hero follows; side by side on big screens.
  const hero = (
    <div className="order-2 lg:order-none lg:shrink-0">
      <HeroPanel name={state.student.firstName} stats={stats} gold={gold} scrolls={scrollsLeft} onSlot={openSlot} />
    </div>
  );

  return (
    <div className={cx(pressStart.variable, pixelify.variable, "font-game flex min-h-(--screen) flex-col bg-game-bg text-game-ink")}>
      {intro && <TitleScreen items={stats.items} onDone={endIntro} />}

      <div className="sticky top-0 z-30">
        {/* The HUD */}
        <header className="flex items-center gap-3 border-b-[3px] border-game-edge bg-game-panel px-3 py-2.5 sm:gap-4 sm:px-5">
          <PixelButton
            tone="stone"
            size="sm"
            onClick={() => {
              sfx.select();
              router.push("/dashboard");
            }}
            aria-label="Exit to Clarion"
          >
            ◀ <span className="hidden sm:inline">Exit to Clarion</span>
          </PixelButton>
          <h1 className="sr-only font-pixel text-[14px] text-game-gold [text-shadow:2px_2px_0_#a86b00] md:not-sr-only">Road to Glory</h1>
          <span className="flex-1" />
          <span className="hidden items-center gap-2 lg:flex">
            <span className="font-pixel text-[9px]">{state.student.firstName}</span>
            <span className="font-pixel text-[8px] text-game-muted">
              LV {stats.level} {stats.title}
            </span>
          </span>
          {pending > 0 && (
            <span
              className="hidden items-center gap-1 font-pixel text-[8px] text-game-muted sm:flex"
              title="Gold waiting for your teacher to verify your work"
            >
              +{pending} soon
            </span>
          )}
          <Gold amount={gold} />
          <span className="flex items-center gap-1.5 font-pixel text-[10px] text-game-gold" title="Quest scrolls: one per battle">
            <GameIcon kind="scroll" />
            {scrollsLeft}
          </span>
          <PixelButton tone="stone" size="sm" onClick={() => setHelp(true)} aria-label="How to play">
            ?
          </PixelButton>
          <PixelButton
            tone="stone"
            size="sm"
            aria-pressed={!muted}
            aria-label={muted ? "Turn sound on" : "Turn sound off"}
            onClick={() => {
              setMuted(!muted);
              if (muted) sfx.select();
            }}
          >
            {muted ? "SFX off" : "SFX on"}
          </PixelButton>
        </header>

        {/* The game menu: under the HUD on big screens, along the bottom on phones. */}
        <GameMenu screen={screen} onGo={go} className="hidden justify-center gap-2 border-b-[3px] border-game-edge bg-game-bg px-5 py-2.5 md:flex" />
      </div>
      <GameMenu screen={screen} onGo={go} className="fixed inset-x-0 bottom-0 z-30 flex border-t-[3px] border-game-edge bg-game-panel md:hidden" />

      <main id="content" className="flex flex-1 flex-col gap-5 p-3 pb-24 sm:p-5 md:pb-5">
        {screen === "realm" && (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            {hero}
            <WorldMap
              level={stats.level}
              hero={stats}
              selected={region}
              onSelect={setRegion}
              onFight={startFight}
              scrolls={scrollsLeft}
              wins={wins}
            />
          </div>
        )}
        {screen === "blacksmith" && (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            {hero}
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
          </div>
        )}
        {screen === "hall" && (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <HallOfHeroes state={state} />
            </div>
            <div className="flex flex-col gap-5 lg:w-[400px] lg:shrink-0">
              <TrophyCase wins={wins} />
              <AdventureLog hero={state.hero} />
            </div>
          </div>
        )}
      </main>

      <BattleDialog
        monster={fight}
        stats={stats}
        region={(fight && regionOf(fight.key)?.key) || region.key}
        firstWin={firstWin}
        onDone={finishFight}
      />
      <ItemGet item={got} stats={stats} onClose={() => setGot(null)} />
      <HowToPlay open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
