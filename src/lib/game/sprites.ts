// Characters for Road to Glory: the hero (built from layers, so the armour,
// helm, weapon and shield they equip show on the sprite) and the monsters.

import type { Item, Slot } from "./items";
import type { SpriteKey } from "./monsters";
import { BASE_PALETTE, blank, fromMap, outlined, type Grid } from "./pixels";

// ── The hero ────────────────────────────────────────────────────────────────

// 24 × 32, facing the player. Four empty rows on top leave room for hats.
//   a/A hair  m/M skin  k eyes  t/T torso  q arms  b belt  i/I legs  z boots
const HERO = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "..........aaaa..........",
  "........aaaaaaaa........",
  ".......aaaaaaaaaa.......",
  "......aaaaaaaaaaaa......",
  "......aaAaaaaaaAaa......",
  "......aAmmmmmmmmAa......",
  "......ammmmmmmmmma......",
  "......amkkmmmmkkma......",
  "......amkemmmmkema......",
  "......ammmmmmmmmma......",
  ".......mmmmMMmmmm.......",
  "........mmmmmmmm........",
  "..........MmmM..........",
  "......qqttttttttqq......",
  ".....qqqtTttttTtqqq.....",
  ".....qqqttttttttqqq.....",
  ".....qq.tttttttt.qq.....",
  ".....qq.tttttttt.qq.....",
  ".....mm.bbbbybbb.mm.....",
  ".....mm.tttttttt.mm.....",
  "........tTttttTt........",
  "........iiiiiiii........",
  "........iii..iii........",
  "........iII..IIi........",
  ".......zzzz..zzzz.......",
  ".......ZZZZ..ZZZZ.......",
  "........................",
];

const HERO_PALETTE: Record<string, string> = {
  a: "#7a4f28",
  A: "#5a3a1d",
  m: "#f2c89b",
  M: "#d99c6c",
  k: "#2b2b3a",
  e: "#ffffff",
  b: "#6e4423",
  y: "#f4c542",
  i: "#5a4a6a",
  I: "#3e3350",
  z: "#5a3a1d",
  Z: "#3b2412",
};

/** Torso colours per body armour, plus a pattern for chain and scales. */
const BODY: Record<string, { t: string; T: string; q: string; pattern?: "dither" | "scale" | "shine" }> = {
  tunic: { t: "#d8c49a", T: "#a8925f", q: "#c9b383" },
  leather: { t: "#a0673a", T: "#6e4423", q: "#8a5a2b" },
  chain: { t: "#c9d3dd", T: "#8e9aab", q: "#a9b4c2", pattern: "dither" },
  plate: { t: "#e6ecf2", T: "#8e9aab", q: "#c9d3dd", pattern: "shine" },
  elven: { t: "#9ee6a8", T: "#3f9c56", q: "#c9f2d0", pattern: "dither" },
  dragon: { t: "#d94841", T: "#9c2a26", q: "#b8352f", pattern: "scale" },
};

// Helms are drawn over the head: '.' leaves the hero showing through.
const HELMS: Record<string, string[]> = {
  cap: [
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "..........LLLL..........",
    "........LlllllLL........",
    ".......LllllllllL.......",
    "......LllLllllLllL......",
    "......LLLLLLLLLLLL......",
  ],
  helm: [
    "........................",
    "........................",
    "........................",
    "........................",
    "..........dddd..........",
    "........dSssssSd........",
    ".......dSsessssSd.......",
    "......dSssssssssSd......",
    "......dSssssssssSd......",
    "......dSSSSSSSSSSd......",
    "......dS........Sd......",
    "......dS........Sd......",
    "......dS........Sd......",
    "......dS........Sd......",
  ],
  greathelm: [
    "...........rr...........",
    "..........rRRr..........",
    "...........rr...........",
    "........SSSSSSSS........",
    ".......SssssssssS.......",
    "......SsessssssssS......",
    "......SssssssssssS......",
    "......SssssssssssS......",
    "......SssssssssssS......",
    "......SssssssssssS......",
    "......SsssssssssdS......",
    "......SkkkkkkkkkkS......",
    "......SkkkkkkkkkkS......",
    "......SsssdsdssssS......",
    "......SsssdsdsssdS......",
    ".......SssssssssS.......",
    "........SSSSSSSS........",
  ],
  hat: [
    "............V...........",
    "...........VvV..........",
    "..........VvvV..........",
    ".........VvvyV..........",
    ".........VvvvvV.........",
    "........VvyvvvV.........",
    "........VvvvvvvV........",
    ".......VvvvvvyvvV.......",
    "....VVVVVVVVVVVVVVVV....",
    "...VvvvvvvvvvvvvvvvvV...",
    "....VVVVVVVVVVVVVVVV....",
  ],
  crown: [
    "........................",
    "........................",
    ".......y...y....y.......",
    ".......yy.yjy..yy.......",
    ".......yyyyyyyyyy.......",
    ".......yjyyuyyyjy.......",
    ".......YYYYYYYYYY.......",
  ],
};

