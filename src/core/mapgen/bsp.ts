import { RNG } from "../rng.ts";
import {
  MAP_W,
  MAP_H,
  emptyCells,
  carveCell,
  carveCorridor,
  placeDoors,
  placeItems,
  makeMap,
  type GameMap,
  type Point,
  type Room,
} from "./common.ts";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Tree {
  room: Room | null;
}

function makeRoom(rect: Rect, rng: RNG): Room | null {
  const maxW = Math.min(9, rect.w - 2);
  const maxH = Math.min(7, rect.h - 2);
  if (maxW < 3 || maxH < 3) return null;
  const w = rng.int(3, maxW);
  const h = rng.int(3, maxH);
  const x = rect.x + rng.int(1, rect.w - w - 1);
  const y = rect.y + rng.int(1, rect.h - h - 1);
  return { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) };
}

function build(cells: ReturnType<typeof emptyCells>, rect: Rect, rng: RNG, depth: number, rooms: Room[]): Tree {
  const canH = rect.h >= 10;
  const canV = rect.w >= 10;
  const isLeaf = depth >= 5 || (!canH && !canV) || (depth >= 3 && rng.next() < 0.3);

  if (isLeaf) {
    const room = makeRoom(rect, rng);
    if (room) {
      rooms.push(room);
      for (let ry = room.y; ry < room.y + room.h; ry++) {
        for (let rx = room.x; rx < room.x + room.w; rx++) {
          carveCell(cells, rx, ry);
        }
      }
    }
    return { room };
  }

  const horizontal = canH && (!canV || rect.h >= rect.w);
  let left: Tree;
  let right: Tree;
  if (horizontal) {
    const cut = rng.int(5, rect.h - 5);
    left = build(cells, { x: rect.x, y: rect.y, w: rect.w, h: cut }, rng, depth + 1, rooms);
    right = build(cells, { x: rect.x, y: rect.y + cut, w: rect.w, h: rect.h - cut }, rng, depth + 1, rooms);
  } else {
    const cut = rng.int(5, rect.w - 5);
    left = build(cells, { x: rect.x, y: rect.y, w: cut, h: rect.h }, rng, depth + 1, rooms);
    right = build(cells, { x: rect.x + cut, y: rect.y, w: rect.w - cut, h: rect.h }, rng, depth + 1, rooms);
  }

  if (left.room && right.room) {
    carveCorridor(cells, { x: left.room.cx, y: left.room.cy }, { x: right.room.cx, y: right.room.cy }, rng);
  }
  return { room: left.room ?? right.room };
}

export function generateBSP(rng: RNG, depth: number): GameMap {
  const cells = emptyCells();
  const rooms: Room[] = [];
  build(cells, { x: 1, y: 1, w: MAP_W - 2, h: MAP_H - 2 }, rng, 0, rooms);

  if (rooms.length === 0) {
    rooms.push({ x: 2, y: 2, w: 4, h: 3, cx: 4, cy: 3 });
    for (let ry = 2; ry < 5; ry++) {
      for (let rx = 2; rx < 6; rx++) carveCell(cells, rx, ry);
    }
  }

  placeDoors(cells, rooms, rng);

  const spawnRoom = rooms[0]!;
  const stairsRoom = rooms[rooms.length - 1]!;
  const spawn: Point = { x: spawnRoom.cx, y: spawnRoom.cy };
  const stairs: Point = { x: stairsRoom.cx, y: stairsRoom.cy };
  cells[stairs.y]![stairs.x] = "stairs";

  const items = placeItems(cells, rng, depth, [spawn, stairs]);
  return makeMap(cells, "bsp", rooms, spawn, stairs, items);
}
