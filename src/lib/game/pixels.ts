// Pixel art for Road to Glory. Every picture is a small grid of colours drawn
// as crisp SVG squares (see components/game/pixel-art.tsx), so it stays sharp
// at any size. Item icons are 16×16 with a one pixel dark outline added
// automatically; swords are drawn along the diagonal from a few numbers so
// every blade in the armoury shares one shape.

import type { Item } from "./items";

export type Grid = (string | null)[][];

export const OUTLINE = "#1d1a2b";

export const BASE_PALETTE: Record<string, string> = {
  // blades and steel
  e: "#ffffff",
  b: "#dfe6ee",
  B: "#8e9aab",
  s: "#c9d3dd",
  S: "#8e9aab",
  d: "#5b6676",
  // gold
  g: "#f4c542",
  y: "#f4c542",
  Y: "#c98f1e",
  p: "#f4c542",
  // wood and leather
  h: "#7a4f28",
  H: "#5a3a1d",
  w: "#c08a50",
  W: "#8a5a2b",
  l: "#a0673a",
  L: "#6e4423",
  // cloth
  c: "#d8c49a",
  C: "#a8925f",
  // colours
  r: "#d94841",
  R: "#9c2a26",
  n: "#5fd36b",
  N: "#2f8a3a",
  u: "#4a8fe0",
  U: "#2a5aa0",
  v: "#9b6bd6",
  V: "#5b3a8c",
  o: "#ff8a2a",
  O: "#c2410c",
  j: "#e8433a",
  J: "#ffffff",
  k: "#2b2b3a",
  m: "#f2c89b",
};

export function blank(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array<string | null>(w).fill(null));
}

export function fromMap(rows: string[], palette: Record<string, string>): Grid {
  return rows.map((row) => [...row].map((ch) => (ch === "." || ch === " " ? null : (palette[ch] ?? null))));
}

/** Dark outline around every filled shape. */
export function outlined(grid: Grid, color = OUTLINE): Grid {
  const h = grid.length;
  const w = grid[0].length;
  const out = grid.map((row) => [...row]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x]) continue;
      const near = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([nx, ny]) => grid[ny]?.[nx]);
      if (near) out[y][x] = color;
    }
  }
  return out;
}

// ── Swords ──────────────────────────────────────────────────────────────────

/**
 * A sword along the diagonal, tip to the top right. len is the blade length,
 * guard the cross-guard's reach on each side, grip the handle length.
 */
function sword(
  pal: Record<string, string>,
  { len, guard, grip, width }: { len: number; guard: number; grip: number; width: 1 | 2 | 3 },
): Grid {
  const g = blank(16, 16);
  const span = len + grip + 3;
  const x0 = Math.floor((16 - span) / 2);
  const cx = x0 + grip + 1;
  const cy = 16 - x0 - grip - 2;
  const put = (x: number, y: number, key: string) => {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = pal[key];
  };
  for (let t = 1; t <= len; t++) {
    const x = cx + t;
    const y = cy - t;
    if (t === len) {
      put(x, y, "e");
      continue;
    }
    if (width === 1) put(x, y, "b");
    if (width === 2) {
      put(x, y, "b");
      put(x + 1, y, "B");
    }
    if (width === 3) {
      put(x - 1, y, "e");
      put(x, y, "b");
      put(x + 1, y, "B");
    }
  }
  for (let k = -guard; k <= guard; k++) put(cx + k, cy + k, k === 0 ? "g" : "g");
  for (let t = 1; t <= grip; t++) put(cx - t, cy + t, t % 2 ? "h" : "H");
  put(cx - grip - 1, cy + grip + 1, "p");
  put(cx - grip - 2, cy + grip + 1, "p");
  put(cx - grip - 1, cy + grip + 2, "p");
  return g;
}

// ── Hand-drawn icons (fill colours only; the outline is added) ──────────────

