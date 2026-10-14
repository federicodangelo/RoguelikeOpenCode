import type { FloorCache } from "./floorCache.ts";
import { setNextId, type Entity } from "./entities.ts";
import type { Effect } from "./effects.ts";
import type { Inventory } from "./items.ts";
import type { GameMap } from "./map.ts";
import type { MessageLog } from "./messages.ts";
import type { RNG } from "./rng.ts";
import { SAVE_VERSION, type SavedRun } from "./save.ts";

export interface RunState {
  runSeed: number;
  depth: number;
  kills: number;
  gameOver: boolean;
  screen: "title" | "game";
  player: Entity;
  inventory: Inventory;
  lightTurns: number;
  godMode: boolean;
  aiRng: RNG;
  battleRng: RNG;
  floorCache: FloorCache;
  messages: MessageLog;
  effects: Effect[];
  playerFlashUntil: number;
  menuOpen: boolean;
  map: GameMap;
  mapVersion: number;
  exploredVersion: number;
  dirty: boolean;
  refreshFOV(): void;
}

export function serializeRun(state: RunState): SavedRun {
  return {
    version: SAVE_VERSION,
    seed: state.runSeed,
    depth: state.depth,
    kills: state.kills,
    gameOver: state.gameOver,
    screen: state.screen,
    player: state.player,
    inventory: state.inventory,
    lightTurns: state.lightTurns,
    godMode: state.godMode,
    aiRng: state.aiRng.getState(),
    battleRng: state.battleRng.getState(),
    floors: state.floorCache.serializeFloors(),
    messages: state.messages.snapshot(),
  };
}

export function applySavedRun(state: RunState, saved: SavedRun): void {
  state.runSeed = saved.seed;
  state.floorCache.setSeed(saved.seed);
  state.depth = saved.depth;
  state.kills = saved.kills;
  state.gameOver = saved.gameOver;
  state.screen = saved.screen;
  state.player = saved.player;
  state.inventory = saved.inventory;
  state.lightTurns = saved.lightTurns;
  state.godMode = saved.godMode;
  state.aiRng.setState(saved.aiRng);
  state.battleRng.setState(saved.battleRng);

  state.floorCache.loadFloors(saved.floors);
  state.map = state.floorCache.maps.get(state.depth) ?? state.floorCache.get(state.depth);
  if (!state.floorCache.explored.has(state.depth)) {
    state.floorCache.explored.set(state.depth, new Set<number>());
  }

  let maxId = state.player.id;
  for (const monsters of state.floorCache.monsters.values()) {
    for (const m of monsters) maxId = Math.max(maxId, m.id);
  }
  setNextId(maxId + 1);

  state.messages.restore(saved.messages);
  state.effects.length = 0;
  state.playerFlashUntil = 0;
  state.menuOpen = false;
  state.mapVersion++;
  state.exploredVersion++;
  state.refreshFOV();
  state.dirty = true;
}
