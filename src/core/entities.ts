import { RNG } from "./rng.ts";
import { T } from "./tiles.ts";
import { bfsDistances, MAP_W, type GameMap } from "./mapgen/common.ts";
import { addStatus } from "./status.ts";

export type Archetype = "normal" | "ranged" | "fast" | "tank" | "summoner" | "boss";

export type StatusKind = "poison" | "bleeding" | "haste" | "stun" | "fear";

export interface Status {
  kind: StatusKind;
  turns: number;
  power: number;
}

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
  skillPoints: number;
  archetype: Archetype;
  speed: number;
  range: number;
  statuses: Status[];
  panicked?: boolean;
}

let nextId = 1;

export function getNextId(): number {
  return nextId;
}

export function setNextId(value: number): void {
  const n = Math.trunc(value);
  nextId = Number.isFinite(n) && n >= 1 ? n : 1;
}

interface Kind {
  name: string;
  sprite: number;
  hp: number;
  atk: number;
  def: number;
  minDepth: number;
  xp: number;
  archetype: Archetype;
  speed?: number;
  range?: number;
}

export const MONSTER_KINDS: Kind[] = [
  { name: "rat", sprite: T.Rat, hp: 4, atk: 2, def: 0, minDepth: 1, xp: 2, archetype: "normal" },
  { name: "goblin", sprite: T.Goblin, hp: 8, atk: 3, def: 1, minDepth: 2, xp: 4, archetype: "normal" },
  { name: "skeleton", sprite: T.Skeleton, hp: 10, atk: 4, def: 2, minDepth: 3, xp: 6, archetype: "normal" },
  { name: "archer", sprite: T.Archer, hp: 8, atk: 3, def: 1, minDepth: 4, xp: 7, archetype: "ranged", range: 5 },
  { name: "wolf", sprite: T.Wolf, hp: 7, atk: 4, def: 0, minDepth: 4, xp: 7, archetype: "fast", speed: 2 },
  { name: "ogre", sprite: T.Ogre, hp: 18, atk: 5, def: 4, minDepth: 5, xp: 12, archetype: "tank" },
  { name: "warlock", sprite: T.Warlock, hp: 12, atk: 4, def: 2, minDepth: 6, xp: 14, archetype: "summoner" },
];

export const BOSS_KIND: Kind = {
  name: "demon",
  sprite: T.Demon,
  hp: 34,
  atk: 7,
  def: 4,
  minDepth: 5,
  xp: 30,
  archetype: "boss",
  speed: 1,
};

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
    skillPoints: 0,
    archetype: "normal",
    speed: 1,
    range: 0,
    statuses: [],
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
    player.skillPoints += 1;
    levels += 1;
  }
  return levels;
}

function makeMonster(kind: Kind, x: number, y: number, depth: number): Entity {
  return {
    id: nextId++,
    name: kind.name,
    x,
    y,
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
    skillPoints: 0,
    archetype: kind.archetype,
    speed: kind.speed ?? 1,
    range: kind.range ?? 0,
    statuses: [],
  };
}

export function spawnMonsters(map: GameMap, rng: RNG, depth: number): Entity[] {
  const dist = bfsDistances(map.cells, map.spawn);
  const candidates: { x: number; y: number }[] = [];
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      const c = map.cells[y]![x]!;
      if (c === "wall" || c === "doorClosed" || c === "trap" || c === "stairs" || c === "stairsUp") continue;
      if (map.items.some((i) => i.x === x && i.y === y)) continue;
      if ((dist[y * MAP_W + x] ?? -1) < 6) continue;
      candidates.push({ x, y });
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }

  const available = MONSTER_KINDS.filter((k) => k.minDepth <= depth);
  const count = Math.min(3 + depth, candidates.length);
  const monsters: Entity[] = [];
  let next = 0;

  if (depth % 5 === 0 && candidates.length > 0) {
    monsters.push(makeMonster(BOSS_KIND, candidates[next]!.x, candidates[next]!.y, depth));
    next++;
  }

  while (monsters.length < count && next < candidates.length) {
    const kind = rng.pick(available);
    const pos = candidates[next]!;
    const monster = makeMonster(kind, pos.x, pos.y, depth);
    if (kind.archetype === "fast") addStatus(monster, "haste", 3, 1);
    monsters.push(monster);
    next++;
  }
  return monsters;
}
