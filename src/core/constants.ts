import { TILE_SIZE } from "./tiles.ts";

export const VIEW_COLS = 30;
export const VIEW_ROWS = 20;

export const LOGICAL_W = VIEW_COLS * TILE_SIZE;
export const LOGICAL_H = VIEW_ROWS * TILE_SIZE;

export const BASE_SEED = 1337;

export const TORCH_RADIUS = 12;
export const TORCH_TURNS = 20;

export const HELP_LINES: [string, string][] = [
  ["arrows", "move / bump attack"],
  ["home pgup end pgdn", "diagonal move"],
  [".", "stairs down"],
  [",", "stairs up"],
  ["g", "pick up item"],
  ["u", "drink potion"],
  ["t", "light torch"],
  ["i", "toggle inventory"],
  ["esc", "open/close menu"],
  ["enter", "start / title (when dead)"],
];
