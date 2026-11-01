// The armoury for Road to Glory: medieval weapons, armour, shields, helms and
// trinkets that students buy with the gold (points) they earn from homework.
//
// Stats follow Dungeons & Dragons loosely: weapons roll damage dice and have
// properties (Finesse, Light, Heavy, Two-handed, Versatile); armour sets a
// base Armour Class. Every item lists its buffs and debuffs in words, and
// `effects` holds the same numbers the battle engine uses.
//
// Prices and level requirements are also stored in the hero_items table (see
// supabase/migrations/*_road_to_glory.sql), which is what the server checks
// when a student buys something. Keep the two in step.

export type Slot = "weapon" | "offhand" | "head" | "body" | "trinket";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type DamageType = "slashing" | "piercing" | "bludgeoning" | "necrotic" | "fire" | "radiant";

export interface Dice {
  count: number;
  sides: number;
}

/** Everything an item changes, buffs and debuffs together. */
export interface ItemEffects {
  str?: number;
  dex?: number;
  con?: number;
  wis?: number;
  /** Armour Class, on top of the body armour's base. */
  ac?: number;
  hp?: number;
  toHit?: number;
  damage?: number;
  initiative?: number;
  /** Critical hit on this d20 roll or higher (default 20). */
  critMin?: number;
  /** Share of the damage you deal that heals you. */
  lifesteal?: number;
  /** Extra damage dice on every hit. */
  extra?: Dice & { type: DamageType };
  /** Chance a hit makes the foe lose its next turn. */
  stagger?: number;
  /** Damage dealt back to a foe that hits you. */
  thorns?: Dice;
  /** Chance to dodge an attack completely. */
  dodge?: number;
  /** Armour Class gained when you Defend (default 2). */
  defend?: number;
  potionHeal?: number;
  potions?: number;
  /** You always act first. */
  firstStrike?: boolean;
  /** Reroll damage dice that land on 1 or 2, once. */
  rerollLow?: boolean;
  /** Damage you take at the end of every round. */
  selfBurn?: number;
  /** Healing at the end of every round. */
  regen?: number;
  /** Once per battle, get back up with half your HP. */
  revive?: boolean;
  fireResist?: boolean;
  /** Foes' bonus to hit you. */
  foeToHit?: number;
}

export type IconKind =
  | "sword"
  | "dagger"
  | "rapier"
  | "greatsword"
  | "axe"
  | "hammer"
  | "bow"
  | "buckler"
  | "kite"
  | "tower"
  | "spiked"
  | "cap"
  | "helm"
  | "greathelm"
  | "hat"
  | "crown"
  | "tunic"
  | "leather"
  | "chain"
  | "plate"
  | "elven"
  | "dragon"
  | "clover"
  | "ring"
  | "amulet"
  | "charm"
  | "owl"
  | "feather";

export interface Item {
  key: string;
  name: string;
  slot: Slot;
  rarity: Rarity;
  /** Gold (points) to buy. */
  price: number;
  /** Hero level needed to buy it. */
  level: number;
  /** Everyone starts with it; it is used when nothing else is equipped in its slot. */
  starter?: boolean;
  damage?: Dice & { type: DamageType };
  /** Damage when wielded with both hands (no shield). */
  versatile?: Dice;
  /** Uses the better of STR and DEX. */
  finesse?: boolean;
  ranged?: boolean;
  twoHanded?: boolean;
  /** Body armour: AC = base + DEX modifier (capped at dexMax; null means no cap). */
  armour?: { base: number; dexMax: number | null };
  properties: string[];
  effects: ItemEffects;
  buffs: string[];
  debuffs: string[];
  lore: string;
  icon: { kind: IconKind; palette?: Partial<Record<string, string>> };
}

export const SLOTS: { slot: Slot; label: string }[] = [
  { slot: "weapon", label: "Weapon" },
  { slot: "offhand", label: "Shield" },
  { slot: "head", label: "Helm" },
  { slot: "body", label: "Armour" },
  { slot: "trinket", label: "Trinket" },
];

