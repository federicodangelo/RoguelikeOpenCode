import { RNG } from "./rng.ts";
import { nearestOpen, placeTraps, type CellType, type GameMap, type Point } from "./mapgen/common.ts";
import { generateBSP } from "./mapgen/bsp.ts";
import { generateCellular } from "./mapgen/cellular.ts";
import { generateDelaunay } from "./mapgen/delaunay.ts";
import { generateWalk } from "./mapgen/walk.ts";

export { MAP_W, MAP_H } from "./mapgen/common.ts";
export type { CellType, GameMap, Room, PlacedItem, Point } from "./mapgen/common.ts";

export const MAP_ALGORITHMS = ["bsp", "cellular", "delaunay", "walk"] as const;
export type MapAlgorithm = (typeof MAP_ALGORITHMS)[number];

const GENERATORS: Record<MapAlgorithm, (rng: RNG, depth: number) => GameMap> = {
  bsp: generateBSP,
  cellular: generateCellular,
  delaunay: generateDelaunay,
  walk: generateWalk,
};

export function pickAlgorithm(depth: number): MapAlgorithm {
  return MAP_ALGORITHMS[(depth - 1) % MAP_ALGORITHMS.length]!;
}

export interface GenerateOptions {
  algorithm?: MapAlgorithm;
  upAt?: Point;
}

export function generateMap(rng: RNG, depth: number, opts: GenerateOptions = {}): GameMap {
  const algorithm = opts.algorithm ?? pickAlgorithm(depth);
  const map = GENERATORS[algorithm](rng, depth);
  map.algorithm = algorithm;

  if (opts.upAt) {
    const at = nearestOpen(map.cells, opts.upAt);
    if (at) {
      map.cells[at.y]![at.x] = "stairsUp";
      map.upStairs = at;
    }
  }

  placeTraps(map.cells, rng, depth, [map.spawn, map.stairs, ...(map.upStairs ? [map.upStairs] : [])], map.items);
  return map;
}
