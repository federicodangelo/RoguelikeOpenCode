import { RNG } from "./rng.ts";
import { T } from "./tiles.ts";

export const MAP_W = 40;
export const MAP_H = 30;

export type CellType = "wall" | "floor" | "stairs" | "doorClosed" | "doorOpen";

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
  spawn: { x: number; y: number };
  stairs: { x: number; y: number };
  items: PlacedItem[];
}

function overlaps(a: Room, b: Room): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

function carveCell(cells: CellType[][], x: number, y: number): void {
  if (cells[y]![x] === "wall") cells[y]![x] = "floor";
}

function carveH(cells: CellType[][], y: number, x1: number, x2: number): void {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) carveCell(cells, x, y);
}

function carveV(cells: CellType[][], x: number, y1: number, y2: number): void {
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) carveCell(cells, x, y);
}

function carveCorridor(cells: CellType[][], a: Room, b: Room, rng: RNG): void {
  if (rng.next() < 0.5) {
    carveH(cells, a.cy, a.cx, b.cx);
    carveV(cells, b.cx, a.cy, b.cy);
  } else {
    carveV(cells, a.cx, a.cy, b.cy);
    carveH(cells, b.cy, a.cx, b.cx);
  }
}

function placeDoors(cells: CellType[][], rooms: Room[], rng: RNG): void {
  const inRoom = (x: number, y: number): boolean =>
    rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  const isWall = (x: number, y: number): boolean => cells[y]![x] === "wall";

  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (cells[y]![x] !== "floor" || inRoom(x, y)) continue;
      const wallL = isWall(x - 1, y);
      const wallR = isWall(x + 1, y);
      const wallU = isWall(x, y - 1);
      const wallD = isWall(x, y + 1);
      const horizontalPinch = wallL && wallR && !wallU && !wallD;
      const verticalPinch = wallU && wallD && !wallL && !wallR;
      if (horizontalPinch || verticalPinch) {
        cells[y]![x] = rng.next() < 0.6 ? "doorClosed" : "floor";
      }
    }
  }
}

function placeItems(cells: CellType[][], rooms: Room[], rng: RNG, depth: number): PlacedItem[] {
  const kinds = [T.Potion, T.Gold, T.Sword, T.Shield];
  const items: PlacedItem[] = [];
  const count = rng.int(3, 5) + Math.min(depth, 3);
  let guard = 0;
  while (items.length < count && guard++ < 500) {
    const room = rng.pick(rooms);
    const x = rng.int(room.x, room.x + room.w - 1);
    const y = rng.int(room.y, room.y + room.h - 1);
    if (cells[y]![x] !== "floor") continue;
    if (items.some((i) => i.x === x && i.y === y)) continue;
    items.push({ x, y, tile: rng.pick(kinds) });
  }
  return items;
}

export function generateMap(rng: RNG, depth: number): GameMap {
  const cells: CellType[][] = Array.from({ length: MAP_H }, () =>
    Array<CellType>(MAP_W).fill("wall"),
  );

  const rooms: Room[] = [];
  const targetRooms = rng.int(8, 12);
  for (let attempt = 0; attempt < 200 && rooms.length < targetRooms; attempt++) {
    const w = rng.int(4, 9);
    const h = rng.int(3, 7);
    const x = rng.int(1, MAP_W - w - 2);
    const y = rng.int(1, MAP_H - h - 2);
    const room: Room = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) };
    if (rooms.some((r) => overlaps(r, room))) continue;
    rooms.push(room);
    for (let ry = room.y; ry < room.y + room.h; ry++) {
      for (let rx = room.x; rx < room.x + room.w; rx++) {
        cells[ry]![rx] = "floor";
      }
    }
  }

  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(cells, rooms[i - 1]!, rooms[i]!, rng);
  }

  placeDoors(cells, rooms, rng);

  const spawnRoom = rooms[0]!;
  const stairsRoom = rooms[rooms.length - 1]!;
  cells[stairsRoom.cy]![stairsRoom.cx] = "stairs";

  const items = placeItems(cells, rooms, rng, depth);

  return {
    width: MAP_W,
    height: MAP_H,
    cells,
    rooms,
    spawn: { x: spawnRoom.cx, y: spawnRoom.cy },
    stairs: { x: stairsRoom.cx, y: stairsRoom.cy },
    items,
  };
}
