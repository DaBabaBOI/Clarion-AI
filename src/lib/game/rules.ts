// Road to Glory's rules: levels from the points earned for homework, the
// hero's stats from their level and equipment, and quest scrolls (one per
// piece of homework handed in on time) that pay for battles.
//
// The server checks the same rules when a student buys, equips or battles
// (see the hero_* functions in supabase/migrations/*_road_to_glory.sql).

import { toISODate } from "../dates";
import type { AppState, HeroState } from "../types";
import { ITEMS, STARTERS, itemByKey, type Dice, type DamageType, type Item, type ItemEffects, type Slot } from "./items";

// ── Levels ──────────────────────────────────────────────────────────────────

export const MAX_LEVEL = 20;

/** Level 2 at 25 XP, 3 at 100, 4 at 225, 5 at 400 … (25 × (level − 1)²). */
export function levelFor(xp: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 25)));
}

export function xpForLevel(level: number): number {
  return 25 * (level - 1) ** 2;
}

const TITLES: [number, string][] = [
  [1, "Farmhand"],
  [2, "Squire"],
  [4, "Shield-bearer"],
  [5, "Knight"],
  [7, "Knight Captain"],
  [9, "Champion"],
  [11, "Paladin"],
  [13, "Warlord"],
  [16, "Legend"],
  [20, "Dragonslayer"],
];

export function titleFor(level: number): string {
  return [...TITLES].reverse().find(([l]) => level >= l)![1];
}

