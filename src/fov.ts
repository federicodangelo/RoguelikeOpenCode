import { MAP_W, MAP_H, type GameMap } from "./mapgen/common.ts";

export const FOV_RADIUS = 8;

const QUADRANTS: [number, number, number, number][] = [
  [1, 0, 0, -1],
  [1, 0, 0, 1],
  [-1, 0, 0, 1],
  [-1, 0, 0, -1],
];

export function computeFOV(map: GameMap, ox: number, oy: number, radius = FOV_RADIUS): Set<number> {
  const visible = new Set<number>([oy * MAP_W + ox]);
  const isOpaque = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return true;
    const c = map.cells[y]![x]!;
    return c === "wall" || c === "doorClosed";
  };
  for (const [xx, xy, yx, yy] of QUADRANTS) {
    castLight(1, 0, 1, ox, oy, radius, xx, xy, yx, yy, visible, isOpaque);
  }
  return visible;
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
    for (let col = -dist; col <= dist; col++) {
      const lSlope = (col - 0.5) / (dist + 0.5);
      const rSlope = (col + 0.5) / (dist + 0.5);
      if (startSlope < rSlope || endSlope > lSlope) continue;

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
          startSlope = nextStart;
        }
      } else if (isOpaque(mx, my) && dist < radius) {
        blocked = true;
        castLight(startSlope, rSlope, dist + 1, ox, oy, radius, xx, xy, yx, yy, visible, isOpaque);
        nextStart = lSlope;
      }
    }
    if (blocked) break;
  }
}
