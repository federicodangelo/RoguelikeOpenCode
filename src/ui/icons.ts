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
  | "trap"
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
  "trap",
  "potion",
  "stairs",
  "stairsUp",
];

export const ICON_SIZE = 8;
export const ICON_COLS = 8;

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

  draw(ctx: CanvasRenderingContext2D, name: IconName, x: number, y: number): void {
    const index = ICON_NAMES.indexOf(name);
    if (index < 0) return;

    const sx = (index % ICON_COLS) * ICON_SIZE;
    const sy = Math.floor(index / ICON_COLS) * ICON_SIZE;
    ctx.drawImage(
      this.img,
      sx,
      sy,
      ICON_SIZE,
      ICON_SIZE,
      x,
      y,
      ICON_SIZE,
      ICON_SIZE,
    );
  }
}

export function drawIcon(
  ctx: CanvasRenderingContext2D,
  icons: Iconset,
  name: IconName,
  x: number,
  y: number,
): void {
  icons.draw(ctx, name, x, y);
}