export function proficiency(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

// ── Equipment ───────────────────────────────────────────────────────────────

export const EMPTY_HERO: HeroState = { owned: [], equipped: {}, battles: [] };

export function owns(hero: HeroState, item: Item): boolean {
  return Boolean(item.starter) || hero.owned.includes(item.key);
}

/** What the hero is wearing, falling back to the starter kit. Two-handed weapons leave no room for a shield. */
export function equippedItems(hero: HeroState): Partial<Record<Slot, Item>> {
  const pick = (slot: Slot) => {
    const item = itemByKey(hero.equipped[slot]);
    return item && item.slot === slot && owns(hero, item) ? item : STARTERS[slot];
  };
  const weapon = pick("weapon");
  return {
    weapon,
    offhand: weapon?.twoHanded ? undefined : pick("offhand"),
    head: pick("head"),
    body: pick("body"),
    trinket: pick("trinket"),
  };
}

/**
 * Equipping an item: a two-handed weapon takes the shield off, and a shield
 * swaps a two-handed weapon for the starter sword.
 */
export function equip(hero: HeroState, item: Item): HeroState {
  const equipped = { ...hero.equipped, [item.slot]: item.key };
  if (item.twoHanded) delete equipped.offhand;
  if (item.slot === "offhand" && itemByKey(equipped.weapon)?.twoHanded) delete equipped.weapon;
  return { ...hero, equipped };
}

export function unequip(hero: HeroState, slot: Slot): HeroState {
  const equipped = { ...hero.equipped };
  delete equipped[slot];
  return { ...hero, equipped };
}

// ── Stats ───────────────────────────────────────────────────────────────────

export type Ability = "str" | "dex" | "con" | "wis";
export const ABILITIES: { key: Ability; label: string; name: string }[] = [
  { key: "str", label: "STR", name: "Strength" },
  { key: "dex", label: "DEX", name: "Dexterity" },
  { key: "con", label: "CON", name: "Constitution" },
  { key: "wis", label: "WIS", name: "Wisdom" },
];

export interface HeroStats {
  level: number;
  xp: number;
  title: string;
  proficiency: number;
  abilities: Record<Ability, { score: number; mod: number }>;
  maxHp: number;
  ac: number;
  toHit: number;
  damage: Dice & { type: DamageType };
  damageBonus: number;
  initiative: number;
  critMin: number;
  potions: number;
  potionHeal: number;
  defend: number;
  effects: ItemEffects;
  items: Partial<Record<Slot, Item>>;
}

const mod = (score: number) => Math.floor((score - 10) / 2);

/** Adds up every equipped item's effects. */
function combine(items: Item[]): ItemEffects {
  const total: ItemEffects = {};
  const add = (k: keyof ItemEffects, v: number) => ((total as Record<string, number>)[k] = ((total as Record<string, number>)[k] ?? 0) + v);
  for (const item of items) {
    for (const [k, v] of Object.entries(item.effects) as [keyof ItemEffects, ItemEffects[keyof ItemEffects]][]) {
      if (typeof v === "number" && k !== "critMin" && k !== "defend") add(k, v);
      else if (typeof v === "boolean") (total as Record<string, unknown>)[k] = total[k] || v;
      else if (k === "critMin") total.critMin = Math.min(total.critMin ?? 20, v as number);
      else if (k === "defend") total.defend = v as number;
      else if (v) (total as Record<string, unknown>)[k] = v;
    }
  }
  return total;
}

export function heroStats(xp: number, hero: HeroState): HeroStats {
  const level = levelFor(xp);
  const items = equippedItems(hero);
  const worn = Object.values(items).filter((i): i is Item => Boolean(i));
  const e = combine(worn);

  // Every hero starts with 10s, and gains a point in each ability every four levels.
  const growth = Math.floor((level - 1) / 4);
  const abilities = Object.fromEntries(
    ABILITIES.map(({ key }) => {
      const score = Math.max(3, 10 + growth + (e[key] ?? 0));
      return [key, { score, mod: mod(score) }];
    }),
  ) as HeroStats["abilities"];

  const weapon = items.weapon!;
  const body = items.body!;
  const prof = proficiency(level);
  const attackMod = weapon.ranged
    ? abilities.dex.mod
    : weapon.finesse
      ? Math.max(abilities.str.mod, abilities.dex.mod)
      : abilities.str.mod;
  const dexToAc = body.armour?.dexMax === null ? abilities.dex.mod : Math.min(abilities.dex.mod, body.armour?.dexMax ?? 0);
  const twoHands = !items.offhand && weapon.versatile;

  return {
    level,
    xp,
    title: titleFor(level),
    proficiency: prof,
    abilities,
    maxHp: Math.max(4, 10 + abilities.con.mod + (level - 1) * (6 + abilities.con.mod) + (e.hp ?? 0)),
    ac: (body.armour?.base ?? 10) + dexToAc + (e.ac ?? 0),
    toHit: prof + attackMod + (e.toHit ?? 0),
    damage: twoHands ? { ...weapon.versatile!, type: weapon.damage!.type } : weapon.damage!,
    damageBonus: attackMod + (e.damage ?? 0),
    initiative: abilities.dex.mod + (e.initiative ?? 0),
    critMin: e.critMin ?? 20,
    potions: 2 + (e.potions ?? 0),
    potionHeal: e.potionHeal ?? 0,
    defend: e.defend ?? 2,
    effects: e,
    items,
  };
}

// ── Quest scrolls ───────────────────────────────────────────────────────────

/** Every new hero gets a few scrolls to try a battle straight away. */
export const STARTER_SCROLLS = 3;

/** Class work handed in on or before its due date (and not sent back). */
export function onTimeHandIns(state: AppState): number {
  return state.tasks.filter(
    (t) =>
      t.classId &&
      (t.status === "submitted" || t.status === "verified") &&
      !t.returned &&
      (!t.submittedAt || toISODate(new Date(t.submittedAt)) <= t.due),
  ).length;
}

export function scrolls(state: AppState): number {
  return Math.max(0, STARTER_SCROLLS + onTimeHandIns(state) - state.hero.battles.length);
}

export function canBuy(item: Item, level: number, gold: number, hero: HeroState): "owned" | "level" | "gold" | "ok" {
  if (owns(hero, item)) return "owned";
  if (level < item.level) return "level";
  if (gold < item.price) return "gold";
  return "ok";
}

export const SHOP_ORDER: Slot[] = ["weapon", "body", "offhand", "head", "trinket"];

export function shopItems(slot: Slot): Item[] {
  return ITEMS.filter((i) => i.slot === slot && !i.starter).sort((a, b) => a.level - b.level || a.price - b.price);
}