const MAPS: Record<string, string[]> = {
  axe: [
    "................",
    "................",
    "..........ss....",
    ".........sssS...",
    "........ssssSS..",
    ".......dhsssSS..",
    "......ddh.sSS...",
    ".......h...S....",
    "......h.........",
    ".....H..........",
    "....h...........",
    "...H............",
    "..h.............",
    "................",
    "................",
    "................",
  ],
  hammer: [
    "................",
    "................",
    ".........dd.....",
    "........dSSd....",
    ".......dSssSd...",
    "......dSsssSd...",
    ".......dSsSdd...",
    "......h.dSdd....",
    ".....H...dd.....",
    "....h...........",
    "...H............",
    "..h.............",
    ".y..............",
    "................",
    "................",
    "................",
  ],
  bow: [
    "................",
    ".........wW.....",
    ".......ww..W....",
    "......w.....c...",
    ".....w.....c....",
    "....w.....c.....",
    "....w....c......",
    "...w....c.......",
    "...w...c........",
    "...w..c.........",
    "...wlc..........",
    "...lc...........",
    "...wc...........",
    "...w............",
    "....W...........",
    "................",
  ],
  buckler: [
    "................",
    "................",
    ".....WWWWW......",
    "....WwwwwwW.....",
    "...WwwWwWwwW....",
    "...WwWwwwWwW....",
    "...WwwwsswwW....",
    "...WwWwsswWW....",
    "...WwwwwwwwW....",
    "...WwWwwwWwW....",
    "....WwwWwwW.....",
    ".....WWWWW......",
    "................",
    "................",
    "................",
    "................",
  ].map((r) => " " + r.slice(0, 15)),
  kite: [
    "................",
    "...SSSSSSSSSS...",
    "...SuuuuuuuuS...",
    "...SuuuyyuuuS...",
    "...SuuyyyyuuS...",
    "...SuuuyyuuuS...",
    "...SuuuyyuuuS...",
    "....SuuyyuuS....",
    "....SuuuuuuS....",
    ".....SuuuuS.....",
    ".....SuuuuS.....",
    "......SuuS......",
    "......SuuS......",
    ".......SS.......",
    "................",
    "................",
  ],
  tower: [
    "................",
    "..SSSSSSSSSSSS..",
    "..SsssssssssdS..",
    "..SsddddddddsS..",
    "..SsdssssssdsS..",
    "..SsdsrrrrsdsS..",
    "..SsdsrrrrsdsS..",
    "..SsdssrrssdsS..",
    "..SsdssrrssdsS..",
    "..SsdssssssdsS..",
    "..SsddddddddsS..",
    "..SsssssssssdS..",
    "..SdddddddddddS.",
    "..SSSSSSSSSSSS..",
    "................",
    "................",
  ].map((r) => r.slice(0, 16)),
  spiked: [
    "................",
    ".......d........",
    "....SSSdSSS.....",
    "...SsssssssS....",
    "..SsdSSSSSdsS...",
    "..SsSrrrrrSsS...",
    "ddSsSrrdrrSsSdd.",
    "..SsSrdddrSsS...",
    "..SsSrrdrrSsS...",
    "..SsdSSSSSdsS...",
    "...SsssssssS....",
    "....SSSdSSS.....",
    ".......d........",
    "................",
    "................",
    "................",
  ],
  cap: [
    "................",
    "................",
    "................",
    "................",
    ".....LLLLL......",
    "....LlllllL.....",
    "...LllLlLllL....",
    "...LlllllllL....",
    "...LlLlllLlL....",
    "..LLLLLLLLLLL...",
    "..lllllllllll...",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  helm: [
    "................",
    "................",
    "......dd........",
    ".....dSSd.......",
    "....dSsssd......",
    "...dSssssSd.....",
    "...dSsesssd.....",
    "...dSssssSd.....",
    "...dkkkkkkd.....",
    "...dSsdsSSd.....",
    "...dSsdssSd.....",
    "...dSSdSSSd.....",
    "....ddddddd.....",
    "................",
    "................",
    "................",
  ].map((r) => " " + r.slice(0, 15)),
  greathelm: [
    ".......rr.......",
    "......rRRr......",
    ".......rr.......",
    "....SSSSSSSS....",
    "...SsssssssdS...",
    "...SsesssssdS...",
    "...SkkkkkkkkS...",
    "...SsssdsssdS...",
    "...SsskdkssdS...",
    "...SsssdsssdS...",
    "...SsskdkssdS...",
    "...SsssssssdS...",
    "...SddddddddS...",
    "....SSSSSSSS....",
    "................",
    "................",
  ],
  hat: [
    "................",
    ".........V......",
    "........VvV.....",
    ".......VvvV.....",
    "......VvvvV.....",
    "......VvyvV.....",
    ".....VvvvvvV....",
    ".....VvvvyvV....",
    "....VvvvvvvvV...",
    "....VyvvvvvvV...",
    "...VVVVVVVVVVV..",
    ".VVvvvvvvvvvvvVV",
    "..VVVVVVVVVVVVV.",
    "................",
    "................",
    "................",
  ],
  crown: [
    "................",
    "................",
    "................",
    "...y...y...y....",
    "...yy.yjy.yy....",
    "...yyyyyyyyy....",
    "...yjyyuyyjy....",
    "...yyyyyyyyy....",
    "...YYYYYYYYY....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ].map((r) => " " + r.slice(0, 15)),
  tunic: [
    "................",
    "................",
    "....CC....CC....",
    "...CccC..CccC...",
    "..CcccccccccC...",
    "..CccCccccCcC...",
    "..CcC.cccc.CcC..",
    "..CC..cCcc..CC..",
    "......cccc......",
    "......ccCc......",
    "......cccc......",
    "......LLLL......",
    "......cccc......",
    "......CCCC......",
    "................",
    "................",
  ],
  leather: [
    "................",
    "................",
    "....LL....LL....",
    "...LllL..LllL...",
    "..LlllllllllL...",
    "..LllLlyylLlL...",
    "..LlL.llll.LlL..",
    "..LL..lLLl..LL..",
    "......llll......",
    "......lLLl......",
    "......llll......",
    "......YyyY......",
    "......llll......",
    "......LLLL......",
    "................",
    "................",
  ],
  chain: [
    "................",
    "................",
    "....dd....dd....",
    "...dSsd..dsSd...",
    "..dSsSsSsSsSd...",
    "..dsSsSsSsSsd...",
    "..dSd.sSsS.dSd..",
    "..dd..SsSs..dd..",
    "......sSsS......",
    "......SsSs......",
    "......sSsS......",
    "......LLLL......",
    "......SsSs......",
    "......dddd......",
    "................",
    "................",
  ],
  plate: [
    "................",
    "................",
    "...SSS....SSS...",
    "..SsesS..SsesS..",
    "..SsssSSSSsssS..",
    "..SdSsseessSdS..",
    "..SdS.ssss.SdS..",
    "..SS..sees..SS..",
    "......ssss......",
    "......dSSd......",
    "......ssss......",
    "......yYYy......",
    "......ssss......",
    "......dddd......",
    "................",
    "................",
  ],
  elven: [
    "................",
    "................",
    "....NN....NN....",
    "...NbbN..NbbN...",
    "..NbnbnbnbnbN...",
    "..NnbnbnbnbnN...",
    "..NbN.bnbn.NbN..",
    "..NN..nbnb..NN..",
    "......bnbn......",
    "......nbnb......",
    "......bnbn......",
    "......yyyy......",
    "......nbnb......",
    "......NNNN......",
    "................",
    "................",
  ],
  dragon: [
    "................",
    "................",
    "...RR......RR...",
    "..RrrR....RrrR..",
    "..RrRrRrRrRrrR..",
    "..RrrRrrRrrRrR..",
    "..RrR.rRrR.RrR..",
    "..RR..RrRr..RR..",
    "......rRrR......",
    "......RrRr......",
    "......rRrR......",
    "......yyyy......",
    "......RrRr......",
    "......RRRR......",
    "................",
    "................",
  ],
  clover: [
    "................",
    "................",
    "................",
    ".....nn.nn......",
    "....nnnnnnn.....",
    "....nnnNnnn.....",
    ".....nnNnn......",
    "..nnnnNNNnnnn...",
    ".nnnnNNnNNnnnn..",
    "..nnnnnNnnnnn...",
    ".....nnNnn......",
    "....nnnNnnn.....",
    ".....nn.Nn......",
    ".........N......",
    "..........N.....",
    "................",
  ],
  ring: [
    "................",
    "................",
    "................",
    ".......JJ.......",
    "......jjjj......",
    ".....yjjjjy.....",
    "....yyyjjyyy....",
    "...yY......Yy...",
    "...yY......Yy...",
    "...yY......Yy...",
    "...yyY....Yyy...",
    "....yyYYYYyy....",
    ".....yyyyyy.....",
    "................",
    "................",
    "................",
  ],
  amulet: [
    "................",
    "..Y.........Y...",
    "...Y.......Y....",
    "....Y.....Y.....",
    ".....Y...Y......",
    "......Y.Y.......",
    "......yyy.......",
    ".....yjjjy......",
    "....yjJjjjy.....",
    "....yjjjjjy.....",
    "....yjjjjjy.....",
    ".....yjjjy......",
    "......yyy.......",
    "................",
    "................",
    "................",
  ].map((r) => " " + r.slice(0, 15)),
  charm: [
    "................",
    "................",
    ".......Y........",
    "......Y.Y.......",
    "....rr...rr.....",
    "...rJrr.rrrr....",
    "...rrrrrrrrR....",
    "...rrrrrrrrR....",
    "....rrrrrrR.....",
    ".....rrrrR......",
    "......rrR.......",
    ".......R........",
    "................",
    "................",
    "................",
    "................",
  ].map((r) => " " + r.slice(0, 15)),
  owl: [
    "................",
    "................",
    "....l.....l.....",
    "....ll...ll.....",
    "....lllllll.....",
    "...lyylllyyl....",
    "...ykyl.lyky....",
    "...lyylolyyl....",
    "...lllloollll...",
    "...lclcllclcl...",
    "...llclclclll...",
    "....lllllll.....",
    ".....y...y......",
    "................",
    "................",
    "................",
  ],
  feather: [
    "................",
    "..........oo....",
    ".........oyyo...",
    "........oyyyO...",
    ".......oyyyoO...",
    "......oyyyoO....",
    ".....oyyyoO.....",
    "....orrroO......",
    "....rrroO.......",
    "...rrrOO........",
    "...rROO.........",
    "..rRO...........",
    "..Y.............",
    ".Y..............",
    "................",
    "................",
  ],
};

const SWORDS: Partial<Record<string, { len: number; guard: number; grip: number; width: 1 | 2 | 3 }>> = {
  "training-sword": { len: 7, guard: 1, grip: 2, width: 2 },
  shortsword: { len: 6, guard: 2, grip: 2, width: 2 },
  longsword: { len: 9, guard: 2, grip: 2, width: 2 },
  darksword: { len: 9, guard: 3, grip: 2, width: 2 },
  "flame-tongue": { len: 9, guard: 2, grip: 2, width: 2 },
  sunblade: { len: 9, guard: 3, grip: 2, width: 2 },
};

const iconCache = new Map<string, Grid>();

export function itemIcon(item: Item): Grid {
  const cached = iconCache.get(item.key);
  if (cached) return cached;
  const pal = { ...BASE_PALETTE, ...(item.icon.palette as Record<string, string>) };
  const { kind } = item.icon;
  let grid: Grid;
  if (kind === "sword") grid = sword(pal, SWORDS[item.key] ?? { len: 8, guard: 2, grip: 2, width: 2 });
  else if (kind === "dagger") grid = sword(pal, { len: 4, guard: 1, grip: 1, width: 2 });
  else if (kind === "rapier") grid = sword(pal, { len: 10, guard: 1, grip: 2, width: 1 });
  else if (kind === "greatsword") grid = sword(pal, { len: 9, guard: 3, grip: 3, width: 3 });
  else grid = fromMap(MAPS[kind], pal);
  const out = outlined(grid);
  iconCache.set(item.key, out);
  return out;
}
