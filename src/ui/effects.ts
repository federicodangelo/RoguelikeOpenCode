import { TILE_SIZE } from "../core/tiles.ts";
import { LOGICAL_H, LOGICAL_W } from "../core/constants.ts";
import { drawPixelTextCenter } from "./pixel-font.ts";

export interface Effect {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
}

export function spawnEffect(effects: Effect[], x: number, y: number, text: string, color: string, now: number): void {
  effects.push({ x, y, text, color, born: now });
}

export function drawEffects(
  bctx: CanvasRenderingContext2D,
  effects: Effect[],
  cam: { x: number; y: number },
  playerFlashUntil: number,
  now: number,
): void {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i]!;
    const age = now - e.born;
    if (age > 800) {
      effects.splice(i, 1);
      continue;
    }
    const t = age / 800;
    bctx.globalAlpha = 1 - t;
    drawPixelTextCenter(
      bctx,
      e.text,
      (e.x - cam.x) * TILE_SIZE + TILE_SIZE / 2,
      (e.y - cam.y) * TILE_SIZE + 2 - t * 20,
      e.color,
      2,
    );
    bctx.globalAlpha = 1;
  }

  if (now < playerFlashUntil) {
    bctx.strokeStyle = "rgba(255,60,60,0.8)";
    bctx.lineWidth = 4;
    bctx.strokeRect(2, 2, LOGICAL_W - 4, LOGICAL_H - 4);
    bctx.lineWidth = 1;
  }
}
