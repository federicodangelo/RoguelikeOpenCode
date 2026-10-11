import { RNG } from "../rng.ts";
import {
  MAP_W,
  MAP_H,
  emptyCells,
  carveCell,
  bfsFarthest,
  placeItems,
  makeMap,
  type GameMap,
  type Point,
} from "./common.ts";

export function generateWalk(rng: RNG, depth: number): GameMap {
  const cells = emptyCells();
  const start: Point = { x: rng.int(5, MAP_W - 6), y: rng.int(5, MAP_H - 6) };
  cells[start.y]![start.x] = "floor";

  const target = Math.floor((MAP_W - 2) * (MAP_H - 2) * 0.4);
  let open = 1;
  let x = start.x;
  let y = start.y;

  for (let step = 0; step < 40000 && open < target; step++) {
    const dir = rng.int(0, 3);
    const [dx, dy] = dir === 0 ? [1, 0] : dir === 1 ? [-1, 0] : dir === 2 ? [0, 1] : [0, -1];
    const nx = Math.max(1, Math.min(MAP_W - 2, x + dx));
    const ny = Math.max(1, Math.min(MAP_H - 2, y + dy));
    if (cells[ny]![nx] === "wall") {
      cells[ny]![nx] = "floor";
      open++;
    }
    x = nx;
    y = ny;
  }

  const stairs = bfsFarthest(cells, start);
  cells[stairs.y]![stairs.x] = "stairs";

  const items = placeItems(cells, rng, depth, [start, stairs]);
  return makeMap(cells, "walk", [], start, stairs, items);
}
