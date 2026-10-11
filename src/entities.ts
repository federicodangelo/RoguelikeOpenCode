import { RNG } from "./rng.ts";
import { T } from "./tiles.ts";
import { bfsDistances, MAP_W, type GameMap } from "./mapgen/common.ts";

export interface Entity {
  id: number;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  sprite: number;
  isPlayer: boolean;
  alive: boolean;
  xp: number;
  level: number;
  xpValue: number;
}

let nextId = 1;

interface Kind {
  name: string;
  sprite: number;
  hp: number;
  atk: number;
  def: number;
  minDepth: number;
  xp: number;
}

const KINDS: Kind[] = [
  { name: "rat", sprite: T.Rat, hp: 4, atk: 2, def: 0, minDepth: 1, xp: 2 },
  { name: "goblin", sprite: T.Goblin, hp: 8, atk: 3, def: 1, minDepth: 2, xp: 4 },
  { name: "skeleton", sprite: T.Skeleton, hp: 10, atk: 4, def: 2, minDepth: 3, xp: 6 },
];

export function makePlayer(x: number, y: number): Entity {
  return {
    id: nextId++,
    name: "you",
    x,
    y,
    hp: 12,
    maxHp: 12,
    atk: 3,
    def: 1,
    sprite: T.Player,
    isPlayer: true,
    alive: true,
    xp: 0,
    level: 1,
    xpValue: 0,
  };
}

export function attack(rng: RNG, attacker: Entity, defender: Entity): number {
  const dmg = Math.max(1, attacker.atk - defender.def + rng.int(-1, 1));
  defender.hp = Math.max(0, defender.hp - dmg);
  if (defender.hp === 0) defender.alive = false;
  return dmg;
}

export function xpNeeded(level: number): number {
  return level * 5;
}

export function gainXp(player: Entity, amount: number): number {
  player.xp += amount;
  let levels = 0;
  while (player.xp >= xpNeeded(player.level)) {
    player.xp -= xpNeeded(player.level);
    player.level += 1;
    player.maxHp += 2;
    player.hp = player.maxHp;
    player.atk += 1;
    player.def += 1;
    levels += 1;
  }
  return levels;
}

export function spawnMonsters(map: GameMap, rng: RNG, depth: number): Entity[] {
  const dist = bfsDistances(map.cells, map.spawn);
  const candidates: { x: number; y: number }[] = [];
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      const c = map.cells[y]![x]!;
      if (c === "wall" || c === "doorClosed") continue;
      if ((dist[y * MAP_W + x] ?? -1) < 6) continue;
      candidates.push({ x, y });
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }

  const available = KINDS.filter((k) => k.minDepth <= depth);
  const count = Math.min(3 + depth, candidates.length);
  const monsters: Entity[] = [];
  for (let i = 0; i < count; i++) {
    const kind = rng.pick(available);
    const pos = candidates[i]!;
    monsters.push({
      id: nextId++,
      name: kind.name,
      x: pos.x,
      y: pos.y,
      hp: kind.hp + depth,
      maxHp: kind.hp + depth,
      atk: kind.atk + Math.floor(depth / 2),
      def: kind.def + Math.floor(depth / 3),
      sprite: kind.sprite,
      isPlayer: false,
      alive: true,
      xp: 0,
      level: 1,
      xpValue: kind.xp,
    });
  }
  return monsters;
}
