import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const TILE = 32;
const GRID = 16;
const SCALE = TILE / GRID;
const COLS = 8;

type RGBA = readonly [number, number, number, number];
const C = (r: number, g: number, b: number, a = 255): RGBA => [r, g, b, a];

interface TileArt {
  name: string;
  pal: Record<string, RGBA>;
  rows: string[];
}

const rep = (n: number, ch: string) => ch.repeat(n);
const line = (...parts: string[]) => parts.join("");

const arts: TileArt[] = [
  {
    name: "floor",
    pal: { ".": C(46, 42, 38), ",": C(56, 51, 45), ":": C(38, 34, 31) },
    rows: [
      "................",
      "..,.....,.......",
      "......,.....,...",
      "...:............",
      ",....,......,...",
      "................",
      "....,....,......",
      "........:.......",
      "..,.....,...,...",
      "......,.........",
      "....:...........",
      ",....,....,.....",
      "................",
      "....,......,....",
      ".......:........",
      "..,....,........",
    ],
  },
  {
    name: "wall",
    pal: {
      H: C(132, 138, 148),
      B: C(104, 110, 120),
      b: C(82, 88, 97),
      M: C(45, 48, 54),
      D: C(59, 63, 69),
    },
    rows: [
      rep(16, "H"),
      rep(16, "B"),
      line(rep(4, "B"), "M", rep(5, "B"), "M", rep(5, "B")),
      line("Bb", rep(2, "B"), "M", rep(5, "B"), "M", rep(5, "B")),
      rep(16, "M"),
      line(rep(3, "B"), "M", rep(6, "B"), "M", rep(5, "B")),
      line(rep(3, "B"), "M", rep(6, "B"), "M", rep(5, "B")),
      line(rep(3, "B"), "M", rep(6, "B"), "M", rep(5, "B")),
      rep(16, "M"),
      line(rep(6, "B"), "M", rep(6, "B"), "M", rep(2, "B")),
      line(rep(6, "B"), "M", rep(6, "B"), "M", rep(2, "B")),
      line("Bb", rep(4, "B"), "M", rep(5, "B"), "M", rep(3, "B")),
      rep(16, "M"),
      line(rep(3, "B"), "M", rep(6, "B"), "M", rep(5, "B")),
      line(rep(3, "B"), "M", rep(6, "B"), "M", rep(5, "B")),
      rep(16, "D"),
    ],
  },
  {
    name: "stairs",
    pal: { s: C(222, 186, 72), d: C(170, 136, 46) },
    rows: [
      rep(16, "s"),
      rep(16, "s"),
      rep(16, "d"),
      rep(16, "d"),
      line(rep(12, "s"), rep(4, " ")),
      line(rep(12, "s"), rep(4, " ")),
      line(rep(12, "d"), rep(4, " ")),
      line(rep(12, "d"), rep(4, " ")),
      line(rep(10, "s"), rep(6, " ")),
      line(rep(10, "s"), rep(6, " ")),
      line(rep(10, "d"), rep(6, " ")),
      line(rep(10, "d"), rep(6, " ")),
      line(rep(8, "s"), rep(8, " ")),
      line(rep(8, "s"), rep(8, " ")),
      line(rep(8, "d"), rep(8, " ")),
      line(rep(8, "d"), rep(8, " ")),
    ],
  },
  {
    name: "doorClosed",
    pal: {
      F: C(72, 46, 22),
      L: C(112, 72, 34),
      P: C(142, 94, 46),
      H: C(226, 188, 72),
      D: C(48, 30, 14),
    },
    rows: [
      rep(16, "F"),
      line("F", rep(14, "L"), "F"),
      line("F", "L", rep(12, "P"), "L", "F"),
      line("F", "L", rep(12, "P"), "L", "F"),
      line("F", "L", rep(12, "P"), "L", "F"),
      line("F", "L", rep(12, "P"), "L", "F"),
      line("F", "L", rep(12, "P"), "L", "F"),
      line("F", "L", rep(8, "P"), rep(2, "H"), rep(2, "P"), "L", "F"),
      line("F", "L", rep(8, "P"), rep(2, "H"), rep(2, "P"), "L", "F"),
      line("F", "L", rep(12, "P"), "L", "F"),
      line("F", "L", rep(12, "P"), "L", "F"),
      line("F", "L", rep(12, "P"), "L", "F"),
      line("F", "L", rep(12, "P"), "L", "F"),
      line("F", "L", rep(12, "P"), "L", "F"),
      line("F", rep(14, "D"), "F"),
      rep(16, "F"),
    ],
  },
  {
    name: "doorOpen",
    pal: {
      F: C(72, 46, 22),
      L: C(112, 72, 34),
      P: C(142, 94, 46),
      H: C(226, 188, 72),
      D: C(48, 30, 14),
    },
    rows: [
      line(rep(8, "F"), rep(8, " ")),
      line("F", rep(6, "L"), "F", rep(8, " ")),
      line("F", rep(6, "P"), "F", rep(8, " ")),
      line("F", rep(6, "P"), "F", rep(8, " ")),
      line("F", rep(6, "P"), "F", rep(8, " ")),
      line("F", rep(6, "P"), "F", rep(8, " ")),
      line("F", rep(6, "P"), "F", rep(8, " ")),
      line("F", rep(4, "P"), rep(2, "H"), "F", rep(8, " ")),
      line("F", rep(4, "P"), rep(2, "H"), "F", rep(8, " ")),
      line("F", rep(6, "P"), "F", rep(8, " ")),
      line("F", rep(6, "P"), "F", rep(8, " ")),
      line("F", rep(6, "P"), "F", rep(8, " ")),
      line("F", rep(6, "P"), "F", rep(8, " ")),
      line("F", rep(6, "P"), "F", rep(8, " ")),
      line("F", rep(6, "D"), "F", rep(8, " ")),
      line(rep(8, "F"), rep(8, " ")),
    ],
  },
  {
    name: "player",
    pal: {
      H: C(92, 62, 38),
      S: C(232, 185, 138),
      o: C(26, 26, 26),
      T: C(86, 134, 214),
      t: C(62, 100, 164),
      B: C(112, 78, 48),
    },
    rows: [
      "....HHHHHH......",
      "...HHHHHHHH.....",
      "...HSSSSSSH.....",
      "...HSoSSoSH.....",
      "....SSSSSS......",
      ".....SSSS.......",
      "...TTTTTTTTTT...",
      "..TTTTTTTTTTTT..",
      ".TT.TTTTTT.TT...",
      ".TS.TTTTTT.ST...",
      "....TTTTTT......",
      "....tTTTTt......",
      "....TT..TT......",
      "....TT..TT......",
      "...BB....BB.....",
      "................",
    ],
  },
  {
    name: "rat",
    pal: {
      D: C(142, 110, 78),
      d: C(108, 80, 56),
      E: C(217, 154, 138),
      o: C(26, 26, 26),
      T: C(217, 154, 138),
    },
    rows: [
      "................",
      "................",
      "................",
      "......EE........",
      ".....EEDDD...TT.",
      "....DDDDDDD..T..",
      "...DDDDDDDDDT...",
      "...DDDDDDDDDD...",
      "...DoDDDDDDD....",
      "....DDDDDDDD....",
      ".....DDDDDD.....",
      "......DDDD......",
      ".....DD..DD.....",
      "................",
      "................",
      "................",
    ],
  },
  {
    name: "goblin",
    pal: {
      G: C(95, 174, 74),
      g: C(63, 122, 48),
      r: C(192, 57, 43),
      B: C(138, 90, 43),
    },
    rows: [
      ".....GGGGGG.....",
      "....GGGGGGGG....",
      "....GrGGrGGG....",
      "....GGGGGGGG....",
      ".....GGGGGG.....",
      "......GGGG......",
      "...GGGGGGGGGG...",
      "..GGGGGGGGGGGG..",
      "..G.GGGGGGGG.G..",
      "....GGGGGGGG....",
      "....gggggggg....",
      "....GG....GG....",
      "....GG....GG....",
      "...BB......BB...",
      "................",
      "................",
    ],
  },
  {
    name: "skeleton",
    pal: {
      B: C(216, 212, 192),
      o: C(26, 26, 26),
      b: C(168, 164, 148),
    },
    rows: [
      ".....BBBBBB.....",
      "....BBBBBBBB....",
      "....BoBBBoBB....",
      "....BBBBBBBB....",
      ".....BBBBBB.....",
      "......BBBB......",
      "...BBBBBBBBBB...",
      "...B.BBBBBB.B...",
      "...BBBBBBBBBB...",
      "...B.BBBBBB.B...",
      "...BBBBBBBBBB...",
      "......BBBB......",
      ".....BB..BB.....",
      ".....BB..BB.....",
      "....BB....BB....",
      "................",
    ],
  },
  {
    name: "potion",
    pal: {
      C: C(138, 90, 43),
      G: C(191, 232, 240),
      L: C(192, 57, 43),
      W: C(255, 255, 255),
    },
    rows: [
      line(rep(6, "."), rep(4, "C"), rep(6, ".")),
      line(rep(6, "."), rep(4, "C"), rep(6, ".")),
      line(rep(5, "."), rep(6, "G"), rep(5, ".")),
      line(rep(4, "."), rep(8, "G"), rep(4, ".")),
      line(rep(4, "."), "G", rep(6, "L"), "G", rep(4, ".")),
      line(rep(3, "."), "G", "L", "W", rep(6, "L"), "G", rep(3, ".")),
      line(rep(3, "."), "G", rep(8, "L"), "G", rep(3, ".")),
      line(rep(3, "."), "G", rep(8, "L"), "G", rep(3, ".")),
      line(rep(3, "."), "G", rep(8, "L"), "G", rep(3, ".")),
      line(rep(3, "."), "G", rep(8, "L"), "G", rep(3, ".")),
      line(rep(4, "."), "G", rep(6, "L"), "G", rep(4, ".")),
      line(rep(4, "."), rep(8, "G"), rep(4, ".")),
      line(rep(5, "."), rep(6, "G"), rep(5, ".")),
      rep(16, "."),
      rep(16, "."),
      rep(16, "."),
    ],
  },
  {
    name: "sword",
    pal: {
      B: C(207, 214, 221),
      b: C(154, 164, 173),
      G: C(217, 178, 58),
      H: C(138, 90, 43),
      P: C(217, 178, 58),
    },
    rows: [
      ".......Bb.......",
      ".......Bb.......",
      ".......Bb.......",
      ".......Bb.......",
      ".......Bb.......",
      ".......Bb.......",
      ".......Bb.......",
      ".......Bb.......",
      "......GGGG......",
      "......GGGG......",
      ".......HH.......",
      ".......HH.......",
      ".......HH.......",
      ".......HH.......",
      ".......PP.......",
      "................",
    ],
  },
  {
    name: "shield",
    pal: {
      R: C(217, 178, 58),
      F: C(79, 127, 208),
      f: C(58, 95, 160),
      H: C(217, 178, 58),
    },
    rows: [
      "..RRRRRRRRRRRR..",
      ".RFFFFFFFFFFFfR.",
      ".RFFFFFFFFFFFfR.",
      ".RFFFFFHHFFFFfR.",
      ".RFFFFHHHHFFFfR.",
      ".RFFFHHHHHHFFfR.",
      ".RFFFFHHHHFFFfR.",
      ".RFFFFFHHFFFFfR.",
      ".RFFFFFFFFFFFfR.",
      ".RFFFFFFFFFFFfR.",
      "..RFFFFFFFFFFR..",
      "...RFFFFFFFFR...",
      "....RFFFFFFR....",
      ".....RFFFFR.....",
      "......RFFR......",
      ".......RR.......",
    ],
  },
  {
    name: "gold",
    pal: {
      G: C(217, 178, 58),
      g: C(168, 132, 42),
      S: C(245, 224, 138),
    },
    rows: [
      "................",
      "................",
      ".....GGGGGG.....",
      "...GGGGGGGGGG...",
      "..GGGGGGGGGGGG..",
      "..GSGGGGGGGGgg..",
      "..GSSSGGGGGGgg..",
      "..GGSGGGGGGGgg..",
      "..GGGGGGGGGGgg..",
      "...GGGGGGGGGG...",
      "....gggggggg....",
      ".....gggggg.....",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  {
    name: "corpse",
    pal: {
      B: C(216, 212, 192),
      l: C(122, 42, 34),
    },
    rows: [
      "................",
      "................",
      "....BBBB........",
      "...BBBBBB.......",
      "..BBBBBBBB......",
      "...BBBBBB.......",
      "....BBBB........",
      "................",
      "......ll........",
      ".....llll.......",
      "....llllll......",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  {
    name: "stairsUp",
    pal: { s: C(222, 186, 72), d: C(170, 136, 46) },
    rows: [
      line(rep(8, " "), rep(8, "s")),
      line(rep(8, " "), rep(8, "d")),
      line(rep(6, " "), rep(10, "s")),
      line(rep(6, " "), rep(10, "d")),
      line(rep(4, " "), rep(12, "s")),
      line(rep(4, " "), rep(12, "d")),
      line(rep(2, " "), rep(14, "s")),
      line(rep(2, " "), rep(14, "d")),
      rep(16, "s"),
      rep(16, "d"),
      rep(16, "s"),
      rep(16, "d"),
      rep(16, "s"),
      rep(16, "d"),
      rep(16, "s"),
      rep(16, "d"),
    ],
  },
  {
    name: "black",
    pal: { K: C(12, 12, 16) },
    rows: Array.from({ length: GRID }, () => rep(16, "K")),
  },
];

for (const art of arts) {
  if (art.rows.length !== GRID) throw new Error(`${art.name}: ${art.rows.length} rows, expected ${GRID}`);
  for (const row of art.rows) {
    if (row.length !== GRID) throw new Error(`${art.name}: row "${row}" has ${row.length} chars, expected ${GRID}`);
    for (const ch of row) {
      if (ch !== " " && ch !== "." && !(ch in art.pal)) throw new Error(`${art.name}: char '${ch}' not in palette`);
    }
  }
}

const W = COLS * TILE;
const H = Math.ceil(arts.length / COLS) * TILE;
const data = Buffer.alloc(W * H * 4);

arts.forEach((art, i) => {
  const ox = (i % COLS) * TILE;
  const oy = Math.floor(i / COLS) * TILE;
  art.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = ch === " " ? undefined : art.pal[ch];
      if (!c) return;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const o = ((oy + y * SCALE + dy) * W + ox + x * SCALE + dx) * 4;
          data[o] = c[0];
          data[o + 1] = c[1];
          data[o + 2] = c[2];
          data[o + 3] = c[3];
        }
      }
    });
  });
});

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(bytes: Buffer): number {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (~c >>> 0);
}

function chunk(type: string, payload: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payload.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, payload])));
  return Buffer.concat([len, t, payload, crc]);
}

function encodePNG(width: number, height: number, rgba: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const src = y * width * 4;
    const dst = y * (width * 4 + 1);
    raw[dst] = 0;
    rgba.copy(raw, dst + 1, src, src + width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/assets", { recursive: true });
writeFileSync("public/assets/tiles.png", encodePNG(W, H, data));
console.log(`Wrote public/assets/tiles.png (${W}x${H}, ${arts.length} tiles)`);
