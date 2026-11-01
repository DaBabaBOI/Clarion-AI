// The overworld map, painted pixel by pixel: meadows, a river running to the
// sea, the village, the Whispering Woods, the Crystal Caves, the Ruined Keep
// and the volcano at the Dragon's Peak, joined by a dirt road.

import { REGIONS } from "./monsters";

export const MAP_W = 120;
export const MAP_H = 44;

/** Region positions on the map, in map pixels. */
export function regionPoint(key: string): { x: number; y: number } {
  const r = REGIONS.find((g) => g.key === key)!;
  return { x: r.at.x * 2, y: r.at.y * 2 };
}

const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

const C = {
  grass: "#5aa83a",
  grass2: "#4c9631",
  flowerY: "#f7e26b",
  flowerP: "#ff9ecf",
  water: "#3b7dd8",
  water2: "#2f68c0",
  foam: "#bfe3ff",
  sand: "#d8b878",
  sand2: "#c4a061",
  tree: "#2f7a3a",
  tree2: "#1f5c2a",
  treeLight: "#4e9a45",
  trunk: "#6e4423",
  rock: "#8e8e9e",
  rock2: "#6b6b7e",
  rock3: "#4a4a5e",
  snow: "#f4f4ff",
  roof: "#c0392b",
  roof2: "#8e2a20",
  wall: "#f1e3c2",
  wall2: "#c9b28a",
  door: "#5a3a1d",
  dark: "#1d1a2b",
  lava: "#ff6a00",
  lava2: "#ffcf3f",
  ash: "#3a2f3a",
  crystal: "#7fe0ff",
  crystal2: "#c07bff",
  bridge: "#a0673a",
};

