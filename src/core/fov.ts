import { MAP_W, MAP_H, type GameMap } from "./mapgen/common.ts";

export const FOV_RADIUS = 8;

const OCTANTS: [number, number, number, number][] = [
  [1, 0, 0, -1],
  [1, 0, 0, 1],
  [-1, 0, 0, -1],
  [-1, 0, 0, 1],
  [0, 1, -1, 0],
  [0, 1, 1, 0],
  [0, -1, -1, 0],
  [0, -1, 1, 0],
];

export function computeFOV(map: GameMap, ox: number, oy: number, radius = FOV_RADIUS): Set<number> {
  const visible = new Set<number>([oy * MAP_W + ox]);
  const isOpaque = (x: number, y: number): boolean => isOpaqueAt(map, x, y);
  for (const [xx, xy, yx, yy] of OCTANTS) {
    castLight(1, 0, 1, ox, oy, radius, xx, xy, yx, yy, visible, isOpaque);
  }
  return visible;
}

function isOpaqueAt(map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return true;
  const c = map.cells[y]![x]!;
  return c === "wall" || c === "doorClosed";
}

/**
 * Ray between two cells: true when no opaque cell stands strictly between them. The endpoints
 * are never blockers, so the caller's own cell and the target's cell are always transparent.
 * Diagonal steps may not squeeze through the gap between two touching walls.
 */
export function hasLineOfSight(map: GameMap, fromX: number, fromY: number, toX: number, toY: number): boolean {
  const dx = Math.abs(toX - fromX);
  const dy = Math.abs(toY - fromY);
  const sx = fromX < toX ? 1 : -1;
  const sy = fromY < toY ? 1 : -1;
  let x = fromX;
  let y = fromY;
  let err = dx - dy;
  while (x !== toX || y !== toY) {
    const e2 = err * 2;
    const stepX = e2 > -dy;
    const stepY = e2 < dx;
    if (stepX && stepY) {
      if (isOpaqueAt(map, x + sx, y) && isOpaqueAt(map, x, y + sy)) return false;
      err -= dy;
      err += dx;
      x += sx;
      y += sy;
    } else if (stepX) {
      err -= dy;
      x += sx;
    } else {
      err += dx;
      y += sy;
    }
    if (x === toX && y === toY) return true;
    if (isOpaqueAt(map, x, y)) return false;
  }
  return true;
}

function castLight(
  startSlope: number,
  endSlope: number,
  row: number,
  ox: number,
  oy: number,
  radius: number,
  xx: number,
  xy: number,
  yx: number,
  yy: number,
  visible: Set<number>,
  isOpaque: (x: number, y: number) => boolean,
): void {
  if (startSlope < endSlope) return;
  let nextStart = startSlope;
  const radius2 = radius * radius;

  for (let dist = row; dist <= radius; dist++) {
    let blocked = false;
    for (let col = 0; col <= dist; col++) {
      const lSlope = (col - 0.5) / (dist + 0.5);
      const rSlope = (col + 0.5) / (dist + 0.5);
      if (lSlope > startSlope || rSlope < endSlope) continue;

      const mx = ox + xx * dist + xy * col;
      const my = oy + yx * dist + yy * col;
      if (mx >= 0 && my >= 0 && mx < MAP_W && my < MAP_H && dist * dist + col * col <= radius2) {
        visible.add(my * MAP_W + mx);
      }

      if (blocked) {
        if (isOpaque(mx, my)) {
          nextStart = lSlope;
        } else {
          blocked = false;
          endSlope = nextStart;
        }
      } else if (isOpaque(mx, my) && dist < radius) {
        blocked = true;
        castLight(lSlope, endSlope, dist + 1, ox, oy, radius, xx, xy, yx, yy, visible, isOpaque);
        nextStart = rSlope;
      }
    }
    if (blocked) break;
  }
}
