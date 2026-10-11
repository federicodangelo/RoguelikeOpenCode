import { describe, expect, it } from "bun:test";
import { RNG } from "../src/rng.ts";
import { makePlayer, spawnMonsters, attack, gainXp } from "../src/entities.ts";
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

describe("attack", () => {
  it("damage = ATK - DEF + variance, minimum 1", () => {
    const rng = new RNG(5);
    const a = makePlayer(0, 0);
    const d = makePlayer(1, 0);
    for (let i = 0; i < 50; i++) {
      d.hp = 12;
      d.alive = true;
      const before = d.hp;
      const dmg = attack(rng, a, d);
      expect(dmg).toBeGreaterThanOrEqual(1);
      expect(dmg).toBeLessThanOrEqual(3);
      expect(d.hp).toBe(before - dmg);
    }
  });

  it("weak attacker vs strong defender still deals 1", () => {
    const rng = new RNG(6);
    const a = makePlayer(0, 0);
    a.atk = 1;
    const d = makePlayer(1, 0);
    d.def = 5;
    for (let i = 0; i < 20; i++) expect(attack(rng, a, d)).toBe(1);
  });

  it("kills when HP reaches 0", () => {
    const rng = new RNG(7);
    const a = makePlayer(0, 0);
    a.atk = 30;
    const d = makePlayer(1, 0);
    attack(rng, a, d);
    expect(d.hp).toBe(0);
    expect(d.alive).toBe(false);
  });
});

describe("gainXp", () => {
  it("levels up at threshold and carries leftover xp", () => {
    const p = makePlayer(0, 0);
    expect(gainXp(p, 4)).toBe(0);
    expect(p.level).toBe(1);
    expect(p.xp).toBe(4);
    expect(gainXp(p, 3)).toBe(1);
    expect(p.level).toBe(2);
    expect(p.xp).toBe(2);
    expect(p.maxHp).toBe(14);
    expect(p.hp).toBe(14);
    expect(p.atk).toBe(4);
    expect(p.def).toBe(2);
  });

  it("grants multiple levels from one big award", () => {
    const p = makePlayer(0, 0);
    expect(gainXp(p, 20)).toBe(2);
    expect(p.level).toBe(3);
    expect(p.xp).toBe(5);
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
