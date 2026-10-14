import { describe, expect, it } from "bun:test";
import { LOGICAL_H, LOGICAL_W } from "../../src/core/constants.ts";
import { drawErrorScreen } from "../../src/ui/screens.ts";
import { createCanvas } from "../../tools/canvas-shim.ts";

describe("drawErrorScreen", () => {
  it("paints a fallback background without requiring the pixel font", () => {
    const { canvas, ctx } = createCanvas(LOGICAL_W, LOGICAL_H);

    drawErrorScreen(ctx, "Failed to load tileset: assets/tiles.png");

    expect(canvas.data[0]).toBe(0x11);
    expect(canvas.data[1]).toBe(0x11);
    expect(canvas.data[2]).toBe(0x11);
    expect(canvas.data[3]).toBe(255);
  });
});
