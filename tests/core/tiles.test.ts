import { describe, expect, it } from "bun:test";
import { SHEET_COLS, T, TILE_SIZE } from "../../src/core/tiles.ts";

describe("tiles", () => {
  it("has 32px tiles and 8 sheet columns", () => {
    expect(TILE_SIZE).toBe(32);
    expect(SHEET_COLS).toBe(8);
  });

  it("defines 16 unique tile indices 0..15", () => {
    const values = Object.values(T);
    expect(values.length).toBe(16);
    expect(new Set(values).size).toBe(16);
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBe(15);
  });
});
