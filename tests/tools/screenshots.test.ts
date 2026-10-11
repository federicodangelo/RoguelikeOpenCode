import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";
import { renderGameplayPNG, renderTitlePNG } from "../../tools/make-screenshots.ts";

describe("screenshots", () => {
  it("matches committed title screenshot", () => {
    expect(renderTitlePNG(false).equals(readFileSync("public/screenshots/title.png"))).toBe(true);
  });

  it("matches committed gameplay screenshot", () => {
    expect(renderGameplayPNG(false).equals(readFileSync("public/screenshots/gameplay.png"))).toBe(true);
  });

  it("matches committed menu screenshot", () => {
    expect(renderGameplayPNG(true).equals(readFileSync("public/screenshots/menu.png"))).toBe(true);
  });
});
