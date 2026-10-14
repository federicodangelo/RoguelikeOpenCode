import { spawnMonsters, type Entity } from "./entities.ts";
import { generateMap, type GameMap, type Point } from "./map.ts";
import { RNG } from "./rng.ts";
import type { SavedFloor } from "./save.ts";

export class FloorCache {
  readonly maps = new Map<number, GameMap>();
  readonly monsters = new Map<number, Entity[]>();
  readonly explored = new Map<number, Set<number>>();
  version = 0;
  exploredVersion = 0;

  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  setSeed(seed: number): void {
    this.seed = seed;
  }

  get(depth: number, upAt?: Point): GameMap {
    let map = this.maps.get(depth);
    if (!map) {
      map = generateMap(new RNG(this.seed + depth * 7919), depth, { upAt });
      this.maps.set(depth, map);
      this.monsters.set(depth, spawnMonsters(map, new RNG(this.seed + depth * 7919 + 17), depth));
      this.version++;
    }
    return map;
  }

  monstersAt(depth: number): Entity[] {
    return this.monsters.get(depth)!;
  }

  ensureExplored(depth: number): Set<number> {
    let explored = this.explored.get(depth);
    if (!explored) {
      explored = new Set<number>();
      this.explored.set(depth, explored);
      this.exploredVersion++;
    }
    return explored;
  }

  clear(): void {
    this.maps.clear();
    this.monsters.clear();
    this.explored.clear();
  }

  loadFloors(floors: SavedFloor[]): void {
    this.clear();
    for (const floor of floors) {
      this.maps.set(floor.depth, floor.map);
      this.monsters.set(floor.depth, floor.monsters);
      this.explored.set(floor.depth, new Set(floor.explored));
    }
  }

  serializeFloors(): SavedFloor[] {
    return [...this.maps.entries()].map(([depth, map]) => ({
      depth,
      map,
      monsters: this.monsters.get(depth) ?? [],
      explored: [...(this.explored.get(depth) ?? [])],
    }));
  }
}
