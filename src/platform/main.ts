import { Tileset, drawScene } from "./render.ts";
import { Game } from "../core/game.ts";
import { GameAudio } from "./audio.ts";
import { cycleScalingMode, cycleVolume, loadSettings, saveSettings } from "./settings.ts";
import { clearRun, hasSavedRun, loadRun, saveRun } from "./save.ts";
import { handleKeydown } from "./input.ts";
import { contextualHints, drawContextHints, drawHUD } from "../ui/hud.ts";
import { drawGameOver, drawMenu, drawTitle } from "../ui/screens.ts";
import { drawEffects } from "../ui/effects.ts";
import { drawMinimap } from "../ui/minimap.ts";
import { Iconset } from "../ui/icons.ts";
import { LOGICAL_H, LOGICAL_W } from "../core/constants.ts";
import { MenuNav } from "../ui/menu.ts";
import { computeScaling } from "../ui/scaling.ts";
import { buildMenuTree } from "./menuTree.ts";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
canvas.width = LOGICAL_W;
canvas.height = LOGICAL_H;
ctx.imageSmoothingEnabled = false;

const buffer = document.createElement("canvas");
buffer.width = LOGICAL_W;
buffer.height = LOGICAL_H;
const bctx = buffer.getContext("2d")!;
bctx.imageSmoothingEnabled = false;

const settings = loadSettings(localStorage);
const audio = new GameAudio();

function applyAudioSettings(): void {
  audio.setEnabled(settings.soundEnabled);
  audio.setVolume(settings.volume);
  audio.setMuted(settings.muted);
}

function startMusicIfAudible(): void {
  if (settings.soundEnabled && !settings.muted && settings.volume > 0 && game.screen === "game" && !game.gameOver) {
    audio.unlock();
    audio.startMusic();
  }
}

applyAudioSettings();

const game = new Game();
game.events = {
  hit: () => audio.sfx("hit"),
  kill: () => audio.sfx("kill"),
  level: () => audio.sfx("level"),
  hurt: () => audio.sfx("hurt"),
  death: () => {
    audio.sfx("death");
    audio.stopMusic();
  },
  stairs: () => audio.sfx("stairs"),
  pickup: () => audio.sfx("pickup"),
  potion: () => audio.sfx("potion"),
};

if (loadRun(localStorage, game)) {
  if (game.gameOver) {
    clearRun(localStorage);
    game.reset();
  }
  game.screen = "title";
  game.dirty = true;
}

function fitCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
  const s = computeScaling(settings.scalingMode, LOGICAL_W, LOGICAL_H, fit, dpr);
  canvas.width = s.backingW;
  canvas.height = s.backingH;
  canvas.style.width = `${s.cssW}px`;
  canvas.style.height = `${s.cssH}px`;
  game.dirty = true;
}

function cycleScaling(): void {
  settings.scalingMode = cycleScalingMode(settings.scalingMode);
  saveSettings(localStorage, settings);
  fitCanvas();
}

function toggleSound(): void {
  settings.soundEnabled = !settings.soundEnabled;
  applyAudioSettings();
  startMusicIfAudible();
  saveSettings(localStorage, settings);
}

function cycleVolumeSetting(): void {
  settings.volume = cycleVolume(settings.volume);
  applyAudioSettings();
  startMusicIfAudible();
  saveSettings(localStorage, settings);
}

function toggleMute(): void {
  settings.muted = !settings.muted;
  applyAudioSettings();
  startMusicIfAudible();
  saveSettings(localStorage, settings);
}

function resetGame(): void {
  game.reset();
  clearRun(localStorage);
  saveRun(localStorage, game);
  applyAudioSettings();
  startMusicIfAudible();
  game.dirty = true;
}

function resumeGame(): void {
  if (!loadRun(localStorage, game) || game.gameOver) {
    resetGame();
    game.screen = "game";
    return;
  }
  game.screen = "game";
  applyAudioSettings();
  startMusicIfAudible();
  game.dirty = true;
}

function startGame(): void {
  if (hasSavedRun(localStorage)) {
    resumeGame();
  } else {
    resetGame();
    game.screen = "game";
  }
}

let menu: MenuNav;

menu = new MenuNav(() =>
  buildMenuTree(game, settings, {
    cycleScaling,
    toggleSound,
    cycleVolume: cycleVolumeSetting,
    toggleMute,
    save: () => saveRun(localStorage, game),
    load: () => {
      if (loadRun(localStorage, game)) {
        startMusicIfAudible();
      }
    },
    reset: resetGame,
    back: () => menu.back(),
  }),
);

function openInventoryMenu(): void {
  game.menuOpen = true;
  menu.open();
  const idx = menu.entries().findIndex((entry) => entry.label === "Inventory");
  if (idx >= 0) {
    menu.index = idx;
    menu.enter();
  }
}

window.addEventListener("resize", fitCanvas);
window.addEventListener("keydown", (e) => {
  handleKeydown(e, { game, menu, audio, startGame, toggleMute, openInventory: openInventoryMenu });
  if (game.screen === "game" && !game.gameOver) {
    saveRun(localStorage, game);
  } else if (game.gameOver) {
    clearRun(localStorage);
  }
});
window.addEventListener("pointerdown", () => {
  audio.unlock();
  startMusicIfAudible();
});

fitCanvas();

async function main(): Promise<void> {
  const tiles = await Tileset.load("assets/tiles.png");
  const icons = await Iconset.load("assets/icons.png");

  function draw(): void {
    if (game.screen === "title") {
      drawTitle(bctx, tiles, hasSavedRun(localStorage));
    } else {
      const cam = game.camera();
      drawScene(bctx, tiles, game.buildScene());
      drawMinimap(bctx, game);
      drawHUD(bctx, {
        player: game.player,
        inventory: game.inventory,
        depth: game.depth,
        algorithm: game.map.algorithm,
        messages: game.messages,
        lightTurns: game.lightTurns,
        statuses: game.player.statuses,
        icons,
      });

      if (!game.gameOver && !game.menuOpen) {
        const interact = game.adjacentInteractables();
        drawContextHints(
          bctx,
          icons,
          game.player,
          cam,
          contextualHints({
            hasPickableItem: game.hasPickableItemAtPlayer(),
            itemKind: game.itemKindAtPlayer(),
            cell: game.map.cells[game.player.y]![game.player.x]!,
            depth: game.depth,
            potions: game.inventory.potions,
            torches: game.inventory.torches,
            hp: game.player.hp,
            maxHp: game.player.maxHp,
            skillPoints: game.player.skillPoints,
            adjacentDoorClosed: interact.doorClosed,
            adjacentTrap: interact.trap,
          }),
        );
      }

      drawEffects(bctx, game.effects, cam, game.playerFlashUntil, performance.now());
      if (game.gameOver) {
        drawGameOver(bctx, {
          depth: game.depth,
          level: game.player.level,
          gold: game.inventory.gold,
          kills: game.kills,
        });
      }
      if (game.menuOpen) drawMenu(bctx, menu, settings.scalingMode);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = settings.scalingMode === "smooth";
    ctx.drawImage(buffer, 0, 0, LOGICAL_W, LOGICAL_H, 0, 0, canvas.width, canvas.height);
    game.dirty = false;
  }

  function frame(): void {
    if (game.effects.length || performance.now() < game.playerFlashUntil) game.dirty = true;
    if (game.dirty) draw();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main();
