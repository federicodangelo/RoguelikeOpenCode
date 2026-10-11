import { describe, expect, it } from "bun:test";
import { Game } from "../../src/core/game.ts";
import { MAP_W } from "../../src/core/map.ts";
import { T } from "../../src/core/tiles.ts";
import { LOGICAL_W } from "../../src/core/constants.ts";
import {
  MINIMAP_PANEL_H,
  MINIMAP_PANEL_W,
  minimapCellColor,
  minimapItemColor,
  minimapRect,
} from "../../src/ui/minimap.ts";

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
    expect(minimapItemColor(T.Gold)).toBe("#ffd97a");
    expect(minimapItemColor(T.Sword)).toBe("#d8d8d8");
    expect(minimapItemColor(T.Shield)).toBe("#7ab8ff");
    expect(minimapItemColor(T.Torch)).toBe("#ff9a4a");
    expect(minimapItemColor(T.Corpse)).toBe("#6a6a6a");
    expect(minimapItemColor(T.Floor)).toBeNull();
  });
});
