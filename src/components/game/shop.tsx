"use client";

import { useState } from "react";
import { toast } from "@/lib/client-hooks";
import { RARITY, SLOTS, STARTERS, diceLabel, itemByKey, type Item, type Slot } from "@/lib/game/items";
import { itemIcon } from "@/lib/game/pixels";
import { canBuy, equip, heroStats, owns, shopItems, type HeroStats } from "@/lib/game/rules";
import { sfx } from "@/lib/game/sfx";
import { actions } from "@/lib/store";
import type { AppState, HeroState, Reward } from "@/lib/types";
import { cx } from "../ui";
import { GameDialog, GameIcon, GamePanel, Gold, PixelButton } from "./game-ui";
import { PixelArt } from "./pixel-art";

export type ShopTab = Slot | "favours";

const TABS: { value: ShopTab; label: string }[] = [
  { value: "weapon", label: "Weapons" },
  { value: "body", label: "Armour" },
  { value: "offhand", label: "Shields" },
  { value: "head", label: "Helms" },
  { value: "trinket", label: "Trinkets" },
  { value: "favours", label: "Royal favours" },
];

/** Rarity colours that read on parchment. */
const RARITY_INK: Record<Item["rarity"], string> = {
  common: "#5b5b66",
  uncommon: "#2f7a36",
  rare: "#1f5aa8",
  epic: "#6b2fb0",
  legendary: "#a35f00",
};

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const average = (s: HeroStats) => (s.damage.count * (s.damage.sides + 1)) / 2 + s.damageBonus;

/** How wearing this item would change the hero, only where it changes. */
function compare(xp: number, hero: HeroState, item: Item, now: HeroStats) {
  const after = heroStats(xp, equip({ ...hero, owned: [...hero.owned, item.key] }, item));
  return [
    { label: "HP", d: after.maxHp - now.maxHp },
    { label: "AC", d: after.ac - now.ac },
    { label: "HIT", d: after.toHit - now.toHit },
    { label: "DMG", d: Math.round((average(after) - average(now)) * 10) / 10 },
    { label: "INIT", d: after.initiative - now.initiative },
  ].filter((r) => r.d !== 0);
}

