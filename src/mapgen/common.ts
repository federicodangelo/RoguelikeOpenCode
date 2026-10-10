import { RNG } from "../rng.ts";
import { T } from "../tiles.ts";

export const MAP_W = 40;
export const MAP_H = 30;

export type CellType = "wall" | "floor" | "stairs" | "stairsUp" | "doorClosed" | "doorOpen";

export interface Point {
  x: number;
  y: number;
}

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export interface PlacedItem {
  x: number;
  y: number;
  tile: number;
}

export interface GameMap {
  width: number;
  height: number;
  cells: CellType[][];
  rooms: Room[];
  spawn: Point;
  stairs: Point;
  upStairs: Point | null;
  items: PlacedItem[];
  algorithm: string;
}

export function emptyCells(): CellType[][] {
  return Array.from({ length: MAP_H }, () => Array<CellType>(MAP_W).fill("wall"));
}

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function overlaps(a: Room, b: Room): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

export function carveCell(cells: CellType[][], x: number, y: number): void {
  if (cells[y]![x] === "wall") cells[y]![x] = "floor";
}

export function carveH(cells: CellType[][], y: number, x1: number, x2: number): void {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) carveCell(cells, x, y);
}

export function carveV(cells: CellType[][], x: number, y1: number, y2: number): void {
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) carveCell(cells, x, y);
}

export function carveCorridor(cells: CellType[][], a: Point, b: Point, rng: RNG): void {
  if (rng.next() < 0.5) {
    carveH(cells, a.y, a.x, b.x);
    carveV(cells, b.x, a.y, b.y);
  } else {
    carveV(cells, a.x, a.y, b.y);
    carveH(cells, b.y, a.x, b.x);
  }
}

export function placeDoors(cells: CellType[][], rooms: Room[], rng: RNG): void {
  if (rooms.length === 0) return;
  const inRoom = (x: number, y: number): boolean =>
    rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

  for (const r of rooms) {
    const entrances: Point[] = [];
    for (let x = r.x - 1; x <= r.x + r.w; x++) {
      for (const y of [r.y - 1, r.y + r.h]) {
        if (cells[y]?.[x] === "floor") entrances.push({ x, y });
      }
    }
    for (let y = r.y - 1; y <= r.y + r.h; y++) {
      for (const x of [r.x - 1, r.x + r.w]) {
        if (cells[y]?.[x] === "floor") entrances.push({ x, y });
      }
    }
    for (const e of entrances) {
      if (cells[e.y]![e.x] !== "floor") continue;
      if (inRoom(e.x, e.y)) continue;
      if (rng.next() < 0.5) cells[e.y]![e.x] = "doorClosed";
    }
  }
}

export function bfsFarthest(cells: CellType[][], start: Point): Point {
  const dist = new Int32Array(MAP_W * MAP_H).fill(-1);
  const startK = start.y * MAP_W + start.x;
  const queue: number[] = [startK];
  dist[startK] = 0;
  let far = startK;
  while (queue.length > 0) {
    const k = queue.shift()!;
    if (dist[k]! > dist[far]!) far = k;
    const x = k % MAP_W;
    const y = Math.floor(k / MAP_W);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      if (cells[ny]![nx] === "wall") continue;
      const nk = ny * MAP_W + nx;
      if (dist[nk] !== -1) continue;
      dist[nk] = dist[k]! + 1;
      queue.push(nk);
    }
  }
  return { x: far % MAP_W, y: Math.floor(far / MAP_W) };
}

export function keepLargestRegion(cells: CellType[][]): void {
  const label = new Int32Array(MAP_W * MAP_H).fill(-1);
  const regions: number[][] = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (cells[y]![x] !== "floor" || label[y * MAP_W + x] !== -1) continue;
      const region: number[] = [];
      const stack = [y * MAP_W + x];
      label[y * MAP_W + x] = regions.length;
      while (stack.length > 0) {
        const k = stack.pop()!;
        region.push(k);
        const cx = k % MAP_W;
        const cy = Math.floor(k / MAP_W);
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
          const nk = ny * MAP_W + nx;
          if (cells[ny]![nx] !== "floor" || label[nk] !== -1) continue;
          label[nk] = regions.length;
          stack.push(nk);
        }
      }
      regions.push(region);
    }
  }
  if (regions.length <= 1) return;
  regions.sort((a, b) => b.length - a.length);
  for (const region of regions.slice(1)) {
    for (const k of region) cells[Math.floor(k / MAP_W)]![k % MAP_W] = "wall";
  }
}

export function nearestOpen(cells: CellType[][], at: Point): Point | null {
  const sx = Math.max(1, Math.min(MAP_W - 2, at.x));
  const sy = Math.max(1, Math.min(MAP_H - 2, at.y));
  const startK = sy * MAP_W + sx;
  const seen = new Set<number>([startK]);
  const queue: number[] = [startK];
  let fallback: number | null = null;
  while (queue.length > 0) {
    const k = queue.shift()!;
    const x = k % MAP_W;
    const y = Math.floor(k / MAP_W);
    const c = cells[y]![x]!;
    if (c === "floor") return { x, y };
    if (c !== "wall" && fallback === null) fallback = k;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const nk = ny * MAP_W + nx;
      if (seen.has(nk) || cells[ny]![nx] === "wall") continue;
      seen.add(nk);
      queue.push(nk);
    }
  }
  if (fallback !== null) return { x: fallback % MAP_W, y: Math.floor(fallback / MAP_W) };
  return null;
}

export function placeItems(cells: CellType[][], rng: RNG, depth: number, reserved: Point[]): PlacedItem[] {
  const kinds = [T.Potion, T.Gold, T.Sword, T.Shield];
  const floors: Point[] = [];
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (cells[y]![x] !== "floor") continue;
      if (reserved.some((p) => p.x === x && p.y === y)) continue;
      floors.push({ x, y });
    }
  }
  for (let i = floors.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [floors[i], floors[j]] = [floors[j]!, floors[i]!];
  }
  const count = Math.min(rng.int(3, 5) + Math.min(depth, 3), floors.length);
  return floors.slice(0, count).map((p) => ({ x: p.x, y: p.y, tile: rng.pick(kinds) }));
}

export function makeMap(
  cells: CellType[][],
  algorithm: string,
  rooms: Room[],
  spawn: Point,
  stairs: Point,
  items: PlacedItem[],
): GameMap {
  return {
    width: MAP_W,
    height: MAP_H,
    cells,
    rooms,
    spawn,
    stairs,
    upStairs: null,
    items,
    algorithm,
  };
}
