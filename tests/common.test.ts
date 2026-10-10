import { describe, expect, it } from "bun:test";
import { RNG } from "../src/rng.ts";
import { T } from "../src/tiles.ts";
import {
  bfsDistances,
  bfsFarthest,
  carveCell,
  carveCorridor,
  carveH,
  carveV,
  emptyCells,
  keepLargestRegion,
  MAP_H,
  MAP_W,
  nearestOpen,
  overlaps,
  placeDoors,
  placeItems,
  type CellType,
  type Room,
} from "../src/mapgen/common.ts";
import { openInterior } from "./helpers.ts";

describe("emptyCells", () => {
  it("is all walls with map dimensions", () => {
    const cells = emptyCells();
    expect(cells.length).toBe(MAP_H);
    expect(cells[0]!.length).toBe(MAP_W);
    for (const row of cells) for (const c of row) expect(c).toBe("wall");
  });
});

describe("overlaps", () => {
  const a: Room = { x: 5, y: 5, w: 4, h: 3, cx: 7, cy: 6 };

  it("detects overlapping rooms", () => {
    expect(overlaps(a, { x: 7, y: 6, w: 4, h: 3, cx: 9, cy: 7 })).toBe(true);
  });

  it("treats edge-touching rooms as overlapping (conservative)", () => {
    expect(overlaps(a, { x: 9, y: 5, w: 4, h: 3, cx: 11, cy: 6 })).toBe(true);
  });

  it("separates rooms with a gap", () => {
    expect(overlaps(a, { x: 10, y: 5, w: 4, h: 3, cx: 12, cy: 6 })).toBe(false);
  });
});

describe("carving", () => {
  it("carveCell turns walls into floor but leaves other cell types", () => {
    const cells = emptyCells();
    carveCell(cells, 5, 5);
    expect(cells[5]![5]).toBe("floor");
    cells[5]![5] = "stairs";
    carveCell(cells, 5, 5);
    expect(cells[5]![5]).toBe("stairs");
  });

  it("carveH and carveV carve inclusive ranges in any order", () => {
    const cells = emptyCells();
    carveH(cells, 3, 7, 4);
    carveV(cells, 10, 8, 6);
    for (let x = 4; x <= 7; x++) expect(cells[3]![x]).toBe("floor");
    for (let y = 6; y <= 8; y++) expect(cells[y]![10]).toBe("floor");
  });

  it("carveCorridor connects two points", () => {
    const cells = emptyCells();
    carveCorridor(cells, { x: 5, y: 5 }, { x: 10, y: 8 }, new RNG(1));
    expect(cells[5]![5]).toBe("floor");
    expect(cells[8]![10]).toBe("floor");
    const dist = bfsDistances(cells, { x: 5, y: 5 });
    expect(dist[8 * MAP_W + 10]).toBeGreaterThan(-1);
  });
});

describe("bfs helpers", () => {
  it("bfsDistances measures steps and marks walls as -1", () => {
    const cells = emptyCells();
    carveH(cells, 5, 2, 6);
    const dist = bfsDistances(cells, { x: 2, y: 5 });
    expect(dist[5 * MAP_W + 2]).toBe(0);
    expect(dist[5 * MAP_W + 6]).toBe(4);
    expect(dist[6 * MAP_W + 2]).toBe(-1);
  });

  it("bfsFarthest returns the far end of a corridor", () => {
    const cells = emptyCells();
    carveH(cells, 5, 2, 10);
    expect(bfsFarthest(cells, { x: 2, y: 5 })).toEqual({ x: 10, y: 5 });
  });
});

describe("keepLargestRegion", () => {
  it("keeps the largest floor region and walls off the rest", () => {
    const cells = emptyCells();
    carveH(cells, 5, 2, 10);
    carveCell(cells, 20, 20);
    carveCell(cells, 21, 20);
    keepLargestRegion(cells);
    for (let x = 2; x <= 10; x++) expect(cells[5]![x]).toBe("floor");
    expect(cells[20]![20]).toBe("wall");
    expect(cells[20]![21]).toBe("wall");
  });

  it("does nothing when everything is one region", () => {
    const cells = emptyCells();
    carveH(cells, 5, 2, 10);
    keepLargestRegion(cells);
    expect(cells[5]![2]).toBe("floor");
  });
});

describe("nearestOpen", () => {
  it("returns the point itself when it is floor", () => {
    const cells = emptyCells();
    cells[10]![10] = "floor";
    expect(nearestOpen(cells, { x: 10, y: 10 })).toEqual({ x: 10, y: 10 });
  });

  it("finds the nearest floor around a wall", () => {
    const cells = emptyCells();
    cells[10]![11] = "floor";
    expect(nearestOpen(cells, { x: 10, y: 10 })).toEqual({ x: 11, y: 10 });
  });

  it("returns null when the map is solid wall", () => {
    expect(nearestOpen(emptyCells(), { x: 10, y: 10 })).toBeNull();
  });
});

describe("placeItems", () => {
  it("places items on unreserved floor cells with valid tiles", () => {
    const cells = openInterior();
    const rng = new RNG(3);
    const reserved = [
      { x: 2, y: 2 },
      { x: 30, y: 20 },
    ];
    const items = placeItems(cells, rng, 1, reserved);
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.length).toBeLessThanOrEqual(8);
    for (const item of items) {
      expect(cells[item.y]![item.x]).toBe("floor");
      expect(reserved.some((p) => p.x === item.x && p.y === item.y)).toBe(false);
      expect([T.Potion, T.Gold, T.Sword, T.Shield] as number[]).toContain(item.tile);
    }
  });
});

describe("placeDoors", () => {
  const isPinched = (cells: CellType[][], x: number, y: number): boolean => {
    const wall = (dx: number, dy: number) => cells[y + dy]?.[x + dx] === "wall";
    const horiz = wall(-1, 0) && wall(1, 0);
    const vert = wall(0, -1) && wall(0, 1);
    return horiz !== vert;
  };

  const noAdjacentPairs = (cells: CellType[][]): boolean => {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (cells[y]![x] !== "doorClosed") continue;
        if (cells[y]![x + 1] === "doorClosed") return false;
        if (cells[y + 1]?.[x] === "doorClosed") return false;
      }
    }
    return true;
  };

  it("does nothing without rooms", () => {
    const cells = openInterior();
    placeDoors(cells, [], new RNG(1));
    for (const row of cells) expect(row).not.toContain("doorClosed");
  });

  it("places doors only at pinched 1-wide entrances, never adjacent pairs", () => {
    const room: Room = { x: 5, y: 5, w: 4, h: 3, cx: 7, cy: 6 };
    let placed = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const cells = emptyCells();
      for (let y = 5; y <= 7; y++) for (let x = 5; x <= 8; x++) cells[y]![x] = "floor";
      carveV(cells, 7, 8, 10);
      placeDoors(cells, [room], new RNG(seed));
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          if (cells[y]![x] === "doorClosed") {
            placed++;
            expect(isPinched(cells, x, y)).toBe(true);
          }
        }
      }
      expect(noAdjacentPairs(cells)).toBe(true);
    }
    expect(placed).toBeGreaterThan(0);
  });
});
