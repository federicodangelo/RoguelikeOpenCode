import { describe, expect, it } from "bun:test";
import { RNG } from "../../src/core/rng.ts";
import {
  attack,
  BOSS_KIND,
  gainXp,
  getNextId,
  makePlayer,
  MONSTER_KINDS,
  setNextId,
  spawnMonsters,
} from "../../src/core/entities.ts";
import { generateMap } from "../../src/core/map.ts";
import { bfsDistances, MAP_H, MAP_W } from "../../src/core/mapgen/common.ts";
import { T } from "../../src/core/tiles.ts";
import { mkMap, openInterior, placedItem } from "./helpers.ts";

const KIND_BY_NAME = new Map([...MONSTER_KINDS, BOSS_KIND].map((kind) => [kind.name, kind]));

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
    expect(p.baseAtk).toBe(4);
    expect(p.baseDef).toBe(2);
    expect(p.atk).toBe(3);
    expect(p.def).toBe(1);
    expect(p.skillPoints).toBe(1);
  });

  it("grants multiple levels from one big award", () => {
    const p = makePlayer(0, 0);
    expect(gainXp(p, 20)).toBe(2);
    expect(p.level).toBe(3);
    expect(p.xp).toBe(5);
  });
});

describe("entity id counter", () => {
  it("setNextId moves the counter used by new entities", () => {
    const before = getNextId();
    setNextId(before + 100);
    const map = generateMap(new RNG(4242), 1, { algorithm: "bsp" });
    const monsters = spawnMonsters(map, new RNG(11), 1);
    expect(monsters.length).toBeGreaterThan(0);
    for (const m of monsters) expect(m.id).toBeGreaterThanOrEqual(before + 100);
    setNextId(before);
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
          const kind = KIND_BY_NAME.get(m.name);
          expect(kind).toBeDefined();
          expect(m.hp).toBe(kind!.hp + depth);
          expect(m.atk).toBe(kind!.atk + Math.floor(depth / 2));
          expect(m.def).toBe(kind!.def + Math.floor(depth / 3));
          expect(m.archetype).toBe(kind!.archetype);
          expect(m.speed).toBe(kind!.speed ?? 1);
          expect(m.range).toBe(kind!.range ?? 0);
          expect(m.isPlayer).toBe(false);
          expect(m.alive).toBe(true);
        }
        if (depth === 1) expect(monsters.every((m) => m.name === "rat")).toBe(true);
        if (depth === 2) expect(monsters.every((m) => m.name === "rat" || m.name === "goblin")).toBe(true);
      }
    });
  }

  it("never spawns on stairs, up-stairs, or item tiles", () => {
    const cells = openInterior();
    const map = mkMap(cells, { x: 1, y: 1 }, { x: 1, y: 1 });
    const dist = bfsDistances(cells, map.spawn);
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if ((dist[y * MAP_W + x] ?? -1) >= 6) cells[y]![x] = "stairs";
      }
    }
    for (const [x, y] of [
      [12, 1],
      [13, 1],
      [14, 1],
      [15, 1],
      [16, 1],
      [17, 1],
    ] as const)
      cells[y]![x] = "floor";
    cells[1]![18] = "stairsUp";
    map.items.push(placedItem(10, 1, "gold", T.Gold, 1), placedItem(11, 1, "potion", T.Potion, 5));

    const monsters = spawnMonsters(map, new RNG(3), 1);
    expect(monsters.length).toBe(4);
    for (const m of monsters) {
      expect(cells[m.y]![m.x]).toBe("floor");
      expect(map.items.some((i) => i.x === m.x && i.y === m.y)).toBe(false);
    }
  });

  it("spawns nothing when no monster kind is legal for the depth", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    expect(spawnMonsters(map, new RNG(3), 0)).toEqual([]);
  });
});
