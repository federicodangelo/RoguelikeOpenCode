import { describe, expect, it } from "bun:test";
import { drawScene, Tileset, type CellView } from "../../src/platform/render.ts";
import { TILE_SIZE } from "../../src/core/tiles.ts";

describe("drawScene", () => {
  it("draws floor, then feature, then entity, then dim overlay", () => {
    const calls: string[] = [];
    const ctx = {
      fillStyle: "",
      fillRect: (x: number, y: number) => calls.push(`dim:${x},${y}`),
    } as unknown as CanvasRenderingContext2D;
    const tileset = {
      drawTile: (_c: CanvasRenderingContext2D, idx: number, x: number, y: number) => calls.push(`${idx}@${x},${y}`),
    } as unknown as Tileset;
    const scene: CellView[][] = [[{ floor: 0, feature: 1, entity: 5, dim: true }]];
    drawScene(ctx, tileset, scene);
    expect(calls).toEqual(["0@0,0", "1@0,0", "5@0,0", "dim:0,0"]);
  });

  it("skips missing feature/entity layers and dim", () => {
    const calls: string[] = [];
    const ctx = {
      fillStyle: "",
      fillRect: () => calls.push("dim"),
    } as unknown as CanvasRenderingContext2D;
    const tileset = {
      drawTile: (_c: CanvasRenderingContext2D, idx: number) => calls.push(`${idx}`),
    } as unknown as Tileset;
    drawScene(ctx, tileset, [[{ floor: 15 }]]);
    expect(calls).toEqual(["15"]);
  });
});

describe("Tileset.drawTile", () => {
  it("computes source and destination rects from the tile index", () => {
    const args: number[] = [];
    const ctx = {
      drawImage: (...a: unknown[]) => {
        for (const v of a) if (typeof v === "number") args.push(v);
      },
    } as unknown as CanvasRenderingContext2D;
    const ts = new (Tileset as unknown as new (img: unknown) => Tileset)({});
    ts.drawTile(ctx, 15, 3, 2);
    expect(args).toEqual([224, 32, TILE_SIZE, TILE_SIZE, 3 * TILE_SIZE, 2 * TILE_SIZE, TILE_SIZE, TILE_SIZE]);
  });
});