function ItemDetail({
  item,
  xp,
  hero,
  stats,
  gold,
  onBought,
}: {
  item: Item;
  xp: number;
  hero: HeroState;
  stats: HeroStats;
  gold: number;
  onBought: (item: Item) => void;
}) {
  const verdict = canBuy(item, stats.level, gold, hero);
  const owned = owns(hero, item);
  const equipped = stats.items[item.slot]?.key === item.key;
  const deltas = equipped ? [] : compare(xp, hero, item, stats);
  const slotLabel = SLOTS.find((s) => s.slot === item.slot)?.label ?? "";

  return (
    <article className="flex flex-col gap-2.5 bg-game-parchment p-4 text-game-parchment-ink shadow-[0_0_0_3px_#0d0a18,inset_0_0_0_3px_#d8c49a]">
      <div className="flex items-center gap-3">
        <div className="grid size-[76px] shrink-0 place-items-center bg-[#e3d0a6] shadow-[inset_3px_3px_0_#c9b28a]">
          <PixelArt grid={itemIcon(item)} scale={4} title={item.name} />
        </div>
        <div className="min-w-0">
          <h3 className="font-pixel text-[11px] leading-5" style={{ color: RARITY_INK[item.rarity] }}>
            {item.name}
          </h3>
          <p className="text-[14px] leading-5">
            {RARITY[item.rarity].label} {slotLabel.toLowerCase()}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {item.properties.map((p) => (
              <span key={p} className="bg-[#3b2a14] px-1.5 py-0.5 font-pixel text-[7px] leading-3 text-game-parchment">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      <dl className="flex flex-col gap-0.5 border-y-2 border-dashed border-[#c9b28a] py-2 text-[16px] leading-5">
        {item.damage && (
          <div className="flex justify-between gap-3">
            <dt>Damage</dt>
            <dd className="font-semibold">
              {diceLabel(item.damage)} {item.damage.type}
              {item.versatile && ` (${diceLabel(item.versatile)} two-handed)`}
            </dd>
          </div>
        )}
        {item.armour && (
          <div className="flex justify-between gap-3">
            <dt>Armour Class</dt>
            <dd className="font-semibold">
              {item.armour.base}
              {item.armour.dexMax === null ? " + DEX" : item.armour.dexMax > 0 ? ` + DEX (max ${item.armour.dexMax})` : ""}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt>Needs</dt>
          <dd className={cx("font-semibold", stats.level < item.level && "text-[#b3261e]")}>Level {item.level}</dd>
        </div>
      </dl>

      <ul className="flex flex-col gap-1 text-[16px] leading-5">
        {item.buffs.map((b) => (
          <li key={b} className="flex gap-1.5 text-[#256b2c]">
            <span aria-hidden="true">▲</span>
            {b}
          </li>
        ))}
        {item.debuffs.map((b) => (
          <li key={b} className="flex gap-1.5 text-[#b3261e]">
            <span aria-hidden="true">▼</span>
            {b}
          </li>
        ))}
      </ul>
      <p className="text-[15px] leading-5 italic opacity-80">“{item.lore}”</p>

      {deltas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="opacity-80">If you wear it:</span>
          {deltas.map((r) => (
            <span key={r.label} className={cx("font-pixel text-[8px]", r.d > 0 ? "text-[#256b2c]" : "text-[#b3261e]")}>
              {r.label} {signed(r.d)}
            </span>
          ))}
        </div>
      )}

      <div className="mt-1 flex items-center gap-3">
        {!owned && (
          <span className="flex items-center gap-1.5 font-pixel text-[11px] text-[#7a4f00]">
            <GameIcon kind="coin" />
            {item.price}
          </span>
        )}
        <span className="flex-1" />
        {equipped ? (
          item.starter ? (
            <span className="font-pixel text-[8px] text-[#256b2c]">EQUIPPED</span>
          ) : (
            <PixelButton
              tone="stone"
              size="sm"
              onClick={() => {
                sfx.equip();
                actions.unequipSlot(item.slot);
              }}
            >
              Take off
            </PixelButton>
          )
        ) : owned ? (
          <PixelButton
            tone="blue"
            onClick={() => {
              sfx.equip();
              actions.equipItem(item.key);
              toast(`Equipped the ${item.name}`, "success");
            }}
          >
            Equip
          </PixelButton>
        ) : (
          <PixelButton
            tone="green"
            disabled={verdict !== "ok"}
            title={verdict === "level" ? `Reach level ${item.level}` : verdict === "gold" ? `You need ${item.price - gold} more gold` : undefined}
            onClick={() => {
              const problem = actions.buyItem(item.key);
              if (problem) {
                sfx.error();
                toast(problem);
                return;
              }
              sfx.coin();
              onBought(item);
            }}
          >
            {verdict === "level" ? `Level ${item.level}` : verdict === "gold" ? `Need ${item.price - gold}` : "Buy"}
          </PixelButton>
        )}
      </div>
    </article>
  );
}

function ItemTile({ item, stats, hero, gold, selected, onSelect }: { item: Item; stats: HeroStats; hero: HeroState; gold: number; selected: boolean; onSelect: () => void }) {
  const owned = owns(hero, item);
  const equipped = stats.items[item.slot]?.key === item.key;
  const locked = !owned && stats.level < item.level;
  const pricey = !owned && !locked && gold < item.price;
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          sfx.select();
          onSelect();
        }}
        aria-pressed={selected}
        aria-label={`${item.name}${equipped ? ", equipped" : owned ? ", owned" : locked ? `, needs level ${item.level}` : `, ${item.price} gold`}`}
        className={cx(
          "pixel-inset relative flex w-full flex-col items-center gap-1 px-1 pt-2 pb-1.5 transition",
          selected ? "outline-3 outline-offset-0 outline-game-gold" : "hover:brightness-125",
        )}
      >
        <span className="absolute top-0 left-0 h-[3px] w-full" style={{ background: RARITY[item.rarity].color }} aria-hidden="true" />
        <span className={cx(locked && "brightness-0 opacity-50")}>
          <PixelArt grid={itemIcon(item)} scale={3} />
        </span>
        {equipped ? (
          <span className="font-pixel text-[7px] text-game-good">EQUIPPED</span>
        ) : owned ? (
          <span className="font-pixel text-[7px] text-game-xp">OWNED</span>
        ) : locked ? (
          <span className="flex items-center gap-1 font-pixel text-[7px] text-game-muted">
            <GameIcon kind="lock" scale={1} /> LV {item.level}
          </span>
        ) : (
          <span className={cx("flex items-center gap-1 font-pixel text-[7px]", pricey ? "text-game-muted" : "text-game-gold")}>
            <GameIcon kind="coin" scale={1} />
            {item.price}
          </span>
        )}
      </button>
    </li>
  );
}

const FAVOUR_ICON: Record<Reward["icon"], "star" | "scroll" | "heart"> = { game: "star", pass: "scroll", theme: "heart" };

/** The real rewards the school offers, which teachers approve. */
function RoyalFavours({ state, gold }: { state: AppState; gold: number }) {
  const [confirming, setConfirming] = useState<Reward | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[15px] leading-5 text-game-muted">Real rewards from your school. Some need your teacher to approve them.</p>
      {state.rewards.length === 0 ? (
        <p className="pixel-inset p-3 text-[15px] text-game-muted">The court has nothing on offer yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {state.rewards.map((r) => {
            const redemption = state.redemptions.find((x) => x.rewardId === r.id);
            const affordable = gold >= r.cost;
            return (
              <li key={r.id} className="pixel-inset flex items-center gap-3 p-3">
                <GameIcon kind={FAVOUR_ICON[r.icon]} scale={4} />
                <div className="min-w-0 flex-1">
                  <p className="font-pixel text-[9px] leading-4">{r.title}</p>
                  <p className="text-[14px] text-game-muted">{r.needsTeacher ? "Your teacher approves it" : "Unlocks straight away"}</p>
                </div>
                {redemption ? (
                  <span className={cx("font-pixel text-[8px]", redemption.status === "unlocked" ? "text-game-good" : "text-game-gold")}>
                    {redemption.status === "unlocked" ? "GRANTED" : "AWAITING TEACHER"}
                  </span>
                ) : (
                  <PixelButton size="sm" tone={affordable ? "gold" : "stone"} disabled={!affordable} onClick={() => setConfirming(r)}>
                    <span className="flex items-center gap-1">
                      <GameIcon kind="coin" scale={1} />
                      {r.cost}
                    </span>
                  </PixelButton>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <GameDialog open={confirming !== null} onClose={() => setConfirming(null)} label="Ask for a royal favour">
        {confirming && (
          <div className="flex flex-col gap-4">
            <p className="font-pixel text-[11px] leading-5 text-game-gold">Spend {confirming.cost} gold?</p>
            <p className="text-[16px] leading-6">
              {confirming.needsTeacher
                ? `"${confirming.title}" goes to your teacher to approve. Your rank stays the same.`
                : `"${confirming.title}" unlocks straight away. Your rank stays the same.`}
            </p>
            <div className="flex justify-end gap-3">
              <PixelButton tone="stone" onClick={() => setConfirming(null)}>
                Not now
              </PixelButton>
              <PixelButton
                onClick={() => {
                  if (actions.redeem(confirming.id)) {
                    sfx.coin();
                    toast(confirming.needsTeacher ? "Request sent to your teacher" : `${confirming.title} unlocked`, "success");
                  }
                  setConfirming(null);
                }}
              >
                Spend
              </PixelButton>
            </div>
          </div>
        )}
      </GameDialog>
    </div>
  );
}

export function Blacksmith({
  state,
  xp,
  stats,
  gold,
  tab,
  onTab,
  selectedKey,
  onSelect,
  onBought,
}: {
  state: AppState;
  xp: number;
  stats: HeroStats;
  gold: number;
  tab: ShopTab;
  onTab: (tab: ShopTab) => void;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onBought: (item: Item) => void;
}) {
  // Starter gear stays in the list so the hero can switch back to it.
  const items = tab === "favours" ? [] : [...(STARTERS[tab] ? [STARTERS[tab]!] : []), ...shopItems(tab)];
  const selected = itemByKey(selectedKey) && items.some((i) => i.key === selectedKey) ? itemByKey(selectedKey)! : items[0];

  return (
    <GamePanel title="The Blacksmith" right={<Gold amount={gold} />} className="min-w-0 flex-1">
      <div role="tablist" aria-label="Shop" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => {
              sfx.select();
              onTab(t.value);
            }}
            className={cx(
              "px-2.5 py-1.5 font-pixel text-[8px] leading-3 uppercase",
              tab === t.value ? "bg-game-gold text-[#2b1a00]" : "bg-game-panel-2 text-game-muted hover:text-game-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "favours" ? (
        <RoyalFavours state={state} gold={gold} />
      ) : (
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
          <ul className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2">
            {items.map((item) => (
              <ItemTile
                key={item.key}
                item={item}
                stats={stats}
                hero={state.hero}
                gold={gold}
                selected={selected?.key === item.key}
                onSelect={() => onSelect(item.key)}
              />
            ))}
          </ul>
          {selected && (
            <div className="xl:w-[340px] xl:shrink-0">
              <ItemDetail item={selected} xp={xp} hero={state.hero} stats={stats} gold={gold} onBought={onBought} />
            </div>
          )}
        </div>
      )}
    </GamePanel>
  );
}
