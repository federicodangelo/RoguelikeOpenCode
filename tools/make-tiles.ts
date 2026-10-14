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
      "....,....:......",
      line(rep(2, "."), ",", rep(6, "."), ",", rep(3, "."), ",", rep(2, ".")),
      "................",
      line(rep(6, "."), ":", rep(4, "."), ",", rep(4, ".")),
      "...,....,.......",
      "................",
      ".,...,....:.....",
      "......,...,...,.",
      "................",
      "....:......,....",
      "..,....,........",
      "................",
      "....,....,...,..",
      line(rep(6, "."), ":", rep(4, "."), ",", rep(4, ".")),
      "................",
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
      line(rep(3, "B"), "M", rep(5, "B"), "M", rep(6, "B")),
      line("BbB", "M", rep(5, "B"), "M", "BBBb", rep(2, "B")),
      rep(16, "M"),
      line(rep(6, "B"), "M", rep(6, "B"), "M", rep(2, "B")),
      line(rep(6, "B"), "M", rep(6, "B"), "M", rep(2, "B")),
      line("Bb", rep(4, "B"), "M", rep(6, "B"), "M", rep(2, "B")),
      rep(16, "M"),
      line(rep(2, "B"), "M", rep(6, "B"), "M", rep(6, "B")),
      line(rep(2, "B"), "M", rep(6, "B"), "M", rep(6, "B")),
      line("BB", "M", "BBb", rep(4, "B"), "M", "BBb", rep(2, "B")),
      rep(16, "M"),
      line(rep(4, "B"), "M", rep(6, "B"), "M", rep(4, "B")),
      line(rep(4, "B"), "M", rep(6, "B"), "M", rep(4, "B")),
      rep(16, "D"),
    ],
  },
  {
    name: "stairs",
    pal: { s: C(222, 186, 72), d: C(170, 136, 46) },
    rows: [
      line(rep(14, "s"), rep(2, "d")),
      line(rep(14, "s"), rep(2, "d")),
      rep(16, "d"),
      rep(16, "d"),
      line(rep(12, "s"), rep(2, "d"), rep(2, " ")),
      line(rep(12, "s"), rep(2, "d"), rep(2, " ")),
      line(rep(12, "d"), rep(4, " ")),
      line(rep(12, "d"), rep(4, " ")),
      line(rep(10, "s"), rep(2, "d"), rep(4, " ")),
      line(rep(10, "s"), rep(2, "d"), rep(4, " ")),
      line(rep(10, "d"), rep(6, " ")),
      line(rep(10, "d"), rep(6, " ")),
      line(rep(8, "s"), rep(2, "d"), rep(6, " ")),
      line(rep(8, "s"), rep(2, "d"), rep(6, " ")),
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
      line("F", "PLLD", rep(2, "PLLD"), "PL", "F"),
      line("F", "PLLD", rep(2, "PLLD"), "PL", "F"),
      line("F", "PLLD", rep(2, "PLLD"), "PL", "F"),
      line("F", "PLLD", rep(2, "PLLD"), "PL", "F"),
      line("F", "PLLD", rep(2, "PLLD"), "PL", "F"),
      line("F", "PLLD", rep(2, "PLLD"), "PL", "F"),
      line("F", "PLLD", rep(2, "PL"), "HH", "LD", "PL", "F"),
      line("F", "PLLD", rep(2, "PL"), "HH", "LD", "PL", "F"),
      line("F", "PLLD", rep(2, "PLLD"), "PL", "F"),
      line("F", "PLLD", rep(2, "PLLD"), "PL", "F"),
      line("F", "PLLD", rep(2, "PLLD"), "PL", "F"),
      line("F", "PLLD", rep(2, "PLLD"), "PL", "F"),
      line("F", "PLLD", rep(2, "PLLD"), "PL", "F"),
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
      line("F", "PLLD", "FFF", rep(8, " ")),
      line("F", "PLLD", "FFF", rep(8, " ")),
      line("F", "PLLD", "FFF", rep(8, " ")),
      line("F", "PLLD", "FFF", rep(8, " ")),
      line("F", "PLLD", "FFF", rep(8, " ")),
      line("F", "PLLD", "FFF", rep(8, " ")),
      line("F", "PLLD", "HFF", rep(8, " ")),
      line("F", "PLLD", "HFF", rep(8, " ")),
      line("F", "PLLD", "FFF", rep(8, " ")),
      line("F", "PLLD", "FFF", rep(8, " ")),
      line("F", "PLLD", "FFF", rep(8, " ")),
      line("F", "PLLD", "FFF", rep(8, " ")),
      line("F", "PLLD", "FFF", rep(8, " ")),
      line("F", "PLLD", "DFF", rep(8, " ")),
      line(rep(8, "F"), rep(8, " ")),
    ],
  },
  {
    name: "player",
    pal: {
      O: C(24, 22, 20),
      H: C(92, 62, 38),
      S: C(232, 185, 138),
      o: C(26, 26, 26),
      T: C(86, 134, 214),
      t: C(62, 100, 164),
      G: C(217, 178, 58),
      B: C(112, 78, 48),
    },
    rows: [
      "......OOOO......",
      "....OOHHHHOO....",
      "...OHHHHHHHHO...",
      "...OHSSSSSSHO...",
      "...OHSoSSoSHO...",
      "....OSSSSSSO....",
      ".....OSSSSO.....",
      "...OOOOOOOOOO...",
      "..OTTTTTTTTTTO..",
      ".OT.TTTTTT.TTO..",
      ".OS.TTGTTT.STO..",
      ".OS.TttttT.STO..",
      "...O.TTTTTTO....",
      "...OTT..TTO.....",
      "...OB....BO.....",
      "....OO....OO....",
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
      ".....DDDDdd.....",
      "......DDdd......",
      ".....DD..Dd.....",
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
      ".G..GrGGrGGG..G.",
      "GGG.GGGGGGGG.GGG",
      ".G..GGGGGGGG..G.",
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
      ".....BbBbBB.....",
      "......BBBB......",
      "...BBBBBBBBBB...",
      "...B.BBBBBB.B...",
      "...BBBBBBBBBB...",
      "...B.BbBbBB.B...",
      "...BBBBBBBBBB...",
      "......bBBb......",
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
      "......CCCC......",
      "......C..C......",
      ".....GGGGGG.....",
      "....GGGGGGGG....",
      "...GGGLLLGGG....",
      "..GGLWWLLLLGG...",
      "..GLLLLLLLLGL...",
      "..GLLLLLLLLGL...",
      "..GLLLLLLLLGL...",
      "..GLLLLLLLLGL...",
      "..GLLLLLLLLGL...",
      "...GLLLLLLLG....",
      "....GGGGGGGG....",
      ".....GGGGGG.....",
      "................",
      "................",
    ],
  },
  {
    name: "sword",
    pal: {
      W: C(232, 238, 244),
      B: C(207, 214, 221),
      b: C(154, 164, 173),
      G: C(217, 178, 58),
      g: C(168, 132, 42),
      H: C(138, 90, 43),
    },
    rows: [
      "......WBb.......",
      "......WBb.......",
      "......WBb.......",
      "......WBb.......",
      "......WBb.......",
      "......WBb.......",
      "......WBb.......",
      "......WBb.......",
      ".....GGGGGG.....",
      ".....GgGGgG.....",
      "......HHH.......",
      "......HHH.......",
      "......HHH.......",
      "......HHH.......",
      "......GGG.......",
      "................",
    ],
  },
  {
    name: "shield",
    pal: {
      R: C(217, 178, 58),
      F: C(79, 127, 208),
      f: C(58, 95, 160),
      W: C(140, 180, 240),
      H: C(217, 178, 58),
    },
    rows: [
      "..RRRRRRRRRRRR..",
      ".RWWFFFFFFFFFfR.",
      ".RWFFFFFFFFFFfR.",
      ".RFFFHHHHFFFFfR.",
      ".RFFHHHHHHFFFfR.",
      ".RFFFHHWHHFFFfR.",
      ".RFFHHHHHHFFFfR.",
      ".RFFFHHHHFFFFfR.",
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
      "..GGSGGGGGGGG...",
      ".GSSGGGGGGGGgG..",
      ".GSGGGGGGGGGgG..",
      ".GGGGGGGGGGGgG..",
      "..GGGGGGGGGGgG..",
      "...GGGGGGGGGg...",
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
      o: C(26, 26, 26),
      l: C(122, 42, 34),
    },
    rows: [
      "................",
      "................",
      "....BBBB........",
      "...BBBBBB..ll...",
      "..BBBBBBBB.llll.",
      "...BBBoBB.llll..",
      "....BBBB...ll...",
      "................",
      "......ll........",
      ".....llllll.....",
      "....llllllll....",
      "...llllllllll...",
      "....llllllll....",
      "................",
      "................",
      "................",
    ],
  },
  {
    name: "stairsUp",
    pal: { s: C(222, 186, 72), d: C(170, 136, 46) },
    rows: [
      line(rep(8, " "), rep(6, "s"), rep(2, "d")),
      line(rep(8, " "), rep(8, "d")),
      line(rep(6, " "), rep(8, "s"), rep(2, "d")),
      line(rep(6, " "), rep(10, "d")),
      line(rep(4, " "), rep(10, "s"), rep(2, "d")),
      line(rep(4, " "), rep(12, "d")),
      line(rep(2, " "), rep(12, "s"), rep(2, "d")),
      line(rep(2, " "), rep(14, "d")),
      line(rep(14, "s"), rep(2, "d")),
      rep(16, "d"),
      line(rep(14, "s"), rep(2, "d")),
      rep(16, "d"),
      line(rep(14, "s"), rep(2, "d")),
      rep(16, "d"),
      line(rep(14, "s"), rep(2, "d")),
      rep(16, "d"),
    ],
  },
  {
    name: "black",
    pal: { K: C(12, 12, 16) },
    rows: Array.from({ length: GRID }, () => rep(16, "K")),
  },
  {
    name: "archer",
    pal: {
      G: C(112, 154, 92),
      g: C(78, 112, 64),
      S: C(232, 185, 138),
      o: C(26, 26, 26),
      B: C(138, 90, 43),
      W: C(216, 212, 192),
    },
    rows: [
      ".....GGGGGG.....",
      "....GGGGGGGG....",
      "....GSSSSSGG....",
      "....GSoSSoSG....",
      ".....SSSSSS.....",
      "......GGGG......",
      "...GGGGGGGGGG...",
      "W.GGGGGGGGGGGG..",
      "W.G.GGGGGGGG.G..",
      "W...GGGGGGGG....",
      "W...gggggggg....",
      "W...GG....GG....",
      ".W..GG....GG....",
      "..BB......BB....",
      "................",
      "................",
    ],
  },
  {
    name: "wolf",
    pal: {
      D: C(92, 96, 108),
      d: C(64, 68, 78),
      E: C(226, 214, 192),
      o: C(26, 26, 26),
      T: C(122, 126, 138),
    },
    rows: [
      "................",
      "................",
      "................",
      "....DD......DD..",
      "...DDDD....DDDD.",
      "..DDDDDDDDDDDDD.",
      ".DDDDDDDDDDDDDD.",
      ".DoDDDDDDDDDDDD.",
      ".DDDDDDDDDDDDDD.",
      "..DDDDDDDDDDDD..",
      "...DDDDDDDDDD...",
      "....DDDDDDdd....",
      "....DD....DD....",
      "...DD......DD...",
      "................",
      "................",
    ],
  },
  {
    name: "ogre",
    pal: {
      G: C(126, 176, 86),
      g: C(84, 128, 58),
      r: C(210, 72, 52),
      W: C(232, 228, 210),
      B: C(138, 90, 43),
      b: C(92, 62, 38),
    },
    rows: [
      "....GGGGGGGG....",
      "...GGGGGGGGGG...",
      "...GrGGGGGrGG...",
      "...GGGGGGGGGG...",
      "....GWGGGGWG....",
      ".....GGGGGG.....",
      ".GGGGGGGGGGGGGG.",
      "GGGGGGGGGGGGGGGG",
      "GG.GGGGGGGGGG.GG",
      "GG.GGGGGGGGGG.GG",
      ".GGGGGGGGGGGGGG.",
      "....gggggggg....",
      "....GG....GG....",
      "....GG....GG....",
      "...BB......BB...",
      "...bb......bb...",
    ],
  },
  {
    name: "warlock",
    pal: {
      P: C(126, 82, 184),
      p: C(88, 54, 132),
      S: C(232, 185, 138),
      o: C(26, 26, 26),
      Y: C(226, 186, 72),
      B: C(138, 90, 43),
    },
    rows: [
      ".....PPPPPP.....",
      "....PPPPPPPP....",
      "....PSPPPPSP....",
      "....PSoPPoSP....",
      ".....SSSSSS.....",
      "......PPPP......",
      "...PPPPPPPPPP...",
      "..PPPPPPPPPPPP..",
      ".PP.PPPPPP.PPY..",
      ".PS.PPPPPP.SP.B.",
      "....PPPPPP..B...",
      "....ppPPpp..B...",
      "....PP..PP..B...",
      "....PP..PP..B...",
      "....YY..YY..B...",
      "................",
    ],
  },
  {
    name: "demon",
    pal: {
      R: C(192, 57, 43),
      r: C(132, 36, 28),
      Y: C(226, 186, 72),
      o: C(26, 26, 26),
      B: C(72, 46, 22),
    },
    rows: [
      "..Y..........Y..",
      ".YY..........YY.",
      "..RRRRRRRRRRRR..",
      ".RRRRRRRRRRRRRR.",
      ".RRoRRRRRRoRRRR.",
      ".RRRRRRRRRRRRRR.",
      "..RRRRRRRRRRRR..",
      "r.RRRRRRRRRRRR.r",
      "rr.RRRRRRRRRR.rr",
      "rrrRRRRRRRRRRrrr",
      "rrrRRRRRRRRRRrrr",
      ".rrRRRRRRRRRRrr.",
      "....rr....rr....",
      "....RR....RR....",
      "...BB......BB...",
      "................",
    ],
  },
  {
    name: "trap",
    pal: {
      F: C(46, 42, 38),
      s: C(122, 126, 138),
      S: C(184, 188, 196),
    },
    rows: [
      rep(16, "F"),
      rep(16, "F"),
      rep(16, "F"),
      line("FFF", rep(10, "s"), "FFF"),
      line("FFs", rep(10, " "), "sFF"),
      line("FFs", "..S", rep(4, "."), "S..", "sFF"),
      line("FFs", rep(4, "."), "SS", rep(4, "."), "sFF"),
      line("FFs", rep(4, "."), "SS", rep(4, "."), "sFF"),
      line("FFs", "..S", rep(4, "."), "S..", "sFF"),
      line("FFs", rep(10, " "), "sFF"),
      line("FFF", rep(10, "s"), "FFF"),
      rep(16, "F"),
      rep(16, "F"),
      rep(16, "F"),
      rep(16, "F"),
      rep(16, "F"),
    ],
  },
  {
    name: "torch",
    pal: {
      B: C(138, 90, 43),
      b: C(92, 62, 38),
      Y: C(245, 224, 138),
      O: C(226, 132, 42),
      R: C(192, 57, 43),
    },
    rows: [
      ".......RR.......",
      "......ROOR......",
      ".....ROYYOR.....",
      ".....ROYYOR.....",
      "......OYYO......",
      "......OYYO......",
      ".......OO.......",
      ".......BB.......",
      "......BbB.......",
      ".......B........",
      ".......bb.......",
      ".......bb.......",
      ".......b........",
      "................",
      "................",
      "................",
    ],
  },
  {
    name: "projectile",
    pal: {
      W: C(216, 212, 192),
      B: C(138, 90, 43),
      R: C(192, 57, 43),
    },
    rows: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "RR..WWWWWWWW....",
      "RRWWWWWWWWWWBB..",
      "RR..WWWWWWWW....",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  {
    name: "dagger",
    pal: {
      W: C(232, 238, 244),
      b: C(154, 164, 173),
      G: C(217, 178, 58),
      g: C(168, 132, 42),
      H: C(138, 90, 43),
    },
    rows: [
      "................",
      "................",
      "........WWb.....",
      "........WWb.....",
      ".......WWb......",
      "......WWb.......",
      ".....WWb........",
      "....GGWb........",
      "...GGGG.........",
      "...GgG..........",
      "....HH..........",
      "....HH..........",
      "....HH..........",
      "....GG..........",
      "................",
      "................",
    ],
  },
  {
    name: "longSword",
    pal: {
      W: C(232, 238, 244),
      B: C(207, 214, 221),
      b: C(154, 164, 173),
      G: C(217, 178, 58),
      g: C(168, 132, 42),
      H: C(138, 90, 43),
    },
    rows: [
      "......WBb.......",
      "......WBb.......",
      "......WBb.......",
      "......WBb.......",
      "......WBb.......",
      "......WBb.......",
      "......WBb.......",
      "......WBb.......",
      "......WBb.......",
      "......WBb.......",
      ".....GGGGGG.....",
      ".....GgGGgG.....",
      "......HHH.......",
      "......HHH.......",
      "......HHH.......",
      "......GGG.......",
    ],
  },
  {
    name: "battleAxe",
    pal: {
      S: C(207, 214, 221),
      A: C(154, 164, 173),
      H: C(138, 90, 43),
      G: C(217, 178, 58),
    },
    rows: [
      "................",
      "....SSAA........",
      "...SAAAAA.......",
      "...SAA.AA.......",
      "...SAAAAA.......",
      "...SAA.AA.......",
      "...SAAAAA.......",
      "....SSAA........",
      "......H.........",
      "......H.........",
      "......H.........",
      "......H.........",
      "......H.........",
      "......H.........",
      "......GG........",
      "................",
    ],
  },
  {
    name: "buckler",
    pal: {
      R: C(217, 178, 58),
      F: C(79, 127, 208),
      f: C(58, 95, 160),
      W: C(140, 180, 240),
      H: C(217, 178, 58),
    },
    rows: [
      "................",
      "................",
      "................",
      ".....RRRR.......",
      "...RRWWFFRR.....",
      "..RWWFFFFfRR....",
      "..RWFFHHFFfR....",
      "..RWFFHHFFfR....",
      "..RWWFFFFfRR....",
      "...RRFFFFRR.....",
      "....RRFFRR......",
      ".....RRRR.......",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  {
    name: "kiteShield",
    pal: {
      R: C(217, 178, 58),
      F: C(79, 127, 208),
      f: C(58, 95, 160),
      W: C(140, 180, 240),
      H: C(217, 178, 58),
    },
    rows: [
      "..RRRRRRRRRR....",
      ".RWWFFFFFFFFR...",
      ".RWFFFFFFFFFFR..",
      ".RFFFHHHHFFFFR..",
      ".RFFHHHHHHFFFR..",
      ".RFFFHHWHHFFFR..",
      ".RFFHHHHHHFFFR..",
      ".RFFFHHHHFFFFR..",
      ".RFFFFFFFFFFFR..",
      "..RFFFFFFFFR....",
      "...RFFFFFFR.....",
      "....RFFFFR......",
      ".....RFFR.......",
      "......RR........",
      "................",
      "................",
    ],
  },
  {
    name: "majorPotion",
    pal: {
      C: C(138, 90, 43),
      G: C(191, 232, 240),
      P: C(126, 82, 184),
      W: C(255, 255, 255),
    },
    rows: [
      "......CCCC......",
      "......C..C......",
      ".....GGGGGG.....",
      "....GGGGGGGG....",
      "...GGPPPGGG.....",
      "..GPPWPPPPGG....",
      "..GPPPPPPPPG....",
      "..GPPPPPPPPG....",
      "..GPPPPPPPPG....",
      "..GPPPPPPPPG....",
      "..GPPPPPPPPG....",
      "...GPPPPPPG.....",
      "....GGGGGGGG....",
      ".....GGGGGG.....",
      "................",
      "................",
    ],
  },
  {
    name: "lantern",
    pal: {
      M: C(104, 110, 120),
      m: C(82, 88, 97),
      Y: C(245, 224, 138),
      O: C(226, 132, 42),
    },
    rows: [
      ".......MM.......",
      "......M..M......",
      ".....MMMMMM.....",
      "....MYYYYYYM....",
      "...MYOOOOOOMY...",
      "...MYOYYYYOYM...",
      "...MYOYYYYOYM...",
      "...MYOOOOOOMY...",
      "....MYYYYYYM....",
      "....mmmmmmmm....",
      "......mmmm......",
      "................",
      "................",
      "................",
      "................",
      "................",
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
  return ~c >>> 0;
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

export { arts, encodePNG, GRID, TILE, COLS, data as tileSheet, W as TILE_SHEET_W, H as TILE_SHEET_H };

if (import.meta.main) {
  mkdirSync("public/assets", { recursive: true });
  writeFileSync("public/assets/tiles.png", encodePNG(W, H, data));
  console.log(`Wrote public/assets/tiles.png (${W}x${H}, ${arts.length} tiles)`);
}
