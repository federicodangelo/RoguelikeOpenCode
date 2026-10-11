import { RNG } from "./rng.ts";
import { attack, type Entity } from "./entities.ts";
import { bfsDistances, MAP_W, type GameMap } from "./mapgen/common.ts";
import { computeFOV } from "./fov.ts";

const DIRS4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

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

export function monsterStep(m: Entity, ctx: MonsterContext): void {
  const { player, map, rng, dist, monsters } = ctx;
  const seesPlayer = computeFOV(map, m.x, m.y).has(player.y * MAP_W + player.x);
  const myDist = dist[m.y * MAP_W + m.x] ?? -1;

  if (seesPlayer && myDist !== -1) {
    let best: [number, number] | null = null;
    let bestDist = myDist;
    for (const [dx, dy] of DIRS4) {
      const nx = m.x + dx;
      const ny = m.y + dy;
      if (nx === player.x && ny === player.y) {
        attack(rng, m, player);
        return;
      }
      const cell = map.cells[ny]?.[nx];
      if (!cell || cell === "wall" || cell === "doorClosed") continue;
      if (occupied(m, nx, ny, monsters)) continue;
      const d = dist[ny * MAP_W + nx] ?? -1;
      if (d !== -1 && d < bestDist) {
        bestDist = d;
        best = [dx, dy];
      }
    }
    if (best) {
      m.x += best[0];
      m.y += best[1];
      return;
    }
  }

  if (rng.next() < 0.5) {
    const [dx, dy] = rng.pick(DIRS4);
    const nx = m.x + dx;
    const ny = m.y + dy;
    const cell = map.cells[ny]?.[nx];
    if (!cell || cell === "wall" || cell === "doorClosed") return;
    if (nx === player.x && ny === player.y) return;
    if (occupied(m, nx, ny, monsters)) return;
    m.x = nx;
    m.y = ny;
  }
}
