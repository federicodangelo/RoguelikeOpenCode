import { describe, expect, it } from "bun:test";
import { FONT_ORDER, pixelTextWidth, wrapPixelText } from "../../src/ui/pixel-font.ts";

describe("pixel font", () => {
  it("has a stable atlas order for lowercase and UI punctuation glyphs", () => {
    for (const ch of "abcdefghijklmnopqrstuvwxyz+:/(),.-*%") {
      expect(FONT_ORDER).toContain(ch);
    }
  });

  it("measures text width using 6 columns per glyph", () => {
    expect(pixelTextWidth("a", 2)).toBe(10);
    expect(pixelTextWidth("ab", 2)).toBe(22);
  });

  it("wraps long menu text to the available width", () => {
    const lines = wrapPixelText("Fractional snaps to 0.25 steps (1.25, 1.5, 1.75)", 512, 2);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(pixelTextWidth(line, 2)).toBeLessThanOrEqual(512);
    }
  });
});
