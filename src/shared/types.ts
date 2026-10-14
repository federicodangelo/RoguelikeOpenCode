export interface TileDrawer {
  drawTile(ctx: CanvasRenderingContext2D, index: number, col: number, row: number): void;
}
