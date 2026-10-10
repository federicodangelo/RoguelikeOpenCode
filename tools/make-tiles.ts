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

const arts: TileArt[] = [
  {
    name: "floor",
    pal: { ".": C(48, 43, 38), ",": C(58, 52, 45) },
    rows: [
      "................",
      "..,.....,.......",
      "......,.....,...",
      "................",
      ",....,......,...",
      "................",
      "....,....,......",
      "................",
      "..,.....,...,...",
      "......,.........",
      "................",
      ",....,....,.....",
      "................",
      "....,......,....",
      "................",
      "..,....,........",
    ],
  },
  {
    name: "wall",
    pal: { L: C(122, 128, 137), F: C(86, 91, 99), M: C(59, 63, 69), D: C(70, 75, 82) },
    rows: [
      "LLLLLLLLLLLLLLLL",
      "FFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFF",
      "FFFMMMMFFFFFFMMM",
      "FFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFF",
      "MMMMFFFFFFFMMMMM",
      "FFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFF",
      "FFFMMMMFFFFFFMMM",
      "MMMMFFFFFFFMMMMM",
      "FFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFF",
      "FFFMMMMFFFFFFMMM",
      "DDDDDDDDDDDDDDDD",
      "DDDDDDDDDDDDDDDD",
    ],
  },
  {
    name: "stairs",
    pal: { ".": C(48, 43, 38), s: C(217, 178, 58), d: C(168, 132, 42) },
    rows: [
      "ssssssssssssssss",
      "dddddddddddddddd",
      "ssssssssssssss  ",
      "dddddddddddddd  ",
      "ssssssssssss    ",
      "dddddddddddd    ",
      "ssssssssss      ",
      "dddddddddd      ",
      "ssssssss        ",
      "dddddddd        ",
      "ssssss          ",
      "dddddd          ",
      "ssss            ",
      "dddd            ",
      "ss              ",
      "dd              ",
    ],
  },
  {
    name: "doorClosed",
    pal: { F: C(92, 58, 26), P: C(138, 90, 43), L: C(107, 68, 35), H: C(217, 178, 58) },
    rows: [
      "FFFFFFFFFFFFFFFF",
      "FPLPPPPPLPPPPPLF",
      "FPLPPPPPLPPPPPLF",
      "FPLPPPPPLPPPPPLF",
      "FPLPPPPPLPPPPPLF",
      "FPLPPPPPLPPPPPLF",
      "FPLPPPPPLPPPPPLF",
      "FPLPPPPPLPPHHPLF",
      "FPLPPPPPLPPHHPLF",
      "FPLPPPPPLPPPPPLF",
      "FPLPPPPPLPPPPPLF",
      "FPLPPPPPLPPPPPLF",
      "FPLPPPPPLPPPPPLF",
      "FPLPPPPPLPPPPPLF",
      "FPLPPPPPLPPPPPLF",
      "FFFFFFFFFFFFFFFF",
    ],
  },
  {
    name: "doorOpen",
    pal: { F: C(92, 58, 26), P: C(138, 90, 43), L: C(107, 68, 35), H: C(217, 178, 58) },
    rows: [
      "FFFFFFFF        ",
      "FPPPLPPF        ",
      "FPPPLPPF        ",
      "FPPPLPPF        ",
      "FPPPLPPF        ",
      "FPPPLPPF        ",
      "FPPPLPPF        ",
      "FPPPLPPFH       ",
      "FPPPLPPFH       ",
      "FPPPLPPF        ",
      "FPPPLPPF        ",
      "FPPPLPPF        ",
      "FPPPLPPF        ",
      "FPPPLPPF        ",
      "FPPPLPPF        ",
      "FFFFFFFF        ",
    ],
  },
  {
    name: "player",
    pal: {
      H: C(107, 74, 47), S: C(232, 185, 138), o: C(26, 26, 26),
      T: C(79, 127, 208), t: C(58, 95, 160), B: C(107, 74, 47),
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
    pal: { D: C(138, 106, 74), d: C(107, 79, 54), E: C(217, 154, 138), o: C(26, 26, 26), T: C(217, 154, 138) },
    rows: [
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
      "................",
    ],
  },
  {
    name: "goblin",
    pal: { G: C(95, 174, 74), g: C(63, 122, 48), r: C(192, 57, 43), B: C(138, 90, 43) },
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
    pal: { B: C(216, 212, 192), o: C(26, 26, 26), b: C(168, 164, 148) },
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
    pal: { C: C(138, 90, 43), G: C(191, 232, 240), L: C(192, 57, 43), W: C(255, 255, 255) },
    rows: [
      "......CCCC......",
      "......CCCC......",
      ".....GGGGGG.....",
      "....GGGGGGGG....",
      "....GLLLLLLG....",
      "...GLWLLLLLLG...",
      "...GLLLLLLLLG...",
      "...GLLLLLLLLG...",
      "...GLLLLLLLLG...",
      "...GLLLLLLLLG...",
      "....GLLLLLLG....",
      "....GGGGGGGG....",
      ".....GGGGGG.....",
      "................",
      "................",
      "................",
    ],
  },
  {
    name: "sword",
    pal: { B: C(207, 214, 221), b: C(154, 164, 173), G: C(217, 178, 58), H: C(138, 90, 43), P: C(217, 178, 58) },
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
    pal: { R: C(217, 178, 58), F: C(79, 127, 208), f: C(58, 95, 160), H: C(217, 178, 58) },
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
    pal: { G: C(217, 178, 58), g: C(168, 132, 42), S: C(245, 224, 138) },
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
    pal: { B: C(216, 212, 192), l: C(122, 42, 34) },
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
    pal: { ".": C(48, 43, 38), s: C(217, 178, 58), d: C(168, 132, 42) },
    rows: [
      "ss              ",
      "dd              ",
      "ssss            ",
      "dddd            ",
      "ssssss          ",
      "dddddd          ",
      "ssssssss        ",
      "dddddddd        ",
      "ssssssssss      ",
      "dddddddddd      ",
      "ssssssssssss    ",
      "dddddddddddd    ",
      "ssssssssssssss  ",
      "dddddddddddddd  ",
      "ssssssssssssssss",
      "dddddddddddddddd",
    ],
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
