import { describe, expect, it } from "bun:test";
import { Game } from "../../src/core/game.ts";
import { MAP_W } from "../../src/core/map.ts";
import { T } from "../../src/core/tiles.ts";
import { LOGICAL_H, LOGICAL_W } from "../../src/core/constants.ts";
import {
  MINIMAP_PANEL_H,
  MINIMAP_PANEL_W,
  MINIMAP_SCALE,
  drawMinimap,
  minimapCellColor,
  minimapItemColor,
  minimapRect,
} from "../../src/ui/minimap.ts";
import { FONT_SHEET_H, FONT_SHEET_W, Fontset, setFontset } from "../../src/ui/pixel-font.ts";
import { createCanvas, type ShimCanvas } from "../../tools/canvas-shim.ts";

function pixelRGB(canvas: ShimCanvas, x: number, y: number): [number, number, number] {
  const o = (y * canvas.width + x) * 4;
  return [canvas.data[o]!, canvas.data[o + 1]!, canvas.data[o + 2]!];
}

function useBlankFontset(): void {
  const fontCanvas = createCanvas(FONT_SHEET_W, FONT_SHEET_H).canvas;
  setFontset(Fontset.fromImage(fontCanvas as unknown as CanvasImageSource));
}

describe("minimap", () => {
  it("places the panel in the top-right corner", () => {
    const rect = minimapRect();
    expect(rect.w).toBe(MINIMAP_PANEL_W);
    expect(rect.h).toBe(MINIMAP_PANEL_H);
    expect(rect.x + rect.w).toBe(LOGICAL_W - 8);
    expect(rect.y).toBe(8);
  });

  it("hides unexplored cells", () => {
    const game = new Game();
    game.exploredByFloor.get(game.depth)!.clear();
    expect(minimapCellColor(game, game.player.x, game.player.y)).toBeNull();
  });

  it("colors explored cells", () => {
    const game = new Game();
    const explored = game.exploredByFloor.get(game.depth)!;
    explored.clear();
    explored.add(game.player.y * MAP_W + game.player.x);
    expect(minimapCellColor(game, game.player.x, game.player.y)).toBe("#2a2620");

    game.map.cells[0]![0] = "wall";
    explored.add(0);
    expect(minimapCellColor(game, 0, 0)).toBe("#39404a");
  });

  it("colors known item tiles", () => {
    expect(minimapItemColor(T.Potion)).toBe("#9be56f");
    expect(minimapItemColor(T.MajorPotion)).toBe("#9be56f");
    expect(minimapItemColor(T.Gold)).toBe("#ffd97a");
    expect(minimapItemColor(T.Sword)).toBe("#d8d8d8");
    expect(minimapItemColor(T.Dagger)).toBe("#d8d8d8");
    expect(minimapItemColor(T.LongSword)).toBe("#d8d8d8");
    expect(minimapItemColor(T.BattleAxe)).toBe("#d8d8d8");
    expect(minimapItemColor(T.Shield)).toBe("#7ab8ff");
    expect(minimapItemColor(T.Buckler)).toBe("#7ab8ff");
    expect(minimapItemColor(T.KiteShield)).toBe("#7ab8ff");
    expect(minimapItemColor(T.Torch)).toBe("#ff9a4a");
    expect(minimapItemColor(T.Lantern)).toBe("#ff9a4a");
    expect(minimapItemColor(T.Corpse)).toBe("#6a6a6a");
    expect(minimapItemColor(T.Floor)).toBeNull();
  });

  it("redraws cached static cells when mapVersion changes", () => {
    useBlankFontset();
    const { canvas, ctx } = createCanvas(LOGICAL_W, LOGICAL_H);
    const game = new Game();
    const explored = game.exploredByFloor.get(game.depth)!;
    explored.clear();
    game.map.cells[0]![0] = "wall";
    explored.add(0);
    game.mapVersion++;
    game.exploredVersion++;

    drawMinimap(ctx, game);
    const rect = minimapRect();
    const mapX = rect.x + 6;
    const mapY = rect.y + 22;
    expect(pixelRGB(canvas, mapX + 1, mapY + 1)).toEqual([0x39, 0x40, 0x4a]);

    game.map.cells[0]![0] = "floor";
    game.mapVersion++;
    drawMinimap(ctx, game);
    expect(pixelRGB(canvas, mapX + 1, mapY + 1)).toEqual([0x2a, 0x26, 0x20]);
  });

  it("redraws cached static cells when exploredVersion changes", () => {
    useBlankFontset();
    const { canvas, ctx } = createCanvas(LOGICAL_W, LOGICAL_H);
    const game = new Game();
    const explored = game.exploredByFloor.get(game.depth)!;
    explored.clear();
    game.map.cells[0]![0] = "wall";
    explored.add(0);
    game.mapVersion++;
    game.exploredVersion++;

    drawMinimap(ctx, game);
    const rect = minimapRect();
    const mapX = rect.x + 6;
    const mapY = rect.y + 22;
    expect(pixelRGB(canvas, mapX + 1, mapY + MINIMAP_SCALE + 1)).toEqual([0, 0, 0]);

    game.map.cells[1]![0] = "wall";
    explored.add(MAP_W);
    game.exploredVersion++;
    drawMinimap(ctx, game);
    expect(pixelRGB(canvas, mapX + 1, mapY + MINIMAP_SCALE + 1)).toEqual([0x39, 0x40, 0x4a]);
  });
});
