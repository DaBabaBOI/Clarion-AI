// Turn-based battles, D&D style: roll a d20 plus your bonus against the
// foe's Armour Class to hit, then roll your weapon's damage dice. A natural
// 20 (or your crit range) is a critical hit and doubles the dice.
//
// Pure functions over a BattleState so the UI can animate each new log line
// and tests can play whole battles with a seeded dice roller.

import type { Dice } from "./items";
import type { Monster } from "./monsters";
import type { HeroStats } from "./rules";

export type Rng = () => number;
export type Action = "attack" | "defend" | "potion" | "flee";
export type Outcome = "won" | "lost" | "fled";

export interface LogLine {
  id: number;
  who: "hero" | "foe" | "info";
  text: string;
  kind: "hit" | "crit" | "miss" | "heal" | "block" | "info" | "breath" | "burn";
  /** Damage or healing, for floating numbers. */
  amount?: number;
  /** Who took the damage or got the healing. */
  target?: "hero" | "foe";
  roll?: number;
}

export interface BattleState {
  monster: Monster;
  hero: HeroStats;
  heroHp: number;
  foeHp: number;
  potions: number;
  round: number;
  defending: boolean;
  foeStaggered: boolean;
  revived: boolean;
  outcome: Outcome | null;
  log: LogLine[];
}

export function d(sides: number, rng: Rng): number {
  return 1 + Math.floor(rng() * sides);
}

function rollDice(dice: Dice, rng: Rng, rerollLow = false): number {
  let total = 0;
  for (let i = 0; i < dice.count; i++) {
    let r = d(dice.sides, rng);
    if (rerollLow && r <= 2) r = d(dice.sides, rng);
    total += r;
  }
  return total;
}

function push(state: BattleState, line: Omit<LogLine, "id">) {
  state.log = [...state.log, { ...line, id: state.log.length }];
}

export function startBattle(hero: HeroStats, monster: Monster, rng: Rng): BattleState {
  const state: BattleState = {
    monster,
    hero,
    heroHp: hero.maxHp,
    foeHp: monster.hp,
    potions: hero.potions,
    round: 1,
    defending: false,
    foeStaggered: false,
    revived: false,
    outcome: null,
    log: [],
  };
  push(state, { who: "info", kind: "info", text: `A wild ${monster.name} appears!` });

  const heroInit = hero.effects.firstStrike ? 99 : d(20, rng) + hero.initiative;
  const foeInit = d(20, rng) + monster.initiative;
  if (heroInit >= foeInit) {
    push(state, { who: "info", kind: "info", text: hero.effects.firstStrike ? "First strike! You act first." : "You are quicker. Your move!" });
  } else {
    push(state, { who: "info", kind: "info", text: `The ${monster.name} moves first!` });
    foeTurn(state, rng);
    settle(state);
  }
  return state;
}

function heroAttack(state: BattleState, rng: Rng) {
  const { hero, monster } = state;
  const roll = d(20, rng);
  const crit = roll >= hero.critMin;
  if (roll === 1 || (!crit && roll + hero.toHit < monster.ac)) {
    push(state, { who: "hero", kind: "miss", text: `You swing (${roll}+${hero.toHit}) and miss.`, roll });
    return;
  }
  if (monster.parry && !crit && rng() < monster.parry) {
    push(state, { who: "foe", kind: "block", text: `The ${monster.name} parries your blow!`, roll });
    return;
  }
  const dice = crit ? { ...hero.damage, count: hero.damage.count * 2 } : hero.damage;
  let damage = Math.max(1, rollDice(dice, rng, hero.effects.rerollLow) + hero.damageBonus);
  if (monster.weakTo === hero.damage.type) damage *= 2;
  const extra = hero.effects.extra;
  const extraDamage = extra ? rollDice(crit ? { ...extra, count: extra.count * 2 } : extra, rng) : 0;
  const total = damage + extraDamage;
  state.foeHp = Math.max(0, state.foeHp - total);
  push(state, {
    who: "hero",
    kind: crit ? "crit" : "hit",
    text: `${crit ? "Critical hit! " : ""}You deal ${total} ${hero.damage.type}${extraDamage ? ` (+${extraDamage} ${extra!.type})` : ""} damage.${monster.weakTo === hero.damage.type ? " It's super effective!" : ""}`,
    amount: total,
    target: "foe",
    roll,
  });
  if (hero.effects.lifesteal) {
    const heal = Math.min(hero.maxHp - state.heroHp, Math.floor(total * hero.effects.lifesteal));
    if (heal > 0) {
      state.heroHp += heal;
      push(state, { who: "hero", kind: "heal", text: `Soul drain heals you for ${heal}.`, amount: heal, target: "hero" });
    }
  }
  if (state.foeHp > 0 && hero.effects.stagger && rng() < hero.effects.stagger) {
    state.foeStaggered = true;
    push(state, { who: "hero", kind: "info", text: `The ${monster.name} is staggered!` });
  }
}

function hurtHero(state: BattleState, amount: number) {
  state.heroHp = Math.max(0, state.heroHp - amount);
}