export function paintWorld(): string[][] {
  const g: string[][] = Array.from({ length: MAP_H }, (_, y) =>
    Array.from({ length: MAP_W }, (_, x) => {
      const n = hash(x, y);
      if (n > 0.992) return C.flowerY;
      if (n > 0.986) return C.flowerP;
      return n > 0.5 ? C.grass : C.grass2;
    }),
  );
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) g[Math.round(y)][Math.round(x)] = c;
  };
  const sprite = (x0: number, y0: number, rows: string[], pal: Record<string, string>) =>
    rows.forEach((row, dy) => [...row].forEach((ch, dx) => ch !== "." && set(x0 + dx, y0 + dy, pal[ch])));

  // The sea, bottom left, with a ragged shore and foam.
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const shore = 13 - (MAP_H - y) * 0.9 + Math.sin(y * 0.9) * 1.5;
      if (y > 31 && x < shore) set(x, y, hash(x, y) > 0.92 ? C.foam : (x + y) % 5 ? C.water : C.water2);
      else if (y > 31 && x < shore + 1.4) set(x, y, C.sand);
    }
  }

  // The river from the northern hills down to the sea.
  for (let y = 0; y < MAP_H; y++) {
    const cx = 54 - y * 1.05 + Math.sin(y / 3.2) * 2.5;
    for (let dx = -1; dx <= 1; dx++) set(cx + dx, y, (y + dx) % 4 ? C.water : C.water2);
    if (hash(y, 7) > 0.8) set(cx, y, C.foam);
  }

  // The road, joining the regions in order.
  const points = REGIONS.map((r) => regionPoint(r.key));
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 2;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t + Math.sin(t * Math.PI * 2) * 2;
      const y = a.y + (b.y - a.y) * t;
      set(x, y, C.sand);
      set(x + 1, y, hash(Math.round(x), Math.round(y)) > 0.6 ? C.sand2 : C.sand);
    }
  }
  // A bridge where the road meets the river.
  for (let y = 22; y <= 25; y++) for (let x = 30; x <= 34; x++) if (g[y][x] === C.water || g[y][x] === C.water2) set(x, y, C.bridge);

  const TREE = [".tT.", "tTtT", "TtTt", ".ll."];
  const treePal = { t: C.tree, T: C.tree2, l: C.trunk };
  // Whispering Woods: a thick forest around its clearing.
  const woods = regionPoint("whispering-woods");
  for (let i = 0; i < 70; i++) {
    const a = hash(i, 11) * Math.PI * 2;
    const r = 4 + hash(i, 12) * 13;
    const x = Math.round(woods.x + Math.cos(a) * r * 1.4);
    const y = Math.round(woods.y + Math.sin(a) * r * 0.6);
    if (Math.abs(x - woods.x) < 3 && Math.abs(y - woods.y) < 2) continue;
    sprite(x - 2, y - 2, TREE, treePal);
  }
  // A few lone trees in the meadow.
  for (const [x, y] of [
    [4, 6],
    [10, 12],
    [26, 36],
    [44, 38],
    [52, 34],
    [70, 40],
    [92, 30],
    [100, 38],
  ])
    sprite(x, y, TREE, treePal);

  const MOUNTAIN = ["....s....", "...sSs...", "..rRsrR..", ".rRrrRrR.", "rRrRrrRrR"];
  const mountainPal = { s: C.snow, S: C.snow, r: C.rock, R: C.rock2 };
  // Northern range behind the keep and the peak.
  for (const [x, y] of [
    [60, 1],
    [68, 3],
    [88, 1],
    [96, 4],
    [112, 12],
    [116, 2],
    [74, 18],
    [62, 22],
  ])
    sprite(x, y, MOUNTAIN, mountainPal);

  // Crystal Caves: rocky hills with a dark mouth and glinting crystals.
  const caves = regionPoint("crystal-caves");
  sprite(caves.x - 7, caves.y - 6, ["....RRRRR.....", "..RRrrrrRRR...", ".RrrrrrrrrrR..", "RrrrrkkkrrrrR.", "RrrrkkkkkrrrR."], {
    r: C.rock,
    R: C.rock2,
    k: C.dark,
  });
  set(caves.x - 4, caves.y - 3, C.crystal);
  set(caves.x + 3, caves.y - 4, C.crystal2);
  set(caves.x + 5, caves.y - 2, C.crystal);

  // The village in Greenvale: three houses with red roofs.
  const vale = regionPoint("greenvale");
  const HOUSE = [".rrr.", "rRrRr", "wwwww", "wwdww"];
  const housePal = { r: C.roof, R: C.roof2, w: C.wall, d: C.door };
  sprite(vale.x - 9, vale.y - 6, HOUSE, housePal);
  sprite(vale.x - 3, vale.y - 8, HOUSE, housePal);
  sprite(vale.x + 3, vale.y - 6, HOUSE, housePal);

  // The Ruined Keep: grey towers with a broken wall.
  const keep = regionPoint("ruined-keep");
  sprite(keep.x - 6, keep.y - 7, ["R.R.....R.R", "RRR.....RRR", "RrR.R.R.RrR", "RrRRRRRRRrR", "RrrrrkrrrrR", "RrrrkkkrrRR", "RRRRkkkRR.R"], {
    r: C.rock,
    R: C.rock3,
    k: C.dark,
  });

  // Dragon's Peak: a volcano with lava running down and a plume of ash.
  const peak = regionPoint("dragons-peak");
  sprite(peak.x - 8, peak.y - 5, [".......LL.......", "......aLLa......", ".....aaLLaa.....", "....aaLlLLaa....", "...aaaLaaLLaa...", "..aaaLaaaaLaaa..", ".aaaaLaaaaaLaaa.", "aaaaaLaaaaaaaaaa"], {
    a: C.ash,
    L: C.lava,
    l: C.lava2,
  });
  for (let i = 0; i < 6; i++) set(peak.x - 1 + Math.round(Math.sin(i) * 1.5), peak.y - 6 - i, i % 2 ? C.rock2 : C.rock);
  return g;
}
