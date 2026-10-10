import { RNG } from "../rng.ts";
import {
  MAP_W,
  MAP_H,
  emptyCells,
  keepLargestRegion,
  bfsFarthest,
  placeItems,
  makeMap,
  type GameMap,
  type Point,
} from "./common.ts";

function countWallNeighbors(cells: ReturnType<typeof emptyCells>, x: number, y: number): number {
  let walls = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) {
        walls++;
      } else if (cells[ny]![nx] === "wall") {
        walls++;
      }
    }
  }
  return walls;
}

function tryCave(rng: RNG): ReturnType<typeof emptyCells> | null {
  const cells = emptyCells();
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      cells[y]![x] = rng.next() < 0.55 ? "floor" : "wall";
    }
  }

  for (let iter = 0; iter < 4; iter++) {
    const snapshot = cells.map((row) => [...row]);
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        const walls = countWallNeighbors(snapshot, x, y);
        cells[y]![x] = walls >= 5 ? "wall" : walls <= 3 ? "floor" : snapshot[y]![x]!;
      }
    }
  }

  keepLargestRegion(cells);

  let open = 0;
  let spawn: Point | null = null;
  for (let y = 1; y < MAP_H - 1 && !spawn; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (cells[y]![x] === "floor") {
        open++;
        if (!spawn) spawn = { x, y };
      }
    }
  }
  if (!spawn || open < 250) return null;
  return cells;
}

export function generateCellular(rng: RNG, depth: number): GameMap {
  let cells: ReturnType<typeof emptyCells> | null = null;
  for (let attempt = 0; attempt < 10 && !cells; attempt++) {
    cells = tryCave(rng);
  }
  if (!cells) {
    cells = emptyCells();
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) cells[y]![x] = "floor";
    }
  }

  let spawn: Point = { x: 1, y: 1 };
  outer: for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (cells[y]![x] === "floor") {
        spawn = { x, y };
        break outer;
      }
    }
  }

  const stairs = bfsFarthest(cells, spawn);
  cells[stairs.y]![stairs.x] = "stairs";

  const items = placeItems(cells, rng, depth, [spawn, stairs]);
  return makeMap(cells, "cellular", [], spawn, stairs, items);
}
