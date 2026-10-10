import { bfsDistances, MAP_H, MAP_W, type CellType, type GameMap } from "../src/mapgen/common.ts";

export function mkMap(cells: CellType[][], spawn = { x: 1, y: 1 }, stairs = { x: 1, y: 1 }): GameMap {
  return {
    width: MAP_W,
    height: MAP_H,
    cells,
    rooms: [],
    spawn,
    stairs,
    upStairs: null,
    items: [],
    algorithm: "test",
  };
}

export function openInterior(): CellType[][] {
  return Array.from({ length: MAP_H }, (_, y) =>
    Array.from({ length: MAP_W }, (_, x) =>
      x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1 ? "wall" : "floor",
    ),
  );
}

export function countOpen(cells: CellType[][]): number {
  let n = 0;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (cells[y]![x] !== "wall") n++;
    }
  }
  return n;
}

export function allReachable(map: GameMap): boolean {
  const dist = bfsDistances(map.cells, map.spawn);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (map.cells[y]![x] !== "wall" && dist[y * MAP_W + x] === -1) return false;
    }
  }
  return true;
}
