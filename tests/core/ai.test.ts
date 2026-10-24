import { describe, expect, it } from "bun:test";
import { RNG } from "../../src/core/rng.ts";
import { chaseDistances, monsterStep } from "../../src/core/ai.ts";
import { makePlayer, type Entity } from "../../src/core/entities.ts";
import { MAP_W } from "../../src/core/mapgen/common.ts";
import { T } from "../../src/core/tiles.ts";
import { mkMap, openInterior } from "./helpers.ts";

function monster(x: number, y: number, overrides: Partial<Entity> = {}): Entity {
  return {
    id: 1,
    name: "rat",
    x,
    y,
    hp: 4,
    maxHp: 4,
    atk: 2,
    def: 0,
    baseAtk: 2,
    baseDef: 0,
    sprite: T.Rat,
    isPlayer: false,
    alive: true,
    xp: 0,
    level: 1,
    xpValue: 2,
    skillPoints: 0,
    archetype: "normal",
    speed: 1,
    range: 0,
    statuses: [],
    ...overrides,
  };
}

describe("chaseDistances", () => {
  it("blocks walls and closed doors", () => {
    const cells = openInterior();
    cells[10]![12] = "doorClosed";
    const dist = chaseDistances(mkMap(cells), makePlayer(10, 10));
    expect(dist[10 * MAP_W + 10]).toBe(0);
    expect(dist[10 * MAP_W + 12]).toBe(-1);
    expect(dist[12 * MAP_W + 11]).toBe(3);
  });
});

describe("monsterStep", () => {
  it("chases a player at the edge of the light radius without taking a random step", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(10, 18);
    const rng = new RNG(1);
    const before = rng.getState();

    monsterStep(m, { player, map, rng, dist: chaseDistances(map, player), monsters: [m] });

    expect(m.y).toBe(17);
    expect(rng.getState()).toBe(before);
  });

  it("wanders instead of chasing a player standing outside the light radius", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(10, 19);
    const rng = new RNG(1);
    const before = rng.getState();

    monsterStep(m, { player, map, rng, dist: chaseDistances(map, player), monsters: [m] });

    expect(player.hp).toBe(12);
    expect(rng.getState()).not.toBe(before);
  });

  it("attacks the player when adjacent and visible", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(11, 10);
    monsterStep(m, { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m] });
    expect(player.hp).toBeLessThan(12);
    expect(m.x).toBe(11);
    expect(m.y).toBe(10);
  });

  it("chases toward the player along the BFS path when visible", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(14, 10);
    monsterStep(m, { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m] });
    expect(m.x).toBe(13);
    expect(m.y).toBe(10);
  });

  it("does not attack or chase when the player is out of sight", () => {
    const cells = openInterior();
    for (let y = 5; y <= 20; y++) cells[y]![12] = "wall";
    const map = mkMap(cells, { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(14, 10);
    monsterStep(m, { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m] });
    expect(player.hp).toBe(12);
  });

  it("does not move into another monster", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const blocker = monster(13, 10);
    const m = monster(14, 10);
    monsterStep(m, { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m, blocker] });
    expect(m.x).not.toBe(13);
  });

  it("shoots from range instead of closing distance", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(13, 10, { name: "archer", archetype: "ranged", range: 5, sprite: T.Archer });
    monsterStep(m, { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m] });
    expect(player.hp).toBeLessThan(12);
    expect(m.x).toBe(13);
    expect(m.y).toBe(10);
  });

  it("reloads for three turns between ranged shots", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(13, 10, { name: "archer", archetype: "ranged", range: 5, sprite: T.Archer });
    const ctx = { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m] };

    monsterStep(m, ctx);
    const hpAfterShot = player.hp;
    expect(hpAfterShot).toBeLessThan(12);
    expect(m.shootCooldown).toBe(3);

    monsterStep(m, ctx);
    monsterStep(m, ctx);
    monsterStep(m, ctx);
    expect(player.hp).toBe(hpAfterShot);
    expect(m.shootCooldown).toBe(0);
    expect(m.x).toBe(13);
    expect(m.y).toBe(10);

    monsterStep(m, ctx);
    expect(player.hp).toBeLessThan(hpAfterShot);
    expect(m.shootCooldown).toBe(3);
  });

  it("reloading ranged monsters back away when adjacent", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(11, 10, { name: "archer", archetype: "ranged", range: 5, sprite: T.Archer, shootCooldown: 1 });
    monsterStep(m, { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m] });
    expect(player.hp).toBe(12);
    expect(m.x).toBe(12);
    expect(m.y).toBe(10);
    expect(m.shootCooldown).toBe(0);
  });

  it("stunned monsters do not act", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(11, 10, { statuses: [{ kind: "stun", turns: 1, power: 1 }] });
    monsterStep(m, { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m] });
    expect(player.hp).toBe(12);
    expect(m.x).toBe(11);
    expect(m.y).toBe(10);
  });

  it("feared monsters move away from the player", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(12, 10, { statuses: [{ kind: "fear", turns: 2, power: 1 }] });
    monsterStep(m, { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m] });
    expect(m.x).toBe(13);
    expect(m.y).toBe(10);
  });

  it("haste increases chase steps", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(14, 10, { statuses: [{ kind: "haste", turns: 2, power: 1 }] });
    monsterStep(m, { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m] });
    expect(m.x).toBe(12);
    expect(m.y).toBe(10);
  });

  it("fast monsters take multiple chase steps", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(14, 10, { name: "wolf", archetype: "fast", speed: 2, sprite: T.Wolf });
    monsterStep(m, { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m] });
    expect(m.x).toBe(12);
    expect(m.y).toBe(10);
  });

  it("wanders only into safe tiles when the player is out of sight", () => {
    const cells = openInterior();
    for (let y = 5; y <= 20; y++) cells[y]![12] = "wall";
    cells[10]![13] = "wall";
    cells[10]![15] = "doorClosed";

    const map = mkMap(cells, { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const blocker = monster(14, 9);
    const m = monster(14, 10);

    for (let seed = 1; seed <= 50; seed++) {
      m.x = 14;
      m.y = 10;
      monsterStep(m, {
        player,
        map,
        rng: new RNG(seed),
        dist: chaseDistances(map, player),
        monsters: [m, blocker],
      });

      expect(player.hp).toBe(12);
      expect(m.x).toBe(14);
      expect(m.y === 10 || m.y === 11).toBe(true);
      expect(map.cells[m.y]![m.x]).toBe("floor");
    }
  });
});
