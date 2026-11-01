// The realm: five regions from the meadow to the Dragon's Peak, each with its
// monsters. A region opens when the hero reaches its level.

import type { Dice, DamageType } from "./items";

export type SpriteKey = "slime" | "goblin" | "wolf" | "skeleton" | "knight" | "dragon";

export interface Monster {
  key: string;
  name: string;
  hp: number;
  ac: number;
  toHit: number;
  damage: Dice & { type: DamageType };
  damageBonus: number;
  initiative: number;
  traits: string[];
  /** Takes double damage of this type. */
  weakTo?: DamageType;
  /** Chance to parry a hit. */
  parry?: number;
  /** Breathes fire every n rounds instead of attacking (DEX save for half). */
  breath?: { every: number; dice: Dice; save: number };
  sprite: SpriteKey;
  palette?: Record<string, string>;
  /** The title a hero earns for the first win. */
  title: string;
  lore: string;
}

export interface Region {
  key: string;
  name: string;
  level: number;
  blurb: string;
  monsters: string[];
  /** Position on the world map, in map tiles. */
  at: { x: number; y: number };
}

export const MONSTERS: Monster[] = [
  {
    key: "slime",
    name: "Green Slime",
    hp: 8,
    ac: 8,
    toHit: 2,
    damage: { count: 1, sides: 4, type: "bludgeoning" },
    damageBonus: 0,
    initiative: -2,
    traits: ["Squishy", "Slow"],
    sprite: "slime",
    title: "Slime Squasher",
    lore: "It wobbles. It gurgles. It wants your lunch.",
  },
  {
    key: "goblin",
    name: "Goblin",
    hp: 11,
    ac: 12,
    toHit: 3,
    damage: { count: 1, sides: 6, type: "slashing" },
    damageBonus: 0,
    initiative: 2,
    traits: ["Sneaky: +2 initiative"],
    sprite: "goblin",
    title: "Goblin Basher",
    lore: "Steals socks from washing lines. Also, occasionally, swords.",
  },
  {
    key: "dire-wolf",
    name: "Dire Wolf",
    hp: 16,
    ac: 12,
    toHit: 4,
    damage: { count: 2, sides: 4, type: "piercing" },
    damageBonus: 1,
    initiative: 2,
    traits: ["Pack hunter", "Fast"],
    sprite: "wolf",
    title: "Wolf Tamer",
    lore: "Its howl carries for miles through the Whispering Woods.",
  },
  {
    key: "goblin-chief",
    name: "Goblin Chief",
    hp: 20,
    ac: 14,
    toHit: 4,
    damage: { count: 1, sides: 8, type: "slashing" },
    damageBonus: 2,
    initiative: 1,
    traits: ["Armoured", "Bossy"],
    sprite: "goblin",
    palette: { g: "#4f8a2f", G: "#2f5a1a", c: "#b0242c", C: "#6e1418", y: "#ffd23f" },
    title: "Chief Toppler",
    lore: "Wears a crown he found in a ditch. Nobody has dared to tell him.",
  },
  {
    key: "skeleton",
    name: "Skeleton",
    hp: 22,
    ac: 13,
    toHit: 5,
    damage: { count: 1, sides: 8, type: "slashing" },
    damageBonus: 2,
    initiative: 1,
    traits: ["Brittle: double damage from bludgeoning"],
    weakTo: "bludgeoning",
    sprite: "skeleton",
    title: "Bone Breaker",
    lore: "Rattles when it walks. Rattles more when it runs at you.",
  },
  {
    key: "magma-slime",
    name: "Magma Slime",
    hp: 30,
    ac: 11,
    toHit: 6,
    damage: { count: 2, sides: 6, type: "fire" },
    damageBonus: 0,
    initiative: -1,
    traits: ["Molten: fire damage"],
    sprite: "slime",
    palette: { s: "#ff7a1a", S: "#c2410c", h: "#ffd23f", o: "#3a1306" },
    title: "Lava Wader",
    lore: "A slime that fell into the cave's heart and liked it there.",
  },
  {
    key: "skeleton-knight",
    name: "Skeleton Knight",
    hp: 32,
    ac: 16,
    toHit: 6,
    damage: { count: 1, sides: 10, type: "slashing" },
    damageBonus: 3,
    initiative: 0,
    traits: ["Armoured", "Brittle: double damage from bludgeoning"],
    weakTo: "bludgeoning",
    sprite: "skeleton",
    palette: { a: "#8e9aab", A: "#5b6676", r: "#c0392b" },
    title: "Keep Breaker",
    lore: "Still guarding the ruined keep for a king who left long ago.",
  },
  {
    key: "dark-knight",
    name: "Dark Knight",
    hp: 36,
    ac: 17,
    toHit: 7,
    damage: { count: 1, sides: 10, type: "necrotic" },
    damageBonus: 4,
    initiative: 1,
    traits: ["Parry: 15% chance to block a hit"],
    parry: 0.15,
    sprite: "knight",
    title: "Shadowbane",
    lore: "Nobody has seen its face. Some say there is nothing inside the armour.",
  },
  {
    key: "red-wyrm",
    name: "Red Wyrm",
    hp: 80,
    ac: 18,
    toHit: 9,
    damage: { count: 2, sides: 8, type: "slashing" },
    damageBonus: 4,
    initiative: 0,
    traits: ["Fire breath every third round (DEX save for half)", "Ancient scales"],
    breath: { every: 3, dice: { count: 6, sides: 6 }, save: 15 },
    sprite: "dragon",
    title: "Dragonslayer",
    lore: "It has slept on its hoard for a hundred years. You are about to wake it.",
  },
];

export const REGIONS: Region[] = [
  {
    key: "greenvale",
    name: "Greenvale Meadow",
    level: 1,
    blurb: "Rolling hills around the village. A gentle place to start.",
    monsters: ["slime", "goblin"],
    at: { x: 8, y: 14 },
  },
  {
    key: "whispering-woods",
    name: "Whispering Woods",
    level: 3,
    blurb: "Old trees, older wolves, and a goblin camp in the clearing.",
    monsters: ["dire-wolf", "goblin-chief"],
    at: { x: 20, y: 10 },
  },
  {
    key: "crystal-caves",
    name: "Crystal Caves",
    level: 5,
    blurb: "Glittering tunnels under the hills, warm with magma deep down.",
    monsters: ["skeleton", "magma-slime"],
    at: { x: 33, y: 15 },
  },
  {
    key: "ruined-keep",
    name: "Ruined Keep",
    level: 8,
    blurb: "A fallen castle where the old guard still keeps watch.",
    monsters: ["skeleton-knight", "dark-knight"],
    at: { x: 41, y: 6 },
  },
  {
    key: "dragons-peak",
    name: "Dragon's Peak",
    level: 12,
    blurb: "Smoke rises from the mountain. Something enormous is breathing.",
    monsters: ["red-wyrm"],
    at: { x: 53, y: 3 },
  },
];

const BY_KEY = new Map(MONSTERS.map((m) => [m.key, m]));

export function monsterByKey(key: string): Monster | undefined {
  return BY_KEY.get(key);
}

export function regionOf(monsterKey: string): Region | undefined {
  return REGIONS.find((r) => r.monsters.includes(monsterKey));
}
