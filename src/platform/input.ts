import type { Game } from "../core/game.ts";
import type { MenuNav } from "../ui/menu.ts";
import type { GameAudio } from "./audio.ts";

export const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

const ACTION_KEYS = new Set([".", "Enter", ",", "g", "u", "t"]);

export interface InputContext {
  game: Game;
  menu: MenuNav;
  audio: GameAudio;
  startGame(): void;
  toggleSound(): void;
  openInventory(): void;
}

export function handleKeydown(e: KeyboardEvent, ctx: InputContext): boolean {
  const { game, menu, audio, toggleSound, openInventory } = ctx;

  if (e.repeat && game.screen === "game" && !game.gameOver && !game.menuOpen) {
    return false;
  }

  if (game.screen === "title") {
    if (e.key === "Enter") {
      e.preventDefault();
      audio.unlock();
      audio.sfx("select");
      ctx.startGame();
      return true;
    }
    return false;
  }

  if (game.gameOver) {
    if (e.key === "Enter") {
      e.preventDefault();
      audio.stopMusic();
      game.screen = "title";
      game.dirty = true;
      return true;
    }
    return false;
  }

  if (e.key === "m") {
    e.preventDefault();
    toggleSound();
    game.dirty = true;
    return false;
  }

  if (e.key === "Escape") {
    e.preventDefault();
    audio.sfx("menu");
    if (game.menuOpen && menu.depth() > 1) {
      menu.back();
    } else if (game.menuOpen && menu.ids()[0] === "inventory") {
      game.menuOpen = false;
    } else if (game.menuOpen && menu.depth() > 0) {
      menu.back();
    } else {
      game.menuOpen = !game.menuOpen;
      if (game.menuOpen) menu.open();
    }
    game.dirty = true;
    return false;
  }

  if (e.key === "i") {
    e.preventDefault();
    if (game.menuOpen && menu.ids()[0] === "inventory") {
      game.menuOpen = false;
    } else {
      openInventory();
    }
    audio.sfx("menu");
    game.dirty = true;
    return false;
  }

  if (game.menuOpen) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      menu.up();
      audio.sfx("menu");
      game.dirty = true;
      return false;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      menu.down();
      audio.sfx("menu");
      game.dirty = true;
      return false;
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
      return false;
    } else if (e.key === "Enter") {
      e.preventDefault();
      menu.enter();
      audio.sfx("select");
      game.dirty = true;
      return true;
    }
    return false;
  }

  if (game.playerStunned()) {
    if (MOVE_KEYS[e.key] === undefined && !ACTION_KEYS.has(e.key)) return false;
    e.preventDefault();
    game.logMessage("You are stunned and cannot act.");
    game.monstersAct();
    game.refreshFOV();
    game.dirty = true;
    return true;
  }

  let acted = false;
  const move = MOVE_KEYS[e.key];
  if (move) {
    e.preventDefault();
    acted = game.tryMove(move[0], move[1]);
  } else if (e.key === "." || e.key === "Enter") {
    e.preventDefault();
    acted = game.descend();
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
    return true;
  }
  return false;
}
