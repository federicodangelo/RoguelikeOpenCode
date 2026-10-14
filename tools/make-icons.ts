import { mkdirSync, writeFileSync } from "node:fs";
import { encodePNG } from "./make-tiles.ts";
import { ICON_COLS, ICON_H, ICON_NAMES, ICON_W, type IconName } from "../src/ui/icons.ts";

const GRID_W = ICON_W;
const GRID_H = ICON_H;
type RGBA = readonly [number, number, number, number];
const C = (r: number, g: number, b: number, a = 255): RGBA => [r, g, b, a];

const DARK = C(23, 21, 15);

interface IconArt {
  name: IconName;
  pal: Record<string, RGBA>;
  rows: string[];
}

const lighten = (c: RGBA, amount = 60): RGBA => [
  Math.min(255, c[0] + amount),
  Math.min(255, c[1] + amount),
  Math.min(255, c[2] + amount),
  c[3],
];

const ARTS: Record<IconName, { primary: RGBA; rows: string[] }> = {
  heart: {
    primary: C(255, 106, 106),
    rows: [".*.*.", "*+***", "*****", "*****", ".***.", "..*..", "....."],
  },
  sword: {
    primary: C(216, 216, 216),
    rows: ["..*..", "..+..", "..*..", "..*..", "*****", "..#..", "..#.."],
  },
  shield: {
    primary: C(122, 184, 255),
    rows: ["*****", "*+++*", "*+#+*", "*+#+*", "*+#+*", ".###.", "..#.."],
  },
  gold: {
    primary: C(255, 217, 122),
    rows: [".***.", "*+++*", "*+*+*", "*+++*", "*+*+*", "*+++*", ".***."],
  },
  torch: {
    primary: C(255, 154, 74),
    rows: ["..*..", ".***.", "*+*+*", ".+*+.", "..#..", "..#..", "..#.."],
  },
  light: {
    primary: C(255, 217, 122),
    rows: ["..*..", ".***.", "**+**", "*+++*", "**+**", ".***.", "..*.."],
  },
  depth: {
    primary: C(154, 149, 140),
    rows: ["..*..", "..*..", "..*..", ".*.*.", "*+++*", "*****", ".***."],
  },
  sound: {
    primary: C(154, 149, 140),
    rows: [".+.*.", "*.*.*", "*###*", "*###*", "*###*", "*.*.*", ".+.*."],
  },
  mute: {
    primary: C(255, 106, 106),
    rows: ["#*.*#", "*.*.*", "*###*", "*###*", "*###*", "*.*.*", "#*.*#"],
  },
  skill: {
    primary: C(255, 217, 122),
    rows: ["..*..", "..+..", "*****", "*+++*", ".***.", ".*.*.", "....."],
  },
  item: {
    primary: C(255, 217, 122),
    rows: ["*****", "*+++*", "*****", "*###*", "*###*", "*###*", "*****"],
  },
  monster: {
    primary: C(255, 106, 106),
    rows: [".*.*.", "*+++*", "*#*#*", "*****", "*###*", "*****", ".***."],
  },
  door: {
    primary: C(201, 138, 74),
    rows: ["*****", "*###*", "*###*", "*##+*", "*###*", "*###*", "*****"],
  },
  trap: {
    primary: C(255, 106, 106),
    rows: ["*...*", ".*.*.", "..+..", ".###.", "..+..", ".*.*.", "*...*"],
  },
  potion: {
    primary: C(155, 229, 111),
    rows: ["..*..", "..*..", ".***.", "*+*+*", "*###*", "*###*", "*****"],
  },
  stairs: {
    primary: C(255, 217, 122),
    rows: ["....*", "....+", "...**", "..+**", ".****", "*****", "*****"],
  },
  stairsUp: {
    primary: C(122, 184, 255),
    rows: ["*****", "*****", ".****", "..+**", "...**", "....+", "....*"],
  },
};

const arts: IconArt[] = ICON_NAMES.map((name) => {
  const art = ARTS[name];
  return {
    name,
    pal: { "*": art.primary, "+": lighten(art.primary), "#": DARK },
    rows: art.rows.map((row) => row.replaceAll(".", " ")),
  };
});

for (const art of arts) {
  if (art.rows.length !== GRID_H) {
    throw new Error(`${art.name}: ${art.rows.length} rows, expected ${GRID_H}`);
  }
  for (const row of art.rows) {
    if (row.length !== GRID_W) {
      throw new Error(`${art.name}: row "${row}" has ${row.length} chars, expected ${GRID_W}`);
    }
    for (const ch of row) {
      if (ch !== " " && !(ch in art.pal)) {
        throw new Error(`${art.name}: char '${ch}' not in palette`);
      }
    }
  }
}

const W = ICON_COLS * ICON_W;
const H = Math.ceil(arts.length / ICON_COLS) * ICON_H;
const data = Buffer.alloc(W * H * 4);

arts.forEach((art, i) => {
  const ox = (i % ICON_COLS) * ICON_W;
  const oy = Math.floor(i / ICON_COLS) * ICON_H;
  art.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = ch === " " ? undefined : art.pal[ch];
      if (!c) return;
      const o = ((oy + y) * W + ox + x) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = c[3];
    });
  });
});

export { arts, data as iconSheet, W as ICON_SHEET_W, H as ICON_SHEET_H };

if (import.meta.main) {
  mkdirSync("public/assets", { recursive: true });
  writeFileSync("public/assets/icons.png", encodePNG(W, H, data));
  console.log(`Wrote public/assets/icons.png (${W}x${H}, ${arts.length} icons)`);
}
