import type { Entity } from "./entities.ts";
import { MAP_H, MAP_W, type GameMap } from "./map.ts";
import type { CellView } from "./scene.ts";
import { T } from "./tiles.ts";
import { VIEW_COLS, VIEW_ROWS } from "./constants.ts";

export interface SceneContext {
  map: GameMap;
  player: Entity;
  monsters(): Entity[];
  visible: Set<number>;
  exploredByFloor: Map<number, Set<number>>;
  depth: number;
}

export function camera(ctx: SceneContext): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(ctx.player.x - ((VIEW_COLS - 1) >> 1), MAP_W - VIEW_COLS)),
    y: Math.max(0, Math.min(ctx.player.y - ((VIEW_ROWS - 1) >> 1), MAP_H - VIEW_ROWS)),
  };
}

export function buildScene(ctx: SceneContext): CellView[][] {
  const cam = camera(ctx);
  const scene: CellView[][] = [];
  const explored = ctx.exploredByFloor.get(ctx.depth) ?? new Set<number>();
  const itemByPos = new Map<number, number>();
  for (const item of ctx.map.items) {
    const key = item.y * MAP_W + item.x;
    if (!itemByPos.has(key)) itemByPos.set(key, item.tile);
  }
  const monsterByPos = new Map<number, number>();
  for (const m of ctx.monsters()) {
    if (!m.alive) continue;
    monsterByPos.set(m.y * MAP_W + m.x, m.sprite);
  }

  for (let vy = 0; vy < VIEW_ROWS; vy++) {
    const row: CellView[] = [];
    for (let vx = 0; vx < VIEW_COLS; vx++) {
      const mx = cam.x + vx;
      const my = cam.y + vy;
      const key = my * MAP_W + mx;
      if (!explored.has(key)) {
        row.push({ floor: T.Black });
        continue;
      }

      const cell = ctx.map.cells[my]![mx]!;
      const view: CellView = { floor: T.Floor };
      if (cell === "wall") view.feature = T.Wall;
      else if (cell === "stairs") view.feature = T.Stairs;
      else if (cell === "stairsUp") view.feature = T.StairsUp;
      else if (cell === "doorClosed") view.feature = T.DoorClosed;
      else if (cell === "doorOpen") view.feature = T.DoorOpen;
      else if (cell === "trap") view.feature = T.Trap;

      const itemTile = itemByPos.get(key);
      if (itemTile !== undefined) view.feature = itemTile;

      const isVisible = ctx.visible.has(key);
      if (isVisible) {
        const monsterSprite = monsterByPos.get(key);
        if (monsterSprite !== undefined) view.entity = monsterSprite;
      } else {
        view.dim = true;
      }
      row.push(view);
    }
    scene.push(row);
  }

  const px = ctx.player.x - cam.x;
  const py = ctx.player.y - cam.y;
  if (px >= 0 && px < VIEW_COLS && py >= 0 && py < VIEW_ROWS) {
    scene[py]![px]!.entity = T.Player;
  }
  return scene;
}