function foeTurn(state: BattleState, rng: Rng) {
  const { hero, monster } = state;
  if (state.foeStaggered) {
    state.foeStaggered = false;
    push(state, { who: "foe", kind: "info", text: `The ${monster.name} is still reeling and loses its turn.` });
    return;
  }

  if (monster.breath && state.round % monster.breath.every === 0) {
    const save = d(20, rng) + hero.abilities.dex.mod;
    let damage = rollDice(monster.breath.dice, rng);
    if (save >= monster.breath.save) damage = Math.floor(damage / 2);
    if (hero.effects.fireResist) damage = Math.floor(damage / 2);
    hurtHero(state, damage);
    push(state, {
      who: "foe",
      kind: "breath",
      text: `The ${monster.name} breathes fire! ${save >= monster.breath.save ? "You dive aside and " : "You "}take ${damage} fire damage.`,
      amount: damage,
      target: "hero",
    });
    return;
  }

  if (hero.effects.dodge && rng() < hero.effects.dodge) {
    push(state, { who: "hero", kind: "block", text: `You dodge the ${monster.name}'s attack!` });
    return;
  }
  const roll = d(20, rng);
  const ac = hero.ac + (state.defending ? hero.defend : 0);
  const toHit = monster.toHit + (hero.effects.foeToHit ?? 0);
  const crit = roll === 20;
  if (roll === 1 || (!crit && roll + toHit < ac)) {
    push(state, {
      who: "foe",
      kind: state.defending ? "block" : "miss",
      text: state.defending ? `Your guard holds! The ${monster.name} misses.` : `The ${monster.name} attacks and misses.`,
      roll,
    });
    return;
  }
  const dice = crit ? { ...monster.damage, count: monster.damage.count * 2 } : monster.damage;
  let damage = Math.max(1, rollDice(dice, rng) + monster.damageBonus);
  if (monster.damage.type === "fire" && hero.effects.fireResist) damage = Math.max(1, Math.floor(damage / 2));
  hurtHero(state, damage);
  push(state, {
    who: "foe",
    kind: crit ? "crit" : "hit",
    text: `${crit ? "Critical! " : ""}The ${monster.name} hits you for ${damage} ${monster.damage.type} damage.`,
    amount: damage,
    target: "hero",
    roll,
  });
  if (hero.effects.thorns && state.foeHp > 0) {
    const thorns = rollDice(hero.effects.thorns, rng);
    state.foeHp = Math.max(0, state.foeHp - thorns);
    push(state, { who: "hero", kind: "hit", text: `Your spikes deal ${thorns} back.`, amount: thorns, target: "foe" });
  }
}

/** Revive, win or lose after any damage. Returns true when the battle is over. */
function settle(state: BattleState): boolean {
  if (state.foeHp <= 0) {
    state.outcome = "won";
    push(state, { who: "info", kind: "info", text: `The ${state.monster.name} is defeated! Victory!` });
    return true;
  }
  if (state.heroHp <= 0) {
    if (state.hero.effects.revive && !state.revived) {
      state.revived = true;
      state.heroHp = Math.ceil(state.hero.maxHp / 2);
      push(state, { who: "hero", kind: "heal", text: "The Phoenix Feather blazes! You rise again.", amount: state.heroHp, target: "hero" });
      return false;
    }
    state.outcome = "lost";
    push(state, { who: "info", kind: "info", text: "You fall... The village healer patches you up. Try again!" });
    return true;
  }
  return false;
}

export function potionHeal(hero: HeroStats, rng: Rng): number {
  return rollDice({ count: 2, sides: 4 }, rng) + 2 + hero.potionHeal;
}

/** One round: the hero's action, then the foe's, then end-of-round effects. */
export function act(previous: BattleState, action: Action, rng: Rng): BattleState {
  if (previous.outcome) return previous;
  const state: BattleState = { ...previous, defending: false };
  const { hero, monster } = state;

  if (action === "flee") {
    state.outcome = "fled";
    push(state, { who: "info", kind: "info", text: "You run back to the village. Live to fight another day!" });
    return state;
  }
  if (action === "attack") heroAttack(state, rng);
  if (action === "defend") {
    state.defending = true;
    push(state, { who: "hero", kind: "info", text: `You raise your guard (+${hero.defend} AC).` });
  }
  if (action === "potion") {
    if (state.potions <= 0) {
      push(state, { who: "info", kind: "info", text: "Your potion bag is empty!" });
      return state;
    }
    const heal = Math.min(hero.maxHp - state.heroHp, potionHeal(hero, rng));
    state.potions -= 1;
    state.heroHp += heal;
    push(state, { who: "hero", kind: "heal", text: `You drink a potion and heal ${heal} HP.`, amount: heal, target: "hero" });
  }
  if (settle(state)) return state;

  foeTurn(state, rng);
  if (settle(state)) return state;

  if (hero.effects.selfBurn) {
    hurtHero(state, hero.effects.selfBurn);
    push(state, { who: "hero", kind: "burn", text: `The searing hilt burns you for ${hero.effects.selfBurn}.`, amount: hero.effects.selfBurn, target: "hero" });
    if (settle(state)) return state;
  }
  if (hero.effects.regen && state.heroHp < hero.maxHp) {
    const heal = Math.min(hero.maxHp - state.heroHp, hero.effects.regen);
    state.heroHp += heal;
    push(state, { who: "hero", kind: "heal", text: `Dawnlight heals you for ${heal}.`, amount: heal, target: "hero" });
  }
  state.round += 1;
  return { ...state, monster };
}

/** A simple player for tests: drink a potion when low, otherwise attack. */
export function autoPlay(hero: HeroStats, monster: Monster, rng: Rng): BattleState {
  let state = startBattle(hero, monster, rng);
  for (let i = 0; i < 100 && !state.outcome; i++) {
    const low = state.heroHp <= hero.maxHp * 0.35 && state.potions > 0;
    state = act(state, low ? "potion" : "attack", rng);
  }
  return state;
}
