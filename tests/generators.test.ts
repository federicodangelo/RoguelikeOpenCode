import { describe, expect, it } from "bun:test";
import { RNG } from "../src/rng.ts";
import { MAP_H, MAP_W } from "../src/mapgen/common.ts";
import { generateBSP } from "../src/mapgen/bsp.ts";
import { generateCellular } from "../src/mapgen/cellular.ts";
import { generateDelaunay } from "../src/mapgen/delaunay.ts";
import { generateWalk } from "../src/mapgen/walk.ts";
import { allReachable, countOpen } from "./helpers.ts";

describe("generateBSP", () => {
  it("creates bounded rooms with spawn and stairs inside them", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const map = generateBSP(new RNG(seed), 1);
      expect(map.rooms.length).toBeGreaterThanOrEqual(1);
      for (const r of map.rooms) {
        expect(r.x).toBeGreaterThanOrEqual(1);
        expect(r.y).toBeGreaterThanOrEqual(1);
        expect(r.x + r.w).toBeLessThanOrEqual(MAP_W - 1);
        expect(r.y + r.h).toBeLessThanOrEqual(MAP_H - 1);
      }
      const inRoom = (x: number, y: number) =>
        map.rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
      expect(inRoom(map.spawn.x, map.spawn.y)).toBe(true);
      expect(inRoom(map.stairs.x, map.stairs.y)).toBe(true);
    }
  });
});

describe("generateCellular", () => {
  it("produces a single connected cave region of reasonable size", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const map = generateCellular(new RNG(seed * 31), 1);
      expect(countOpen(map.cells)).toBeGreaterThanOrEqual(300);
      expect(map.rooms.length).toBe(0);
      expect(allReachable(map)).toBe(true);
    }
  });
});

describe("generateDelaunay", () => {
  it("creates multiple connected rooms", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const map = generateDelaunay(new RNG(seed), 1);
      expect(map.rooms.length).toBeGreaterThanOrEqual(2);
      expect(allReachable(map)).toBe(true);
    }
  });
});

describe("generateWalk", () => {
  it("carves at least the open quota in one connected region", () => {
    const quota = Math.floor((MAP_W - 2) * (MAP_H - 2) * 0.4);
    for (let seed = 1; seed <= 10; seed++) {
      const map = generateWalk(new RNG(seed), 1);
      expect(countOpen(map.cells)).toBeGreaterThanOrEqual(quota);
      expect(allReachable(map)).toBe(true);
    }
  });
});
