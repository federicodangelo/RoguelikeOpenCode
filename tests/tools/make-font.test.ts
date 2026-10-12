import { describe, expect, it } from "bun:test";
import { FONT, FONT_ORDER, FONT_SHEET_H, FONT_SHEET_W } from "../../tools/make-font.ts";

describe("make font", () => {
  it("defines every glyph in the atlas order", () => {
    for (const ch of FONT_ORDER) {
      expect(FONT[ch]).toBeDefined();
    }
  });

  it("keeps every glyph 7 rows by 5 columns", () => {
    for (const rows of Object.values(FONT)) {
      expect(rows.length).toBe(7);
      for (const row of rows) {
        expect(row.length).toBe(5);
      }
    }
  });

  it("generates a font sheet with room for every glyph", () => {
    expect(FONT_SHEET_W).toBe(50);
    expect(FONT_SHEET_H).toBe(56);
    expect(FONT_ORDER.length).toBe(77);
  });
});
