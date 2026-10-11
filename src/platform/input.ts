import type { Game } from "../core/game.ts";
import type { MenuNav } from "../ui/menu.ts";
import type { GameAudio } from "./audio.ts";

export const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

export interface InputContext {
  game: Game;
  menu: MenuNav;
  audio: GameAudio;
  startGame(): void;
  toggleMute(): void;
  openInventory(): void;
}

export function handleKeydown(e: KeyboardEvent, ctx: InputContext): void {
  const { game, menu, audio, toggleMute, openInventory } = ctx;

  if (game.screen === "title") {
    if (e.key === "Enter") {
      e.preventDefault();
      audio.unlock();
      audio.sfx("select");
      ctx.startGame();
    }
    return;
  }

  if (game.gameOver) {
    if (e.key === "Enter") {
      e.preventDefault();
      audio.stopMusic();
      game.screen = "title";
      game.dirty = true;
    }
    return;
  }

  if (e.key === "m") {
    e.preventDefault();
    toggleMute();
    game.dirty = true;
    return;
  }

  if (e.key === "Escape") {
    e.preventDefault();
    audio.sfx("menu");
    if (game.menuOpen && menu.labels()[0] === "Inventory") {
      game.menuOpen = false;
    } else if (game.menuOpen && menu.depth() > 0) {
      menu.back();
    } else {
      game.menuOpen = !game.menuOpen;
      if (game.menuOpen) menu.open();
    }
    game.dirty = true;
    return;
  }

  if (e.key === "i") {
    e.preventDefault();
    if (game.menuOpen && menu.labels()[0] === "Inventory") {
      game.menuOpen = false;
    } else {
      openInventory();
    }
    audio.sfx("menu");
    game.dirty = true;
    return;
  }

  if (game.menuOpen) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      menu.up();
      audio.sfx("menu");
      game.dirty = true;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      menu.down();
      audio.sfx("menu");
      game.dirty = true;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Backspace") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      if (menu.adjustSlider(delta)) {
        audio.sfx("menu");
        game.dirty = true;
      } else if (e.key !== "ArrowRight" && menu.depth() > 0) {
        menu.back();
        audio.sfx("menu");
        game.dirty = true;
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      menu.enter();
      audio.sfx("select");
      game.dirty = true;
    }
    return;
  }

  if (game.playerStunned()) {
    game.logMessage("You are stunned and cannot act.");
    game.monstersAct();
    game.refreshFOV();
    game.dirty = true;
    return;
  }

  let acted = false;
  const move = MOVE_KEYS[e.key];
  if (move) {
    e.preventDefault();
    acted = game.tryMove(move[0], move[1]);
  } else if (e.key === "." || e.key === "Enter") {
    e.preventDefault();
    acted = game.descend() || true;
  } else if (e.key === ",") {
    e.preventDefault();
    acted = game.ascend();
  } else if (e.key === "g") {
    e.preventDefault();
    acted = game.pickup();
  } else if (e.key === "u") {
    e.preventDefault();
    acted = game.drink();
  } else if (e.key === "t") {
    e.preventDefault();
    acted = game.useTorch();
  }

  if (acted) {
    game.monstersAct();
    game.refreshFOV();
    game.dirty = true;
  }
}
