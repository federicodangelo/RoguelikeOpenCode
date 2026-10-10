import { describe, expect, it } from "bun:test";
import { RNG } from "../src/rng.ts";
import { makePlayer, spawnMonsters } from "../src/entities.ts";
import { generateMap } from "../src/map.ts";
import { bfsDistances, MAP_W } from "../src/mapgen/common.ts";
import { T } from "../src/tiles.ts";

const BASE = {
  rat: { hp: 4, atk: 2, def: 0 },
  goblin: { hp: 8, atk: 3, def: 1 },
  skeleton: { hp: 10, atk: 4, def: 2 },
} as const;

describe("makePlayer", () => {
  it("has the documented stats", () => {
    const p = makePlayer(3, 4);
    expect(p).toMatchObject({
      name: "you",
      x: 3,
      y: 4,
      hp: 12,
      maxHp: 12,
      atk: 3,
      def: 1,
      sprite: T.Player,
      isPlayer: true,
      alive: true,
    });
  });

  it("assigns unique ids", () => {
    const ids = new Set([makePlayer(1, 1).id, makePlayer(2, 2).id, makePlayer(3, 3).id]);
    expect(ids.size).toBe(3);
  });
});

describe("spawnMonsters", () => {
  for (const depth of [1, 2, 3, 4]) {
    it(`spawns 3 + depth monsters far from spawn at depth ${depth}`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        const map = generateMap(new RNG(seed * 977), depth, { algorithm: "bsp" });
        const monsters = spawnMonsters(map, new RNG(seed), depth);
        expect(monsters.length).toBe(3 + depth);
        const dist = bfsDistances(map.cells, map.spawn);
        for (const m of monsters) {
          expect(map.cells[m.y]![m.x]).not.toBe("wall");
          expect(map.cells[m.y]![m.x]).not.toBe("doorClosed");
          expect(dist[m.y * MAP_W + m.x]).toBeGreaterThanOrEqual(6);
          const base = BASE[m.name as keyof typeof BASE];
          expect(base).toBeDefined();
          expect(m.hp).toBe(base.hp + depth);
          expect(m.atk).toBe(base.atk + Math.floor(depth / 2));
          expect(m.def).toBe(base.def + Math.floor(depth / 3));
          expect(m.isPlayer).toBe(false);
          expect(m.alive).toBe(true);
        }
        if (depth === 1) expect(monsters.every((m) => m.name === "rat")).toBe(true);
        if (depth === 2) expect(monsters.every((m) => m.name === "rat" || m.name === "goblin")).toBe(true);
      }
    });
  }
});
