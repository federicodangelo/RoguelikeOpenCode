import { describe, expect, it } from "bun:test";
import { RNG } from "../../src/core/rng.ts";
import { generateMap, MAP_ALGORITHMS, pickAlgorithm } from "../../src/core/map.ts";
import { allReachable } from "./helpers.ts";

describe("pickAlgorithm", () => {
  it("cycles algorithms by depth", () => {
    expect(pickAlgorithm(1)).toBe("bsp");
    expect(pickAlgorithm(2)).toBe("cellular");
    expect(pickAlgorithm(3)).toBe("delaunay");
    expect(pickAlgorithm(4)).toBe("walk");
    expect(pickAlgorithm(5)).toBe("bsp");
    expect(pickAlgorithm(8)).toBe("walk");
  });
});

describe("generateMap", () => {
  for (const algorithm of MAP_ALGORITHMS) {
    it(`${algorithm}: produces a connected, well-formed map`, () => {
      for (let seed = 1; seed <= 10; seed++) {
        const map = generateMap(new RNG(seed * 1000 + seed), 1, { algorithm });
        expect(map.algorithm).toBe(algorithm);
        expect(map.width).toBe(40);
        expect(map.height).toBe(30);
        expect(map.cells[map.spawn.y]![map.spawn.x]).not.toBe("wall");
        expect(map.cells[map.stairs.y]![map.stairs.x]).toBe("stairs");
        expect(allReachable(map)).toBe(true);
        for (const item of map.items) {
          expect(map.cells[item.y]![item.x]).toBe("floor");
        }
      }
    });
  }

  it("places up-stairs at the requested point", () => {
    const map = generateMap(new RNG(7), 2, { algorithm: "bsp", upAt: { x: 4, y: 4 } });
    expect(map.upStairs).not.toBeNull();
    expect(map.cells[map.upStairs!.y]![map.upStairs!.x]).toBe("stairsUp");
  });

  it("relocates up-stairs to the nearest open cell when blocked", () => {
    const map = generateMap(new RNG(7), 2, { algorithm: "bsp", upAt: { x: 0, y: 0 } });
    expect(map.upStairs).not.toBeNull();
    expect(map.cells[map.upStairs!.y]![map.upStairs!.x]).toBe("stairsUp");
  });

  it("leaves upStairs null when no upAt is given", () => {
    const map = generateMap(new RNG(7), 1, { algorithm: "bsp" });
    expect(map.upStairs).toBeNull();
  });

  it("places traps on reachable floor cells", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const map = generateMap(new RNG(seed * 313), 1, { algorithm: "bsp" });
      let traps = 0;
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (map.cells[y]![x] !== "trap") continue;
          traps++;
          expect(x === map.spawn.x && y === map.spawn.y).toBe(false);
          expect(x === map.stairs.x && y === map.stairs.y).toBe(false);
          expect(map.items.some((i) => i.x === x && i.y === y)).toBe(false);
        }
      }
      expect(traps).toBeGreaterThan(0);
      expect(allReachable(map)).toBe(true);
    }
  });
});
