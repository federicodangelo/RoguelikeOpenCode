export type IconName =
  | "heart"
  | "sword"
  | "shield"
  | "gold"
  | "torch"
  | "light"
  | "depth"
  | "sound"
  | "mute"
  | "skill"
  | "item"
  | "monster"
  | "door"
  | "potion"
  | "stairs"
  | "stairsUp";

export const ICON_NAMES: IconName[] = [
  "heart",
  "sword",
  "shield",
  "gold",
  "torch",
  "light",
  "depth",
  "sound",
  "mute",
  "skill",
  "item",
  "monster",
  "door",
  "potion",
  "stairs",
  "stairsUp",
];

import { FONT_CELL_H, FONT_CELL_W } from "./pixel-font.ts";

export const ICON_W = FONT_CELL_W;
export const ICON_H = FONT_CELL_H;
export const ICON_COLS = 8;
export const ICON_SCALE = 2;

export class Iconset {
  private constructor(private readonly img: CanvasImageSource) {}

  static load(url: string): Promise<Iconset> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(new Iconset(img));
      img.onerror = () => reject(new Error(`Failed to load iconset: ${url}`));
      img.src = url;
    });
  }

  static fromImage(img: CanvasImageSource): Iconset {
    return new Iconset(img);
  }

  draw(ctx: CanvasRenderingContext2D, name: IconName, x: number, y: number, scale = ICON_SCALE): void {
    const index = ICON_NAMES.indexOf(name);
    if (index < 0) return;

    const sx = (index % ICON_COLS) * ICON_W;
    const sy = Math.floor(index / ICON_COLS) * ICON_H;
    ctx.drawImage(this.img, sx, sy, ICON_W, ICON_H, x, y, ICON_W * scale, ICON_H * scale);
  }
}

export function drawIcon(
  ctx: CanvasRenderingContext2D,
  icons: Iconset,
  name: IconName,
  x: number,
  y: number,
  scale = ICON_SCALE,
): void {
  icons.draw(ctx, name, x, y, scale);
}
