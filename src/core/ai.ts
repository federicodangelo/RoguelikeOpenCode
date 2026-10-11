import { RNG } from "./rng.ts";
import { attack, type Entity } from "./entities.ts";
import { bfsDistances, MAP_W, type GameMap } from "./mapgen/common.ts";
import { computeFOV } from "./fov.ts";
import { effectiveSpeed, hasStatus } from "./status.ts";

const DIRS4: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function chaseDistances(map: GameMap, player: Entity): Int32Array {
  return bfsDistances(map.cells, { x: player.x, y: player.y }, (c) => c === "doorClosed");
}

export interface MonsterContext {
  player: Entity;
  map: GameMap;
  rng: RNG;
  dist: Int32Array;
  monsters: Entity[];
}

function occupied(m: Entity, x: number, y: number, monsters: Entity[]): boolean {
  return monsters.some((o) => o !== m && o.alive && o.x === x && o.y === y);
}

function canMove(m: Entity, nx: number, ny: number, player: Entity, map: GameMap, monsters: Entity[]): boolean {
  const cell = map.cells[ny]?.[nx];
  if (!cell || cell === "wall" || cell === "doorClosed") return false;
  if (nx === player.x && ny === player.y) return false;
  return !occupied(m, nx, ny, monsters);
}

function moveTowards(m: Entity, player: Entity, map: GameMap, dist: Int32Array, monsters: Entity[]): boolean {
  const myDist = dist[m.y * MAP_W + m.x] ?? -1;
  let best: [number, number] | null = null;
  let bestDist = myDist;
  for (const [dx, dy] of DIRS4) {
    const nx = m.x + dx;
    const ny = m.y + dy;
    if (!canMove(m, nx, ny, player, map, monsters)) continue;
    const d = dist[ny * MAP_W + nx] ?? -1;
    if (d !== -1 && d < bestDist) {
      bestDist = d;
      best = [dx, dy];
    }
  }
  if (!best) return false;
  m.x += best[0];
  m.y += best[1];
  return true;
}

function moveAway(m: Entity, player: Entity, map: GameMap, dist: Int32Array, monsters: Entity[]): boolean {
  const myDist = dist[m.y * MAP_W + m.x] ?? -1;
  let best: [number, number] | null = null;
  let bestDist = myDist;
  for (const [dx, dy] of DIRS4) {
    const nx = m.x + dx;
    const ny = m.y + dy;
    if (!canMove(m, nx, ny, player, map, monsters)) continue;
    const d = dist[ny * MAP_W + nx] ?? -1;
    if (d === -1) continue;
    if (myDist === -1 || d > bestDist) {
      bestDist = d;
      best = [dx, dy];
    }
  }
  if (!best) return false;
  m.x += best[0];
  m.y += best[1];
  return true;
}

export function monsterStep(m: Entity, ctx: MonsterContext): void {
  const { player, map, rng, dist, monsters } = ctx;
  if (hasStatus(m, "stun")) return;

  const seesPlayer = computeFOV(map, m.x, m.y).has(player.y * MAP_W + player.x);
  const myDist = dist[m.y * MAP_W + m.x] ?? -1;

  if (hasStatus(m, "fear")) {
    moveAway(m, player, map, dist, monsters);
    return;
  }

  if (seesPlayer && myDist !== -1) {
    if (m.range > 0 && myDist <= m.range) {
      attack(rng, m, player);
      return;
    }

    for (let step = 0; step < effectiveSpeed(m); step++) {
      const adjacent = DIRS4.some(([dx, dy]) => m.x + dx === player.x && m.y + dy === player.y);
      if (adjacent) {
        attack(rng, m, player);
        return;
      }
      if (!moveTowards(m, player, map, dist, monsters)) break;
    }
    return;
  }

  if (rng.next() < 0.5) {
    const [dx, dy] = rng.pick(DIRS4);
    const nx = m.x + dx;
    const ny = m.y + dy;
    if (!canMove(m, nx, ny, player, map, monsters)) return;
    m.x = nx;
    m.y = ny;
  }
}
