import { mkdirSync, writeFileSync } from "node:fs";
import { encodePNG, TILE_SHEET_H, TILE_SHEET_W, tileSheet } from "./make-tiles.ts";
import { createCanvas, ShimImage } from "./canvas-shim.ts";
import { Tileset, drawScene } from "../src/platform/render.ts";
import { drawMenu, drawTitle } from "../src/ui/screens.ts";
import { contextualHints, drawContextHints, drawHUD } from "../src/ui/hud.ts";
import { drawEffects } from "../src/ui/effects.ts";
import { drawMinimap } from "../src/ui/minimap.ts";
import { Game } from "../src/core/game.ts";
import { MenuNav } from "../src/ui/menu.ts";
import { buildMenuTree } from "../src/platform/menuTree.ts";
import { defaultSettings } from "../src/platform/settings.ts";
import { loadRun, saveRun, type SaveStorage } from "../src/platform/save.ts";
import { bfsDistances } from "../src/core/mapgen/common.ts";
import { MAP_H, MAP_W } from "../src/core/map.ts";
import { LOGICAL_H, LOGICAL_W } from "../src/core/constants.ts";

class MemoryStorage implements SaveStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function makeTileset(): Tileset {
  const image = new ShimImage(TILE_SHEET_W, TILE_SHEET_H, tileSheet);
  return Tileset.fromImage(image as unknown as CanvasImageSource);
}

function createLoadedGame(): Game {
  const storage = new MemoryStorage();
  const source = new Game();

  source.screen = "game";
  source.player.maxHp = 14;
  source.player.hp = 9;
  source.player.level = 2;
  source.player.atk = 4;
  source.player.def = 2;
  source.player.skillPoints = 1;
  source.inventory.torches = 1;
  source.inventory.potions = 1;
  source.inventory.gold = 12;
  source.kills = 3;
  source.lightTurns = 18;
  source.player.x = source.map.stairs.x;
  source.player.y = source.map.stairs.y;
  source.refreshFOV();

  const explored = source.exploredByFloor.get(source.depth)!;
  const dist = bfsDistances(source.map.cells, { x: source.player.x, y: source.player.y });
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] === -1) continue;
    explored.add(i);

    const x = i % MAP_W;
    const y = Math.floor(i / MAP_W);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        if (source.map.cells[ny]![nx] === "wall") explored.add(ny * MAP_W + nx);
      }
    }
  }

  source.logMessage("You light a torch.");
  source.logMessage("You pick up some gold.");
  source.logMessage("The rat hits you for 1.");
  source.logMessage("You hit the rat for 3.");

  saveRun(storage, source);

  const loaded = new Game();
  if (!loadRun(storage, loaded)) {
    throw new Error("Failed to load saved run for screenshots");
  }

  loaded.screen = "game";
  loaded.spawnEffect(loaded.player.x, loaded.player.y, "-3", "#ffd97a");
  return loaded;
}

function renderTitle(hasSave: boolean): Buffer {
  const { canvas, ctx } = createCanvas(LOGICAL_W, LOGICAL_H);
  drawTitle(ctx, makeTileset(), hasSave);
  return canvas.data;
}

function renderGameplay(showMenu: boolean): Buffer {
  const { canvas, ctx } = createCanvas(LOGICAL_W, LOGICAL_H);
  const tiles = makeTileset();
  const game = createLoadedGame();
  const cam = game.camera();

  drawScene(ctx, tiles, game.buildScene());
  drawMinimap(ctx, game);
  drawHUD(ctx, {
    player: game.player,
    inventory: game.inventory,
    depth: game.depth,
    algorithm: game.map.algorithm,
    messages: game.messages,
    showInventory: game.showInventory,
    lightTurns: game.lightTurns,
    statusText: game.player.statuses.map((s) => `${s.kind} ${s.turns}`).join("  "),
  });

  if (!game.gameOver && !game.menuOpen) {
    drawContextHints(
      ctx,
      game.player,
      cam,
      contextualHints({
        hasPickableItem: game.hasPickableItemAtPlayer(),
        cell: game.map.cells[game.player.y]![game.player.x]!,
        depth: game.depth,
        potions: game.inventory.potions,
        torches: game.inventory.torches,
        hp: game.player.hp,
        maxHp: game.player.maxHp,
        skillPoints: game.player.skillPoints,
      }),
    );
  }

  drawEffects(ctx, game.effects, cam, game.playerFlashUntil, performance.now());

  if (showMenu) {
    const settings = defaultSettings();
    const menu = new MenuNav(() =>
      buildMenuTree(game, settings, {
        cycleScaling: () => {},
        toggleSound: () => {},
        save: () => {},
        load: () => {},
        reset: () => {},
        back: () => menu.back(),
      }),
    );
    menu.open();
    drawMenu(ctx, menu, settings.scalingMode);
  }

  return canvas.data;
}

function saveScreenshot(name: string, data: Buffer): void {
  writeFileSync(`public/screenshots/${name}.png`, encodePNG(LOGICAL_W, LOGICAL_H, data));
}

if (import.meta.main) {
  mkdirSync("public/screenshots", { recursive: true });

  saveScreenshot("title", renderTitle(false));
  saveScreenshot("gameplay", renderGameplay(false));
  saveScreenshot("menu", renderGameplay(true));

  console.log("Wrote public/screenshots/title.png, gameplay.png, menu.png");
}
