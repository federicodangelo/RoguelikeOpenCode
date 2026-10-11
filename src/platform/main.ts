import { Tileset, drawScene } from "./render.ts";
import { Game } from "../core/game.ts";
import { GameAudio } from "./audio.ts";
import { cycleScalingMode, loadSettings, saveSettings } from "./settings.ts";
import { clearRun, hasSavedRun, loadRun, saveRun } from "./save.ts";
import { handleKeydown } from "./input.ts";
import { contextualHints, drawContextHints, drawHUD } from "../ui/hud.ts";
import { drawGameOver, drawMenu, drawTitle } from "../ui/screens.ts";
import { drawEffects } from "../ui/effects.ts";
import { LOGICAL_H, LOGICAL_W } from "../core/constants.ts";
import { MenuNav, type MenuEntry } from "../ui/menu.ts";
import { computeScaling } from "../ui/scaling.ts";

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
audio.setEnabled(settings.soundEnabled);

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
  audio.setEnabled(settings.soundEnabled);
  if (settings.soundEnabled && game.screen === "game" && !game.gameOver) {
    audio.unlock();
    audio.startMusic();
  }
  saveSettings(localStorage, settings);
}

function resetGame(): void {
  game.reset();
  clearRun(localStorage);
  saveRun(localStorage, game);
  audio.setEnabled(settings.soundEnabled);
  audio.unlock();
  if (settings.soundEnabled) audio.startMusic();
  game.dirty = true;
}

function resumeGame(): void {
  if (!loadRun(localStorage, game) || game.gameOver) {
    resetGame();
    game.screen = "game";
    return;
  }
  game.screen = "game";
  audio.setEnabled(settings.soundEnabled);
  audio.unlock();
  if (settings.soundEnabled) audio.startMusic();
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

const menu = new MenuNav(() => menuTree());

function menuTree(): MenuEntry[] {
  return [
    {
      label: "Help",
      hint: "Enter to open help",
      submenu: () => [{ label: "Back", hint: "Enter to return to the menu", action: () => menu.back() }],
    },
    {
      label: `Skills (${game.player.skillPoints})`,
      hint: [`Enter to open skills`, `Skill points: ${game.player.skillPoints}`],
      submenu: () => [
        {
          label: "+1 ATK",
          hint: ["Enter: spend 1 skill point", `Current ATK: ${game.player.atk}`],
          action: () => game.spendSkill("atk"),
        },
        {
          label: "+1 DEF",
          hint: ["Enter: spend 1 skill point", `Current DEF: ${game.player.def}`],
          action: () => game.spendSkill("def"),
        },
        {
          label: "+2 Max HP",
          hint: ["Enter: spend 1 skill point", `Current Max HP: ${game.player.maxHp}`],
          action: () => game.spendSkill("hp"),
        },
        { label: "Back", hint: "Enter to return to the menu", action: () => menu.back() },
      ],
    },
    {
      label: "Settings",
      hint: "Enter to open settings",
      submenu: () => [
        {
          label: `Scaling mode: ${settings.scalingMode}`,
          hint: [
            "Enter: cycle integer / fractional / smooth",
            "Fractional snaps to 0.25 steps (1.25, 1.5, 1.75)",
            `Current scaling: ${settings.scalingMode}`,
          ],
          action: cycleScaling,
        },
        {
          label: `Sound: ${settings.soundEnabled ? "on" : "off"}`,
          hint: ["Enter: toggle sound", `Current sound: ${settings.soundEnabled ? "on" : "off"}`],
          action: toggleSound,
        },
        { label: "Back", hint: "Enter to return to the menu", action: () => menu.back() },
      ],
    },
    {
      label: "Save",
      hint: ["Enter to save now", "The game auto-saves after every move"],
      action: () => saveRun(localStorage, game),
    },
    {
      label: "Load",
      hint: ["Enter to load the latest auto-save", "Auto-save happens after every move"],
      action: () => {
        if (loadRun(localStorage, game)) {
          if (settings.soundEnabled && game.screen === "game" && !game.gameOver) {
            audio.unlock();
            audio.startMusic();
          }
        }
      },
    },
    {
      label: "Cheats",
      hint: "Enter to open cheats",
      submenu: () => [
        {
          label: `God mode: ${game.godMode ? "on" : "off"}`,
          hint: ["Enter: toggle invulnerability", `Current god mode: ${game.godMode ? "on" : "off"}`],
          action: () => game.toggleGodMode(),
        },
        {
          label: "Level up",
          hint: ["Enter: gain a level", `Current level: ${game.player.level}`],
          action: () => game.cheatLevelUp(),
        },
        {
          label: "Next depth",
          hint: ["Enter: descend without stairs", `Current depth: ${game.depth}`],
          action: () => game.cheatNextDepth(),
        },
        { label: "Back", hint: "Enter to return to the menu", action: () => menu.back() },
      ],
    },
    { label: "Restart", hint: "Enter to restart the run from depth 1", action: resetGame },
  ];
}

window.addEventListener("resize", fitCanvas);
window.addEventListener("keydown", (e) => {
  handleKeydown(e, { game, menu, audio, startGame });
  if (game.screen === "game" && !game.gameOver) {
    saveRun(localStorage, game);
  } else if (game.gameOver) {
    clearRun(localStorage);
  }
});
window.addEventListener("pointerdown", () => {
  audio.unlock();
  if (settings.soundEnabled && game.screen === "game" && !game.gameOver) audio.startMusic();
});

fitCanvas();

async function main(): Promise<void> {
  const tiles = await Tileset.load("assets/tiles.png");

  function draw(): void {
    if (game.screen === "title") {
      drawTitle(bctx, tiles, hasSavedRun(localStorage));
    } else {
      const cam = game.camera();
      drawScene(bctx, tiles, game.buildScene());
      drawHUD(bctx, {
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
          bctx,
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