const HELM_PALETTE: Record<string, string> = {
  ...BASE_PALETTE,
  // Lighter than the hero's hair so the cap stands out.
  L: "#8a5320",
  l: "#c8894a",
};

/** A weapon held upright in the hero's right hand (the left of the picture). */
function drawWeapon(g: Grid, item: Item, pal: Record<string, string>) {
  const put = (x: number, y: number, c: string | undefined) => {
    if (c && y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c;
  };
  const hx = 5; // hand column
  const hy = 23; // hand row
  const kind = item.icon.kind;
  if (kind === "bow") {
    for (let y = hy - 10; y <= hy + 4; y++) {
      const bend = Math.round(2 - (2 * Math.abs(y - (hy - 3))) / 7);
      put(hx - 2 - bend, y, y % 3 ? pal.w : pal.W);
    }
    for (let y = hy - 9; y <= hy + 3; y++) put(hx, y, pal.c);
    return;
  }
  if (kind === "axe" || kind === "hammer") {
    for (let y = hy - 9; y <= hy + 2; y++) put(hx, y, y % 2 ? pal.h : pal.H);
    const head = kind === "axe" ? ["sss.", "ssss", "sss.", ".s.."] : ["dSSd", "SssS", "SssS", "dSSd"];
    head.forEach((row, dy) =>
      [...row].forEach((ch, dx) => put(hx - 2 + dx + (kind === "axe" ? 0 : -0), hy - 11 + dy, ch === "." ? undefined : pal[ch])),
    );
    return;
  }
  const lengths: Partial<Record<string, number>> = { rapier: 11, greatsword: 12, dagger: 5 };
  const len = item.key === "shortsword" ? 7 : item.key === "training-sword" ? 8 : (lengths[kind] ?? 10);
  const wide = kind === "greatsword";
  for (let i = 1; i <= len; i++) {
    const y = hy - 2 - i;
    put(hx, y, i === len ? pal.e : pal.b);
    if (kind !== "rapier") put(hx + 1, y, i === len ? undefined : pal.B);
    if (wide) put(hx - 1, y, i === len ? undefined : pal.e);
  }
  for (let dx = -2; dx <= 2; dx++) put(hx + dx + (kind === "rapier" ? 0 : 0), hy - 2, pal.g);
  put(hx, hy - 1, pal.h);
  put(hx, hy + 1, pal.p);
}

const SHIELDS: Record<string, string[]> = {
  buckler: [".WWW.", "WwWwW", "WwswW", "WwWwW", ".WWW."],
  kite: ["SSSSS", "SuyuS", "SyyyS", "SuyuS", ".SuS.", "..S.."],
  spiked: ["..d..", ".SSS.", "dSrSd", ".SSS.", "..d.."],
  tower: ["SSSSSS", "SsddsS", "SdrrdS", "SdrrdS", "SsddsS", "SssssS", "SSSSSS"],
};

function drawShield(g: Grid, item: Item, pal: Record<string, string>) {
  const map = SHIELDS[item.icon.kind];
  if (!map) return;
  const x0 = 16;
  const y0 = item.icon.kind === "tower" ? 18 : 19;
  map.forEach((row, dy) =>
    [...row].forEach((ch, dx) => {
      if (ch !== ".") g[y0 + dy][x0 + dx] = pal[ch];
    }),
  );
}

const heroCache = new Map<string, Grid>();

export function heroSprite(items: Partial<Record<Slot, Item>>): Grid {
  const key = Object.values(items)
    .map((i) => i?.key ?? "-")
    .join("|");
  const cached = heroCache.get(key);
  if (cached) return cached;

  const body = BODY[items.body?.icon.kind ?? "tunic"] ?? BODY.tunic;
  const g = blank(24, 32);
  HERO.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      if (ch === "t" || ch === "T" || ch === "q") {
        let c = body[ch];
        if (ch === "t" && body.pattern === "dither" && (x + y) % 2) c = body.T;
        if (ch === "t" && body.pattern === "scale" && x % 3 === y % 2) c = body.T;
        if (ch === "t" && body.pattern === "shine" && x === 10 && y < 23) c = "#ffffff";
        g[y][x] = c;
        return;
      }
      g[y][x] = HERO_PALETTE[ch] ?? null;
    }),
  );

  const head = items.head?.icon.kind;
  if (head && HELMS[head]) {
    const pal = { ...HELM_PALETTE, ...(items.head!.icon.palette as Record<string, string>) };
    HELMS[head].forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch !== ".") g[y][x] = pal[ch] ?? g[y][x];
      }),
    );
  }

  if (items.trinket) {
    const gem = (items.trinket.icon.palette as Record<string, string> | undefined)?.j ?? "#f4c542";
    g[18][11] = "#f4c542";
    g[18][12] = gem;
  }
  if (items.offhand) drawShield(g, items.offhand, { ...BASE_PALETTE, ...(items.offhand.icon.palette as Record<string, string>) });
  if (items.weapon) drawWeapon(g, items.weapon, { ...BASE_PALETTE, ...(items.weapon.icon.palette as Record<string, string>) });

  const out = outlined(g);
  heroCache.set(key, out);
  return out;
}

