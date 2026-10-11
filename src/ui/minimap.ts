import { LOGICAL_W, VIEW_COLS, VIEW_ROWS } from "../core/constants.ts";
import { MAP_H, MAP_W } from "../core/map.ts";
import { T } from "../core/tiles.ts";
import { drawPixelText } from "./pixel-font.ts";
import type { Game } from "../core/game.ts";

export interface MinimapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MINIMAP_SCALE = 2;
export const MINIMAP_W = MAP_W * MINIMAP_SCALE;
export const MINIMAP_H = MAP_H * MINIMAP_SCALE;
export const MINIMAP_PANEL_W = MINIMAP_W + 12;
export const MINIMAP_PANEL_H = MINIMAP_H + 28;

export function minimapRect(): MinimapRect {
  return {
    x: LOGICAL_W - MINIMAP_PANEL_W - 8,
    y: 8,
    w: MINIMAP_PANEL_W,
    h: MINIMAP_PANEL_H,
  };
}

export function minimapCellColor(game: Game, x: number, y: number): string | null {
  const explored = game.exploredByFloor.get(game.depth);
  if (!explored?.has(y * MAP_W + x)) return null;

  switch (game.map.cells[y]?.[x]) {
    case "wall":
      return "#39404a";
    case "stairs":
      return "#ffd97a";
    case "stairsUp":
      return "#7ab8ff";
    case "doorClosed":
      return "#8a5a2a";
    case "doorOpen":
      return "#5a3a1a";
    case "trap":
      return "#c0392b";
    case "floor":
      return "#2a2620";
    default:
      return null;
  }
}

export function minimapItemColor(tile: number): string | null {
  switch (tile) {
    case T.Potion:
      return "#9be56f";
    case T.Gold:
      return "#ffd97a";
    case T.Sword:
      return "#d8d8d8";
    case T.Shield:
      return "#7ab8ff";
    case T.Torch:
      return "#ff9a4a";
    case T.Corpse:
      return "#6a6a6a";
    default:
      return null;
  }
}

export function drawMinimap(bctx: CanvasRenderingContext2D, game: Game): MinimapRect {
  const rect = minimapRect();
  const mapX = rect.x + 6;
  const mapY = rect.y + 22;

  bctx.fillStyle = "rgba(0,0,0,0.72)";
  bctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  bctx.strokeStyle = "#5a544a";
  bctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);
  drawPixelText(bctx, "MAP", rect.x + 6, rect.y + 6, "#9a958c", 2);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const color = minimapCellColor(game, x, y);
      if (!color) continue;
      bctx.fillStyle = color;
      bctx.fillRect(mapX + x * MINIMAP_SCALE, mapY + y * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE);
    }
  }

  const cam = game.camera();
  bctx.strokeStyle = "rgba(232,228,218,0.55)";
  bctx.strokeRect(
    mapX + cam.x * MINIMAP_SCALE + 0.5,
    mapY + cam.y * MINIMAP_SCALE + 0.5,
    VIEW_COLS * MINIMAP_SCALE,
    VIEW_ROWS * MINIMAP_SCALE,
  );

  for (const item of game.map.items) {
    if (!game.visible.has(item.y * MAP_W + item.x)) continue;
    const color = minimapItemColor(item.tile);
    if (!color) continue;
    bctx.fillStyle = color;
    bctx.fillRect(mapX + item.x * MINIMAP_SCALE, mapY + item.y * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE);
  }

  for (const monster of game.monsters()) {
    if (!monster.alive || !game.visible.has(monster.y * MAP_W + monster.x)) continue;
    bctx.fillStyle = "#ff6a6a";
    bctx.fillRect(mapX + monster.x * MINIMAP_SCALE, mapY + monster.y * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE);
  }

  bctx.fillStyle = "#e8e4da";
  bctx.fillRect(
    mapX + game.player.x * MINIMAP_SCALE,
    mapY + game.player.y * MINIMAP_SCALE,
    MINIMAP_SCALE,
    MINIMAP_SCALE,
  );

  return rect;
}