export const RARITY: Record<Rarity, { label: string; color: string }> = {
  common: { label: "Common", color: "#c7c7d1" },
  uncommon: { label: "Uncommon", color: "#5fd36b" },
  rare: { label: "Rare", color: "#4aa8ff" },
  epic: { label: "Epic", color: "#c07bff" },
  legendary: { label: "Legendary", color: "#ffb02e" },
};

export const ITEMS: Item[] = [
  // ── Weapons ───────────────────────────────────────────────────────────────
  {
    key: "training-sword",
    name: "Training Sword",
    slot: "weapon",
    rarity: "common",
    price: 0,
    level: 1,
    starter: true,
    damage: { count: 1, sides: 4, type: "bludgeoning" },
    properties: ["Light"],
    effects: { toHit: 1, damage: -1 },
    buffs: ["Easy to swing: +1 to hit"],
    debuffs: ["Wooden: −1 damage"],
    lore: "Every hero starts somewhere. This one starts with a stick shaped like a sword.",
    icon: { kind: "sword", palette: { b: "#c99a5b", B: "#8a5a2b", g: "#7a4f28", p: "#7a4f28" } },
  },
  {
    key: "shortsword",
    name: "Shortsword",
    slot: "weapon",
    rarity: "common",
    price: 40,
    level: 1,
    damage: { count: 1, sides: 6, type: "piercing" },
    finesse: true,
    properties: ["Finesse", "Light"],
    effects: { dex: 2, initiative: 1, damage: -1 },
    buffs: ["Nimble: +2 DEX", "Quick draw: +1 initiative"],
    debuffs: ["Short reach: −1 damage"],
    lore: "A squire's blade. Fast in the hand, if a little short.",
    icon: { kind: "sword", palette: {} },
  },
  {
    key: "longsword",
    name: "Longsword",
    slot: "weapon",
    rarity: "uncommon",
    price: 90,
    level: 3,
    damage: { count: 1, sides: 8, type: "slashing" },
    versatile: { count: 1, sides: 10 },
    properties: ["Versatile (1d10)"],
    effects: { str: 2, initiative: -1 },
    buffs: ["Knight's grip: +2 STR", "Versatile: 1d10 with both hands"],
    debuffs: ["Heavy hilt: −1 initiative"],
    lore: "The blade of the realm's knights. Balanced, honest and dependable.",
    icon: { kind: "sword", palette: {} },
  },
  {
    key: "rapier",
    name: "Rapier",
    slot: "weapon",
    rarity: "uncommon",
    price: 120,
    level: 4,
    damage: { count: 1, sides: 8, type: "piercing" },
    finesse: true,
    properties: ["Finesse"],
    effects: { critMin: 19, damage: -1 },
    buffs: ["Precise: critical hit on 19–20"],
    debuffs: ["Thin blade: −1 damage"],
    lore: "A duellist's needle. It finds the gaps in any armour.",
    icon: { kind: "rapier", palette: {} },
  },
  {
    key: "battleaxe",
    name: "Battleaxe",
    slot: "weapon",
    rarity: "uncommon",
    price: 110,
    level: 4,
    damage: { count: 1, sides: 8, type: "slashing" },
    versatile: { count: 1, sides: 10 },
    properties: ["Versatile (1d10)"],
    effects: { damage: 2, toHit: -1 },
    buffs: ["Cleave: +2 damage"],
    debuffs: ["Clumsy: −1 to hit"],
    lore: "Forged in the northern holds, where subtlety is not a virtue.",
    icon: { kind: "axe", palette: {} },
  },
  {
    key: "warhammer",
    name: "Warhammer",
    slot: "weapon",
    rarity: "rare",
    price: 160,
    level: 5,
    damage: { count: 1, sides: 8, type: "bludgeoning" },
    versatile: { count: 1, sides: 10 },
    properties: ["Versatile (1d10)"],
    effects: { stagger: 0.2, initiative: -2 },
    buffs: ["Stagger: 20% chance the foe loses its next turn", "Crushes bones: skeletons take double damage"],
    debuffs: ["Heavy: −2 initiative"],
    lore: "Rings like a church bell. Skeletons hate the sound.",
    icon: { kind: "hammer", palette: {} },
  },
  {
    key: "longbow",
    name: "Longbow",
    slot: "weapon",
    rarity: "uncommon",
    price: 150,
    level: 5,
    damage: { count: 1, sides: 8, type: "piercing" },
    ranged: true,
    twoHanded: true,
    properties: ["Ranged", "Two-handed"],
    effects: { firstStrike: true, ac: -1 },
    buffs: ["First strike: you always act first", "Uses DEX to hit"],
    debuffs: ["Two-handed: no shield", "Exposed: −1 AC"],
    lore: "Yew from the Whispering Woods. Hits before the foe can reach you.",
    icon: { kind: "bow", palette: {} },
  },
  {
    key: "darksword",
    name: "Darksword",
    slot: "weapon",
    rarity: "rare",
    price: 220,
    level: 6,
    damage: { count: 1, sides: 10, type: "necrotic" },
    properties: ["Heavy", "Cursed"],
    effects: { lifesteal: 0.5, ac: -2, wis: -2 },
    buffs: ["Soul drain: heal half the damage you deal"],
    debuffs: ["Cursed: −2 AC", "Whispers: −2 WIS"],
    lore: "Pulled from a sealed tomb. It feeds you. It also feeds on you.",
    icon: { kind: "sword", palette: { b: "#7d4bb8", B: "#3c1f63", e: "#c79bff", g: "#2b1440", h: "#3a2a4a", p: "#c79bff" } },
  },
  {
    key: "greatsword",
    name: "Greatsword",
    slot: "weapon",
    rarity: "rare",
    price: 260,
    level: 7,
    damage: { count: 2, sides: 6, type: "slashing" },
    twoHanded: true,
    properties: ["Heavy", "Two-handed"],
    effects: { rerollLow: true, initiative: -2 },
    buffs: ["Great weapon: reroll damage dice of 1 or 2", "2d6 slashing"],
    debuffs: ["Two-handed: no shield", "Slow: −2 initiative"],
    lore: "Taller than most squires. Swing it once and the fight is usually over.",
    icon: { kind: "greatsword", palette: {} },
  },
  {
    key: "flame-tongue",
    name: "Flame Tongue",
    slot: "weapon",
    rarity: "epic",
    price: 400,
    level: 9,
    damage: { count: 1, sides: 8, type: "slashing" },
    versatile: { count: 1, sides: 10 },
    properties: ["Versatile (1d10)", "Magic"],
    effects: { extra: { count: 1, sides: 6, type: "fire" }, selfBurn: 1 },
    buffs: ["Ignite: +1d6 fire damage on every hit"],
    debuffs: ["Searing hilt: you take 1 damage each round"],
    lore: "Speak the word and the blade bursts into flame. Try not to hold it too long.",
    icon: { kind: "sword", palette: { b: "#ff8a2a", B: "#d9381e", e: "#ffe066", g: "#5b3a1a" } },
  },
  {
    key: "sunblade",
    name: "Sunblade",
    slot: "weapon",
    rarity: "legendary",
    price: 700,
    level: 12,
    damage: { count: 1, sides: 10, type: "radiant" },
    finesse: true,
    properties: ["Finesse", "Magic"],
    effects: { toHit: 2, damage: 2, regen: 1, foeToHit: 1 },
    buffs: ["Blessed: +2 to hit and +2 damage", "Dawnlight: heal 1 HP each round"],
    debuffs: ["Blinding glow: foes get +1 to hit you"],
    lore: "A hilt of gold that holds a blade of pure sunlight. Legends say it chooses its bearer.",
    icon: { kind: "sword", palette: { b: "#fff3b0", B: "#ffcf3f", e: "#ffffff", g: "#f4c542", h: "#c98f1e", p: "#ffffff" } },
  },

  // ── Shields ───────────────────────────────────────────────────────────────
  {
    key: "buckler",
    name: "Wooden Buckler",
    slot: "offhand",
    rarity: "common",
    price: 25,
    level: 1,
    properties: ["Shield"],
    effects: { ac: 1, initiative: 1, defend: 1 },
    buffs: ["+1 AC", "Light: +1 initiative"],
    debuffs: ["Small: Defend gives +1 AC instead of +2"],
    lore: "Round, light and cheap. Better than catching arrows with your hands.",
    icon: { kind: "buckler", palette: {} },
  },
  {
    key: "kite-shield",
    name: "Kite Shield",
    slot: "offhand",
    rarity: "uncommon",
    price: 90,
    level: 3,
    properties: ["Shield"],
    effects: { ac: 2, initiative: -1 },
    buffs: ["+2 AC"],
    debuffs: ["Unwieldy: −1 initiative"],
    lore: "Painted with the crest of the realm. Covers you from shoulder to knee.",
    icon: { kind: "kite", palette: {} },
  },
  {
    key: "spiked-shield",
    name: "Spiked Shield",
    slot: "offhand",
    rarity: "rare",
    price: 180,
    level: 5,
    properties: ["Shield"],
    effects: { ac: 1, thorns: { count: 1, sides: 4 }, dex: -2 },
    buffs: ["+1 AC", "Thorns: foes that hit you take 1d4"],
    debuffs: ["Awkward: −2 DEX"],
    lore: "Whoever designed this did not like being hit.",
    icon: { kind: "spiked", palette: {} },
  },
  {
    key: "tower-shield",
    name: "Tower Shield",
    slot: "offhand",
    rarity: "rare",
    price: 200,
    level: 6,
    properties: ["Shield", "Heavy"],
    effects: { ac: 3, defend: 4, initiative: -2, toHit: -1 },
    buffs: ["+3 AC", "Bulwark: Defend gives +4 AC"],
    debuffs: ["Wall of iron: −2 initiative and −1 to hit"],
    lore: "Less a shield, more a door you carry around.",
    icon: { kind: "tower", palette: {} },
  },

  // ── Helms ─────────────────────────────────────────────────────────────────
  {
    key: "leather-cap",
    name: "Leather Cap",
    slot: "head",
    rarity: "common",
    price: 20,
    level: 1,
    properties: ["Helm"],
    effects: { hp: 2, wis: -1 },
    buffs: ["Padded: +2 max HP"],
    debuffs: ["Itchy: −1 WIS"],
    lore: "Smells of the stable it came from.",
    icon: { kind: "cap", palette: {} },
  },
  {
    key: "iron-helm",
    name: "Iron Helm",
    slot: "head",
    rarity: "uncommon",
    price: 80,
    level: 3,
    properties: ["Helm"],
    effects: { ac: 1, initiative: -1 },
    buffs: ["+1 AC"],
    debuffs: ["Narrow visor: −1 initiative"],
    lore: "Standard issue for the castle guard. Dents included.",
    icon: { kind: "helm", palette: {} },
  },
  {
    key: "wizard-hat",
    name: "Wizard's Hat",
    slot: "head",
    rarity: "uncommon",
    price: 140,
    level: 5,
    properties: ["Helm", "Magic"],
    effects: { wis: 2, potionHeal: 3, ac: -1 },
    buffs: ["Arcane mind: +2 WIS", "Alchemy: potions heal 3 more"],
    debuffs: ["Floppy: −1 AC"],
    lore: "Stars stitched by hand. Makes potions taste slightly less terrible.",
    icon: { kind: "hat", palette: {} },
  },
  {
    key: "great-helm",
    name: "Knight's Great Helm",
    slot: "head",
    rarity: "rare",
    price: 180,
    level: 6,
    properties: ["Helm", "Heavy"],
    effects: { ac: 2, hp: 5, dex: -2, initiative: -1 },
    buffs: ["+2 AC", "+5 max HP"],
    debuffs: ["Heavy: −2 DEX and −1 initiative"],
    lore: "A bucket of steel with a plume on top. You will hear nothing, but nothing will hurt.",
    icon: { kind: "greathelm", palette: {} },
  },
  {
    key: "crown",
    name: "Crown of the Mountain King",
    slot: "head",
    rarity: "epic",
    price: 500,
    level: 10,
    properties: ["Helm", "Magic"],
    effects: { str: 2, dex: 2, con: 2, wis: 2, foeToHit: 1 },
    buffs: ["Royal blood: +2 to every ability"],
    debuffs: ["Everyone's target: foes get +1 to hit you"],
    lore: "Lost in the dragon's hoard for a hundred years. It still fits.",
    icon: { kind: "crown", palette: {} },
  },

  // ── Armour ────────────────────────────────────────────────────────────────
  {
    key: "padded-tunic",
    name: "Padded Tunic",
    slot: "body",
    rarity: "common",
    price: 0,
    level: 1,
    starter: true,
    armour: { base: 11, dexMax: null },
    properties: ["Light armour", "AC 11 + DEX"],
    effects: { initiative: -1 },
    buffs: ["Quilted: AC 11 + DEX"],
    debuffs: ["Stuffy: −1 initiative"],
    lore: "Several layers of cloth sewn together. Warm in winter. Warm in summer, too.",
    icon: { kind: "tunic", palette: {} },
  },
  {
    key: "leather-armour",
    name: "Leather Armour",
    slot: "body",
    rarity: "common",
    price: 60,
    level: 2,
    armour: { base: 12, dexMax: null },
    properties: ["Light armour", "AC 12 + DEX"],
    effects: { initiative: 1, hp: -1 },
    buffs: ["Supple: AC 12 + DEX, +1 initiative"],
    debuffs: ["Thin: −1 max HP"],
    lore: "Boiled leather, stitched tight. A ranger's favourite.",
    icon: { kind: "leather", palette: {} },
  },
  {
    key: "chain-mail",
    name: "Chain Mail",
    slot: "body",
    rarity: "uncommon",
    price: 150,
    level: 4,
    armour: { base: 16, dexMax: 0 },
    properties: ["Heavy armour", "AC 16"],
    effects: { initiative: -2, dex: -2 },
    buffs: ["Interlocking rings: AC 16"],
    debuffs: ["Heavy: −2 DEX and −2 initiative", "No DEX bonus to AC"],
    lore: "Thousands of iron rings. Somebody had a very long week.",
    icon: { kind: "chain", palette: {} },
  },
  {
    key: "elven-chain",
    name: "Elven Chain",
    slot: "body",
    rarity: "rare",
    price: 300,
    level: 7,
    armour: { base: 14, dexMax: 3 },
    properties: ["Medium armour", "AC 14 + DEX (max 3)"],
    effects: { initiative: 1, hp: -3 },
    buffs: ["Light as silk: AC 14 + DEX (max 3), +1 initiative"],
    debuffs: ["Delicate: −3 max HP"],
    lore: "Woven from mithril by elven smiths. It weighs less than your schoolbag.",
    icon: { kind: "elven", palette: {} },
  },
  {
    key: "plate-armour",
    name: "Plate Armour",
    slot: "body",
    rarity: "rare",
    price: 350,
    level: 8,
    armour: { base: 18, dexMax: 0 },
    properties: ["Heavy armour", "AC 18"],
    effects: { hp: 5, dex: -2, initiative: -2 },
    buffs: ["Full plate: AC 18", "+5 max HP"],
    debuffs: ["Very heavy: −2 DEX and −2 initiative"],
    lore: "Fitted by the royal armourer. You clank, but you do not fall.",
    icon: { kind: "plate", palette: {} },
  },
  {
    key: "dragonscale",
    name: "Dragonscale Armour",
    slot: "body",
    rarity: "epic",
    price: 600,
    level: 11,
    armour: { base: 17, dexMax: 2 },
    properties: ["Medium armour", "AC 17 + DEX (max 2)"],
    effects: { fireResist: true, initiative: -1 },
    buffs: ["Dragon hide: AC 17 + DEX (max 2)", "Fire resistance: half damage from fire"],
    debuffs: ["Stiff scales: −1 initiative"],
    lore: "Made from a wyrm that lost. Wear it to the Dragon's Peak and see what happens.",
    icon: { kind: "dragon", palette: {} },
  },

  // ── Trinkets ──────────────────────────────────────────────────────────────
  {
    key: "lucky-clover",
    name: "Lucky Clover",
    slot: "trinket",
    rarity: "common",
    price: 30,
    level: 1,
    properties: ["Charm"],
    effects: { toHit: 1, damage: -1 },
    buffs: ["Luck: +1 to hit"],
    debuffs: ["Fickle: −1 damage"],
    lore: "Four leaves. Probably.",
    icon: { kind: "clover", palette: {} },
  },
  {
    key: "ring-of-vigour",
    name: "Ring of Vigour",
    slot: "trinket",
    rarity: "uncommon",
    price: 80,
    level: 2,
    properties: ["Ring"],
    effects: { con: 2, hp: 4, dex: -1 },
    buffs: ["Hardy: +2 CON and +4 max HP"],
    debuffs: ["Heavy ring: −1 DEX"],
    lore: "Warm to the touch. Your heartbeat slows to match it.",
    icon: { kind: "ring", palette: { j: "#e8433a" } },
  },
  {
    key: "healers-charm",
    name: "Healer's Charm",
    slot: "trinket",
    rarity: "uncommon",
    price: 100,
    level: 3,
    properties: ["Charm"],
    effects: { potions: 1, potionHeal: 4, damage: -1 },
    buffs: ["+1 potion per battle", "Potions heal 4 more"],
    debuffs: ["Gentle: −1 damage"],
    lore: "Blessed by the village healer, who made you promise to be careful.",
    icon: { kind: "charm", palette: {} },
  },
  {
    key: "amulet-of-swiftness",
    name: "Amulet of Swiftness",
    slot: "trinket",
    rarity: "rare",
    price: 140,
    level: 4,
    properties: ["Amulet", "Magic"],
    effects: { initiative: 4, dodge: 0.1, ac: -1 },
    buffs: ["Haste: +4 initiative", "Blur: 10% chance to dodge"],
    debuffs: ["No time to brace: −1 AC"],
    lore: "The gem flickers like a hummingbird's wing.",
    icon: { kind: "amulet", palette: { j: "#3ba7ff" } },
  },
  {
    key: "owl-pendant",
    name: "Owl Pendant",
    slot: "trinket",
    rarity: "rare",
    price: 150,
    level: 5,
    properties: ["Amulet"],
    effects: { wis: 3, dodge: 0.15, str: -1 },
    buffs: ["Owl's insight: +3 WIS", "Foresight: 15% chance to dodge"],
    debuffs: ["Bookish: −1 STR"],
    lore: "The owl's eyes follow you round the room. It is on your side. Mostly.",
    icon: { kind: "owl", palette: {} },
  },
  {
    key: "berserker-ring",
    name: "Berserker's Ring",
    slot: "trinket",
    rarity: "rare",
    price: 250,
    level: 7,
    properties: ["Ring", "Cursed"],
    effects: { damage: 3, ac: -2 },
    buffs: ["Rage: +3 damage"],
    debuffs: ["Reckless: −2 AC"],
    lore: "Put it on and everything looks like a goblin.",
    icon: { kind: "ring", palette: { j: "#ff5a1f", y: "#9aa3b2", Y: "#5b6676" } },
  },
  {
    key: "phoenix-feather",
    name: "Phoenix Feather",
    slot: "trinket",
    rarity: "epic",
    price: 450,
    level: 10,
    properties: ["Relic", "Magic"],
    effects: { revive: true, hp: -2 },
    buffs: ["Rebirth: once per battle, rise again with half your HP"],
    debuffs: ["Burnt out: −2 max HP"],
    lore: "Still warm. It has done this before.",
    icon: { kind: "feather", palette: {} },
  },
];

const BY_KEY = new Map(ITEMS.map((i) => [i.key, i]));

export function itemByKey(key: string | null | undefined): Item | undefined {
  return key ? BY_KEY.get(key) : undefined;
}

export const STARTERS: Partial<Record<Slot, Item>> = Object.fromEntries(ITEMS.filter((i) => i.starter).map((i) => [i.slot, i]));

export function diceLabel(d: Dice): string {
  return `${d.count}d${d.sides}`;
}
