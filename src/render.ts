import { SHEET_COLS, TILE_SIZE } from "./tiles.ts";

export class Tileset {
  private constructor(private readonly img: HTMLImageElement) {}

  static load(url: string): Promise<Tileset> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(new Tileset(img));
      img.onerror = () => reject(new Error(`Failed to load tileset: ${url}`));
      img.src = url;
    });
  }

  drawTile(
    ctx: CanvasRenderingContext2D,
    index: number,
    col: number,
    row: number,
  ): void {
    const sx = (index % SHEET_COLS) * TILE_SIZE;
    const sy = Math.floor(index / SHEET_COLS) * TILE_SIZE;
    ctx.drawImage(
      this.img,
      sx,
      sy,
      TILE_SIZE,
      TILE_SIZE,
      col * TILE_SIZE,
      row * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
    );
  }
}
