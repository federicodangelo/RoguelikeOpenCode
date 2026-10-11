import { describe, expect, it } from "bun:test";
import { ICON_COLS, ICON_NAMES, ICON_SIZE } from "../../src/ui/icons.ts";
import { ICON_SHEET_H, ICON_SHEET_W, iconSheet } from "../../tools/make-icons.ts";

describe("iconset", () => {
  it("has one sheet cell for every icon", () => {
    expect(ICON_NAMES.length).toBe(17);
    expect(ICON_SHEET_W).toBe(ICON_COLS * ICON_SIZE);
    expect(ICON_SHEET_H).toBe(Math.ceil(ICON_NAMES.length / ICON_COLS) * ICON_SIZE);
    expect(iconSheet.length).toBe(ICON_SHEET_W * ICON_SHEET_H * 4);
  });
});
