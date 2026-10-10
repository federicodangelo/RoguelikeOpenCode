import { RNG } from "../rng.ts";
import {
  MAP_W,
  MAP_H,
  emptyCells,
  carveCell,
  carveCorridor,
  overlaps,
  placeDoors,
  placeItems,
  makeMap,
  type GameMap,
  type Point,
  type Room,
} from "./common.ts";

function inCircumcircle(a: Point, b: Point, c: Point, p: Point): boolean {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return false;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const ux = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const uy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  const r2 = (a.x - ux) * (a.x - ux) + (a.y - uy) * (a.y - uy);
  const p2 = (p.x - ux) * (p.x - ux) + (p.y - uy) * (p.y - uy);
  return p2 <= r2 + 1e-9;
}

function triangulate(points: Point[]): [number, number][] {
  const pts: Point[] = [
    { x: -500, y: -500 },
    { x: 1500, y: -500 },
    { x: 500, y: 1500 },
    ...points,
  ];
  let tris: [number, number, number][] = [[0, 1, 2]];

  const edgesOf = (t: [number, number, number]): [number, number][] => [
    [t[0], t[1]],
    [t[1], t[2]],
    [t[2], t[0]],
  ];

  for (let i = 3; i < pts.length; i++) {
    const p = pts[i]!;
    const bad = tris.filter((t) => inCircumcircle(pts[t[0]]!, pts[t[1]]!, pts[t[2]]!, p));
    const boundary: [number, number][] = [];
    for (const t of bad) {
      for (const e of edgesOf(t)) {
        const shared = bad.some(
          (o) =>
            o !== t &&
            edgesOf(o).some((oe) => (oe[0] === e[0] && oe[1] === e[1]) || (oe[0] === e[1] && oe[1] === e[0])),
        );
        if (!shared) boundary.push(e);
      }
    }
    tris = tris.filter((t) => !bad.includes(t));
    for (const [a, b] of boundary) tris.push([a, b, i]);
  }

  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const t of tris) {
    for (const [a, b] of edgesOf(t)) {
      if (a < 3 || b < 3) continue;
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([a - 3, b - 3]);
    }
  }
  return out;
}

function prim(n: number, edges: [number, number][], centers: Point[]): [number, number][] {
  const inTree = new Set<number>([0]);
  const result: [number, number][] = [];
  while (inTree.size < n) {
    let best: [number, number] | null = null;
    let bestLen = Infinity;
    for (const [a, b] of edges) {
      if (inTree.has(a) === inTree.has(b)) continue;
      const len = Math.hypot(centers[a]!.x - centers[b]!.x, centers[a]!.y - centers[b]!.y);
      if (len < bestLen) {
        bestLen = len;
        best = [a, b];
      }
    }
    if (!best) break;
    result.push(best);
    inTree.add(best[0]);
    inTree.add(best[1]);
  }
  return result;
}

export function generateDelaunay(rng: RNG, depth: number): GameMap {
  const cells = emptyCells();
  const rooms: Room[] = [];
  const targetRooms = rng.int(10, 14);

  for (let attempt = 0; attempt < 300 && rooms.length < targetRooms; attempt++) {
    const w = rng.int(4, 8);
    const h = rng.int(3, 6);
    const x = rng.int(1, MAP_W - w - 2);
    const y = rng.int(1, MAP_H - h - 2);
    const room: Room = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) };
    if (rooms.some((r) => overlaps(room, r))) continue;
    rooms.push(room);
  }

  for (const r of rooms) {
    for (let ry = r.y; ry < r.y + r.h; ry++) {
      for (let rx = r.x; rx < r.x + r.w; rx++) {
        carveCell(cells, rx, ry);
      }
    }
  }

  if (rooms.length >= 2) {
    const centers = rooms.map((r) => ({ x: r.cx, y: r.cy }));
    const edges = triangulate(centers);
    const tree = prim(rooms.length, edges, centers);
    const treeKeys = new Set(tree.map(([a, b]) => (a < b ? `${a},${b}` : `${b},${a}`)));
    const extra = edges.filter(([a, b]) => !treeKeys.has(a < b ? `${a},${b}` : `${b},${a}`));
    for (let i = extra.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [extra[i], extra[j]] = [extra[j]!, extra[i]!];
    }
    const loops = extra.slice(0, Math.floor(extra.length * 0.15));
    for (const [a, b] of [...tree, ...loops]) {
      carveCorridor(cells, centers[a]!, centers[b]!, rng);
    }
  }

  placeDoors(cells, rooms, rng);

  const spawnRoom = rooms[0] ?? { cx: 2, cy: 2 };
  const stairsRoom = rooms[rooms.length - 1] ?? spawnRoom;
  const spawn: Point = { x: spawnRoom.cx, y: spawnRoom.cy };
  const stairs: Point = { x: stairsRoom.cx, y: stairsRoom.cy };
  cells[stairs.y]![stairs.x] = "stairs";

  const items = placeItems(cells, rng, depth, [spawn, stairs]);
  return makeMap(cells, "delaunay", rooms, spawn, stairs, items);
}
