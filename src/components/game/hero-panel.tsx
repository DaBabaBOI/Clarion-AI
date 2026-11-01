"use client";

import { SLOTS, diceLabel, type Item, type Slot } from "@/lib/game/items";
import { itemIcon } from "@/lib/game/pixels";
import { ABILITIES, MAX_LEVEL, xpForLevel, type HeroStats } from "@/lib/game/rules";
import { heroSprite } from "@/lib/game/sprites";
import { cx } from "../ui";
import { GameIcon, GamePanel, Gold, StatBar } from "./game-ui";
import { PixelArt } from "./pixel-art";

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** The hero: who they are, what they wear, and what that makes them. */
export function HeroPanel({
  name,
  stats,
  gold,
  scrolls,
  onSlot,
}: {
  name: string;
  stats: HeroStats;
  gold: number;
  scrolls: number;
  onSlot: (slot: Slot, item: Item | undefined) => void;
}) {
  const next = Math.min(MAX_LEVEL, stats.level + 1);
  const floor = xpForLevel(stats.level);
  const ceiling = xpForLevel(next);
  const maxed = stats.level >= MAX_LEVEL;

  const combat = [
    { label: "HP", value: String(stats.maxHp), hint: "Hit points" },
    { label: "AC", value: String(stats.ac), hint: "Armour Class: what foes must roll to hit you" },
    { label: "HIT", value: signed(stats.toHit), hint: "Bonus to your attack roll" },
    {
      label: "DMG",
      value: `${diceLabel(stats.damage)}${stats.damageBonus ? signed(stats.damageBonus) : ""}`,
      hint: `${stats.damage.type} damage per hit`,
    },
    { label: "INIT", value: signed(stats.initiative), hint: "Initiative: who acts first" },
    { label: "CRIT", value: stats.critMin < 20 ? `${stats.critMin}-20` : "20", hint: "d20 rolls that land a critical hit" },
  ];

  return (
    <GamePanel title="Your hero" right={<Gold amount={gold} />} className="lg:w-[360px] lg:shrink-0">
      <div className="flex items-end gap-3">
        <div className="pixel-inset relative grid h-[172px] w-[132px] shrink-0 place-items-end overflow-hidden bg-[#203a2a]">
          {/* A patch of grass to stand on. */}
          <div className="absolute inset-x-0 bottom-0 h-7 bg-[#4c9631]" />
          <div className="absolute inset-x-0 bottom-7 h-[3px] bg-[#5aa83a]" />
          <div className="relative mx-auto mb-1 motion-safe:animate-[game-bob_1.2s_steps(2)_infinite]">
            <PixelArt grid={heroSprite(stats.items)} scale={5} title={`${name}, your hero`} />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="truncate font-pixel text-[12px] leading-5">{name}</p>
          <p className="text-[15px] leading-5 text-game-muted">
            Level {stats.level} {stats.title}
          </p>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between font-pixel text-[8px] text-game-muted">
              <span>XP</span>
              <span>{maxed ? "MAX" : `${stats.xp - floor}/${ceiling - floor}`}</span>
            </div>
            <StatBar value={maxed ? 1 : stats.xp - floor} max={maxed ? 1 : ceiling - floor} color="var(--color-game-xp)" label="Experience to next level" />
            {!maxed && <p className="text-[12.5px] leading-4 text-game-muted">{ceiling - stats.xp} XP to level {next}</p>}
          </div>
          <div className="flex items-center gap-1.5 text-[13.5px] leading-4" title="One scroll per battle. Earn one for every piece of homework handed in on time.">
            <GameIcon kind="scroll" />
            <span>
              <b className="font-pixel text-[10px] text-game-gold">{scrolls}</b> quest scroll{scrolls === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-1.5">
        {combat.map((s) => (
          <div key={s.label} className="pixel-inset flex flex-col items-center gap-1 px-1 py-2" title={s.hint}>
            <dt className="font-pixel text-[7px] text-game-muted">{s.label}</dt>
            <dd className="font-pixel text-[11px]">{s.value}</dd>
          </div>
        ))}
      </dl>
      <dl className="grid grid-cols-4 gap-1.5">
        {ABILITIES.map((a) => {
          const { score, mod } = stats.abilities[a.key];
          return (
            <div key={a.key} className="flex flex-col items-center gap-0.5 py-1" title={a.name}>
              <dt className="font-pixel text-[7px] text-game-muted">{a.label}</dt>
              <dd className="text-[16px] leading-5">
                {score} <span className="text-[12px] text-game-muted">({signed(mod)})</span>
              </dd>
            </div>
          );
        })}
      </dl>

      <div>
        <p className="mb-1.5 font-pixel text-[8px] text-game-muted">EQUIPMENT</p>
        <ul className="grid grid-cols-5 gap-1.5">
          {SLOTS.map(({ slot, label }) => {
            const item = stats.items[slot];
            const blocked = slot === "offhand" && !item && stats.items.weapon?.twoHanded;
            return (
              <li key={slot}>
                <button
                  type="button"
                  onClick={() => onSlot(slot, item)}
                  title={item ? `${label}: ${item.name}` : blocked ? "Your weapon needs both hands" : `${label}: empty`}
                  aria-label={item ? `${label}: ${item.name}` : `${label}: empty`}
                  className={cx("pixel-inset grid aspect-square w-full place-items-center hover:brightness-125", !item && "opacity-60")}
                >
                  {item ? (
                    <PixelArt grid={itemIcon(item)} scale={3} />
                  ) : (
                    <span className="font-pixel text-[7px] text-game-muted">{blocked ? "2H" : "—"}</span>
                  )}
                </button>
                <p className="mt-1 text-center font-pixel text-[6px] text-game-muted uppercase">{label}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </GamePanel>
  );
}