// ── Monsters ────────────────────────────────────────────────────────────────

const MONSTER_MAPS: Record<SpriteKey, { rows: string[]; palette: Record<string, string> }> = {
  slime: {
    palette: { s: "#5fd36b", S: "#2f8a3a", h: "#d9ffd9", k: "#1d1a2b", e: "#ffffff" },
    rows: [
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "...........ss...........",
      ".........ssssss.........",
      "........sshhssss........",
      ".......sshhsssssS.......",
      "......sshssssssssS......",
      ".....ssssssssssssSS.....",
      ".....sssskesssskeSS.....",
      "....ssssskksssskksSS....",
      "....sssssssssssssssS....",
      "...ssssssssssssssssSS...",
      "...ssssssskkkksssssSS...",
      "..sssssssssssssssssSSS..",
      "..SsssssssssssssssSSSS..",
      "...SSSSSSSSSSSSSSSSSS...",
      "........................",
      "........................",
      "........................",
      "........................",
    ],
  },
  goblin: {
    palette: { g: "#7cc44f", G: "#4f8a2f", k: "#1d1a2b", w: "#ffef5a", c: "#8a5a2b", C: "#5a3a1d", y: "#6e4423", d: "#c9d3dd", D: "#8e9aab", L: "#3b2412" },
    rows: [
      "........................",
      "........................",
      "........................",
      "..........yyyy..........",
      ".........yyyyyy.........",
      "...g.....gggggg.....g...",
      "...gg...gggggggg...gg...",
      "....gggggggggggggggg....",
      ".....gggwkggggwkggg.....",
      "......gggggggggggg......",
      "......ggGkkkkkkGgg......",
      ".......gggGGGGggg.......",
      "........cccccccc........",
      "......cccccccccccc......",
      ".....gcccCccccCcccg.....",
      ".....gccccccccccccg..d..",
      "....gg.ccLLLLLLcc.gg.d..",
      "....g..cccccccccc..gdd..",
      "........cccccccc...gD...",
      ".......CCC....CCC.......",
      ".......ggg....ggg.......",
      "......GGGG....GGGG......",
      "........................",
      "........................",
    ],
  },
  wolf: {
    palette: { w: "#9aa3b2", W: "#5f6878", r: "#ff4d4d", e: "#ffffff", k: "#1d1a2b" },
    rows: [
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "....W..W................",
      "...WwwWwW...............",
      "..WwwwwwwW..............",
      ".WwwrwwwwwW.............",
      "WwwwwwwwwwwW...........W",
      "kwwwwwwwwwwwwwwwwwwww.WW",
      "Wewwwwwwwwwwwwwwwwwwwww.",
      ".eWWwwwwwwwwwwwwwwwwwW..",
      "...WwwwwwwwwwwwwwwwwwW..",
      "....WwwwwwwwwwwwwwwwW...",
      "....WwwwWWWWWWWWwwwwW...",
      "....Www........WwwW.....",
      "....ww.........ww.ww....",
      "...WWW........WW..WW....",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
    ],
  },
  skeleton: {
    palette: { b: "#efe9da", B: "#bdb4a0", k: "#1d1a2b", d: "#c9d3dd" },
    rows: [
      "........................",
      "..........rr............",
      ".........rrr............",
      ".........aaaaaa.........",
      "........aBbbbbBa........",
      "........bbbbbbbb........",
      "........bkkbbkkb........",
      "........bkkbbkkb........",
      "........bbbbkbbb........",
      ".........bkbkbkb........",
      "..........bbbbb.........",
      "...........bb...........",
      "......aabbbbbbbbaa......",
      ".....ab.b.bbbb.b.ba.....",
      ".....b..bbbbbbbb..b.....",
      ".....b..b.bbbb.b..b.....",
      ".....b...bbbbbb...b.....",
      "....dd....bbbb....b.....",
      "....d....bb..bb.........",
      "...d.....b....b.........",
      "..d......b....b.........",
      ".........b....b.........",
      "........bb....bb........",
      "........................",
    ],
  },
  knight: {
    palette: { k: "#2b2b3a", K: "#4a4a5e", v: "#c07bff", V: "#5b2a8c", s: "#c9d3dd", m: "#4a4a5e" },
    rows: [
      "........................",
      "...........v............",
      "..........vvv...........",
      ".........KKKKK..........",
      "........KkkkkkK.........",
      "........KkvkvkK.........",
      "........KkkkkkK.........",
      ".........KkkkK..........",
      "......KKKkkkkkKKK.......",
      ".....KkkKkkkkkKkkK......",
      ".....KkVKkkkkkKVkK.....s",
      ".....KkVVKkkkKVVkK....s.",
      ".....KkVVKKKKKVVkK...s..",
      "......kVVkkkkkVVk...s...",
      "......KVVkkvkkVVK..s....",
      "......KVVkkkkkVVKms.....",
      "......KVVKkkkKVVKm......",
      ".......VVkk.kkVV........",
      ".......VVkk.kkVV........",
      "........Kkk.kkK.........",
      ".......KKKK.KKKK........",
      "........................",
      "........................",
      "........................",
    ],
  },
  dragon: {
    palette: { r: "#d94841", R: "#9c2a26", y: "#ffcf3f", w: "#b8352f", W: "#6e1418", e: "#ffef5a", J: "#ffffff", k: "#1d1a2b" },
    rows: [
      "................................",
      "..............W.........W.......",
      ".............WW........WWW......",
      "............WwW.......WwwWW.....",
      "...........WwwW......WwwwwWW....",
      "..RR......WwwwW.....WwwwwwwWW...",
      ".RrrR....WwwwwW....WwwwwwwwwWW..",
      "RrerrR..WwwwwwW...WwwwwwwwwwwW..",
      "rrrrrrR.WwwwwwwWWWwwwwwwwwwwW...",
      "rkJrJrrRWwwwwwrrrrrwwwwwwwWW....",
      ".rrrrrrrRRwwrrrrrrrrrwwwWW......",
      "..RRrrrrrrrrrrrrrrrrrrrrR.......",
      "....RrrrryyyyrrrrrrrrrrrrR......",
      ".....RrryyyyyyrrrrrrrrrrrrR.....",
      ".....RrryyyyyyrrrrrrrrrrrrrR....",
      "......RrryyyyrrrrrrrrrrrrrrrR...",
      "......RRrrrrrrrrrRRrrrrRRrrrrR..",
      ".......Rrr.RrrR...RrrR..RRrrrrR.",
      ".......Rr...Rr.....Rr.....RRrrR.",
      "......kRR..kRR....kRR.......RRrR",
      ".............................RRr",
      "..............................RR",
      "................................",
      "................................",
    ],
  },
};

const monsterCache = new Map<string, Grid>();

export function monsterSprite(sprite: SpriteKey, overrides?: Record<string, string>): Grid {
  const key = sprite + JSON.stringify(overrides ?? {});
  const cached = monsterCache.get(key);
  if (cached) return cached;
  const { rows, palette } = MONSTER_MAPS[sprite];
  const out = outlined(fromMap(rows, { ...palette, ...overrides }));
  monsterCache.set(key, out);
  return out;
}
