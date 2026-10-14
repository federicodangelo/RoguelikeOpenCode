import { SHEET_COLS, TILE_SIZE } from "../core/tiles.ts";
import type { CellView } from "../core/scene.ts";

export type { CellView } from "../core/scene.ts";

export function drawScene(ctx: CanvasRenderingContext2D, tileset: Tileset, scene: CellView[][]): void {
  for (let y = 0; y < scene.length; y++) {
    const row = scene[y]!;
    for (let x = 0; x < row.length; x++) {
      const cell = row[x]!;
      tileset.drawTile(ctx, cell.floor, x, y);
      if (cell.feature !== undefined) tileset.drawTile(ctx, cell.feature, x, y);
      if (cell.entity !== undefined) tileset.drawTile(ctx, cell.entity, x, y);
      if (cell.dim) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}

export class Tileset {
  private constructor(private readonly img: CanvasImageSource) {}

  static load(url: string): Promise<Tileset> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(new Tileset(img));
      img.onerror = () => reject(new Error(`Failed to load tileset: ${url}`));
      img.src = url;
    });
  }

  static fromImage(img: CanvasImageSource): Tileset {
    return new Tileset(img);
  }

  drawTile(ctx: CanvasRenderingContext2D, index: number, col: number, row: number): void {
    const sx = (index % SHEET_COLS) * TILE_SIZE;
    const sy = Math.floor(index / SHEET_COLS) * TILE_SIZE;
    ctx.drawImage(this.img, sx, sy, TILE_SIZE, TILE_SIZE, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }
}
