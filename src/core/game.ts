import { T } from "./tiles.ts";
import { generateMap, MAP_H, MAP_W, type GameMap } from "./map.ts";
import { RNG } from "./rng.ts";
import { makePlayer, spawnMonsters, attack, gainXp, xpNeeded, type Entity } from "./entities.ts";
import { computeFOV } from "./fov.ts";
import { chaseDistances, monsterStep } from "./ai.ts";
import { addStatus, hasStatus, tickStatuses } from "./status.ts";
import { kindOfTile, makeInventory, pickUp, usePotion, useTorch, type Inventory, type ItemKind } from "./items.ts";
import { MessageLog } from "../ui/menu.ts";
import { BASE_SEED, TORCH_RADIUS, TORCH_TURNS, VIEW_COLS, VIEW_ROWS } from "./constants.ts";
import { spawnEffect, type Effect } from "../ui/effects.ts";
import type { CellView } from "../platform/render.ts";
import { SAVE_VERSION, type SavedRun } from "./save.ts";

export interface GameEvents {
  hit?: () => void;
  kill?: () => void;
  level?: () => void;
  hurt?: () => void;
  death?: () => void;
  stairs?: () => void;
  pickup?: () => void;
  potion?: () => void;
}

export class Game {
  depth = 1;
  map: GameMap;
  player: Entity;
  floors = new Map<number, GameMap>();
  monstersByFloor = new Map<number, Entity[]>();
  exploredByFloor = new Map<number, Set<number>>();
  visible = new Set<number>();
  aiRng = new RNG(BASE_SEED + 999);
  battleRng = new RNG(BASE_SEED + 555);
  gameOver = false;
  screen: "title" | "game" = "title";
  kills = 0;
  inventory: Inventory = makeInventory();
  messages = new MessageLog(4);
  effects: Effect[] = [];
  playerFlashUntil = 0;
  lightTurns = 0;
  godMode = false;
  menuOpen = false;
  dirty = true;
  events: GameEvents = {};

  constructor() {
    this.map = this.getFloor(1);
    this.player = makePlayer(this.map.spawn.x, this.map.spawn.y);
    this.refreshFOV();
  }

  getFloor(d: number, upAt?: { x: number; y: number }): GameMap {
    let m = this.floors.get(d);
    if (!m) {
      m = generateMap(new RNG(BASE_SEED + d * 7919), d, { upAt });
      this.floors.set(d, m);
      this.monstersByFloor.set(d, spawnMonsters(m, new RNG(BASE_SEED + d * 7919 + 17), d));
    }
    return m;
  }

  monsters(): Entity[] {
    return this.monstersByFloor.get(this.depth)!;
  }

  playerStunned(): boolean {
    return hasStatus(this.player, "stun");
  }

  refreshFOV(): void {
    const radius = this.lightTurns > 0 ? TORCH_RADIUS : undefined;
    this.visible = computeFOV(this.map, this.player.x, this.player.y, radius);
    let explored = this.exploredByFloor.get(this.depth);
    if (!explored) {
      explored = new Set<number>();
      this.exploredByFloor.set(this.depth, explored);
    }
    for (const k of this.visible) explored.add(k);
  }

  logMessage(msg: string): void {
    this.messages.push(msg);
  }

  private protectPlayer(): void {
    if (!this.godMode) return;
    if (!this.player.alive || this.player.hp <= 0) {
      this.player.alive = true;
      this.player.hp = Math.max(1, this.player.hp);
    }
  }

  spawnEffect(x: number, y: number, text: string, color: string): void {
    spawnEffect(this.effects, x, y, text, color, performance.now());
    this.dirty = true;
  }

  hasPickableItemAtPlayer(): boolean {
    return this.map.items.some((i) => {
      if (i.x !== this.player.x || i.y !== this.player.y) return false;
      const kind = kindOfTile(i.tile);
      return kind !== null && kind !== "corpse";
    });
  }

  itemKindAtPlayer(): ItemKind | null {
    const item = this.map.items.find((i) => i.x === this.player.x && i.y === this.player.y);
    return item ? kindOfTile(item.tile) : null;
  }

  adjacentInteractables(): { doorClosed: boolean; trap: boolean; monster: Entity | null } {
    let doorClosed = false;
    let trap = false;
    let monster: Entity | null = null;

    const dirs: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of dirs) {
      const nx = this.player.x + dx;
      const ny = this.player.y + dy;
      const key = ny * MAP_W + nx;
      const cell = this.map.cells[ny]?.[nx];
      const visible = this.visible.has(key);

      if (visible && cell === "doorClosed") doorClosed = true;
      if (visible && cell === "trap") trap = true;

      if (!monster) {
        const target = this.monsters().find((m) => m.alive && m.x === nx && m.y === ny && visible);
        if (target) monster = target;
      }
    }

    return { doorClosed, trap, monster };
  }

  danger(): boolean {
    if (this.player.hp * 3 <= this.player.maxHp) return true;
    return this.adjacentInteractables().monster !== null;
  }

  monstersAct(): void {
    if (this.lightTurns > 0) this.lightTurns--;

    for (const m of this.monsters()) {
      if (!m.alive) continue;
      if (m.hp * 3 < m.maxHp && !hasStatus(m, "fear")) addStatus(m, "fear", 3, 1);
      const tick = tickStatuses(m);
      if (tick.damage > 0) {
        this.spawnEffect(m.x, m.y, `-${tick.damage}`, "#9be56f");
        for (const msg of tick.messages) this.logMessage(msg);
        if (!m.alive) {
          this.dropLoot(m);
          this.kills++;
          this.logMessage(`The ${m.name} dies from status effects.`);
        }
      }
    }

    const dist = chaseDistances(this.map, this.player);
    for (const m of this.monsters()) {
      if (!m.alive) continue;
      const before = this.player.hp;
      monsterStep(m, {
        player: this.player,
        map: this.map,
        rng: this.aiRng,
        dist,
        monsters: this.monsters(),
      });
      this.protectPlayer();
      if (this.player.hp < before) {
        const verb = m.archetype === "ranged" ? "shoots" : "hits";
        this.logMessage(`The ${m.name} ${verb} you for ${before - this.player.hp}.`);
        this.spawnEffect(this.player.x, this.player.y, `-${before - this.player.hp}`, "#ff6a6a");
        this.playerFlashUntil = performance.now() + 250;
        this.events.hurt?.();

        if (m.archetype === "summoner") {
          addStatus(this.player, "poison", 3, 1);
          this.logMessage("You are poisoned.");
        } else if (m.archetype === "boss") {
          addStatus(this.player, "bleeding", 3, 1);
          this.logMessage("You are bleeding.");
        } else if (m.archetype === "tank" && this.battleRng.next() < 0.35) {
          addStatus(this.player, "stun", 1, 1);
          this.logMessage("You are stunned.");
        }
      }

      const monsterCell = this.map.cells[m.y]?.[m.x];
      if (monsterCell === "trap") {
        const dmg = this.battleRng.int(1, 3);
        m.hp = Math.max(0, m.hp - dmg);
        if (m.hp === 0) m.alive = false;
        this.map.cells[m.y]![m.x] = "floor";
        this.spawnEffect(m.x, m.y, `-${dmg}`, "#ff9a4a");
        if (m.alive) {
          this.logMessage(`The ${m.name} triggers a trap.`);
        } else {
          this.dropLoot(m);
          this.kills++;
          this.logMessage(`The ${m.name} triggers a trap and dies.`);
        }
      }

      if (!this.player.alive) {
        this.gameOver = true;
        this.events.death?.();
        break;
      }
    }

    if (this.player.alive) {
      const playerTick = tickStatuses(this.player);
      this.protectPlayer();
      if (playerTick.damage > 0) {
        this.spawnEffect(this.player.x, this.player.y, `-${playerTick.damage}`, "#9be56f");
        for (const msg of playerTick.messages) this.logMessage(msg);
        this.playerFlashUntil = performance.now() + 250;
        this.events.hurt?.();
        if (!this.player.alive) {
          this.gameOver = true;
          this.events.death?.();
        }
      }
    }
  }

  dropLoot(m: Entity): void {
    this.map.items.push({
      x: m.x,
      y: m.y,
      tile: this.battleRng.next() < 0.3 ? T.Gold : T.Corpse,
    });
  }

  tryMove(dx: number, dy: number): boolean {
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    const cell = this.map.cells[ny]?.[nx];
    if (!cell || cell === "wall") return false;
    if (cell === "doorClosed") {
      this.map.cells[ny]![nx] = "doorOpen";
      return true;
    }

    const target = this.monsters().find((m) => m.alive && m.x === nx && m.y === ny);
    if (target) {
      const dmg = attack(this.battleRng, this.player, target);
      this.spawnEffect(target.x, target.y, `-${dmg}`, "#ffd97a");
      if (target.alive) {
        this.logMessage(`You hit the ${target.name} for ${dmg}.`);
        this.events.hit?.();
      } else {
        this.dropLoot(target);
        this.kills++;
        const levels = gainXp(this.player, target.xpValue);
        this.logMessage(`You slay the ${target.name}.`);
        if (levels > 0) {
          this.logMessage(`Level up! You are now level ${this.player.level}.`);
          this.events.level?.();
        } else {
          this.events.kill?.();
        }
      }
      return true;
    }

    this.player.x = nx;
    this.player.y = ny;
    if (cell === "trap") {
      const dmg = this.battleRng.int(1, 3);
      this.player.hp = Math.max(0, this.player.hp - dmg);
      this.protectPlayer();
      this.map.cells[ny]![nx] = "floor";
      this.logMessage(`You trigger a trap and take ${dmg} damage.`);
      this.spawnEffect(this.player.x, this.player.y, `-${dmg}`, "#ff9a4a");
      this.playerFlashUntil = performance.now() + 250;
      this.events.hurt?.();
      if (!this.player.alive) {
        this.gameOver = true;
        this.events.death?.();
      }
    }
    return true;
  }

  descend(): boolean {
    if (this.map.cells[this.player.y]![this.player.x] !== "stairs") return false;
    const from = this.map.stairs;
    this.depth++;
    this.map = this.getFloor(this.depth, from);
    const target = this.map.upStairs ?? this.map.spawn;
    this.player.x = target.x;
    this.player.y = target.y;
    this.events.stairs?.();
    return true;
  }

  ascend(): boolean {
    if (this.map.cells[this.player.y]![this.player.x] !== "stairsUp" || this.depth <= 1) return false;
    this.depth--;
    this.map = this.getFloor(this.depth);
    this.player.x = this.map.stairs.x;
    this.player.y = this.map.stairs.y;
    this.events.stairs?.();
    return true;
  }

  pickup(): boolean {
    const idx = this.map.items.findIndex((i) => i.x === this.player.x && i.y === this.player.y);
    if (idx === -1) return false;
    const msg = pickUp(this.player, this.inventory, this.map.items[idx]!.tile);
    if (!msg) return false;
    this.map.items.splice(idx, 1);
    this.logMessage(msg);
    this.events.pickup?.();
    return true;
  }

  drink(): boolean {
    const msg = usePotion(this.player, this.inventory);
    if (!msg) return false;
    this.logMessage(msg);
    this.events.potion?.();
    return true;
  }

  useTorch(): boolean {
    const msg = useTorch(this.inventory);
    if (!msg) return false;
    this.lightTurns = TORCH_TURNS;
    this.logMessage(`${msg} Your light radius expands for ${TORCH_TURNS} turns.`);
    this.events.pickup?.();
    return true;
  }

  spendSkill(stat: "atk" | "def" | "hp"): boolean {
    if (this.player.skillPoints <= 0) return false;
    this.player.skillPoints--;
    if (stat === "atk") {
      this.player.atk += 1;
      this.logMessage("You spend a skill point on ATK.");
    } else if (stat === "def") {
      this.player.def += 1;
      this.logMessage("You spend a skill point on DEF.");
    } else {
      this.player.maxHp += 2;
      this.player.hp += 2;
      this.logMessage("You spend a skill point on Max HP.");
    }
    return true;
  }

  toggleGodMode(): boolean {
    this.godMode = !this.godMode;
    this.logMessage(this.godMode ? "God mode enabled." : "God mode disabled.");
    this.dirty = true;
    return this.godMode;
  }

  cheatLevelUp(): void {
    const levels = gainXp(this.player, xpNeeded(this.player.level));
    if (levels > 0) {
      this.logMessage(`Cheated level up! You are now level ${this.player.level}.`);
      this.events.level?.();
    }
    this.dirty = true;
  }

  cheatNextDepth(): void {
    const from = this.map.stairs;
    this.depth++;
    this.map = this.getFloor(this.depth, from);
    const target = this.map.upStairs ?? this.map.spawn;
    this.player.x = target.x;
    this.player.y = target.y;
    this.logMessage(`Cheated to depth ${this.depth}.`);
    this.events.stairs?.();
    this.refreshFOV();
    this.dirty = true;
  }

  reset(): void {
    this.godMode = false;
    this.depth = 1;
    this.kills = 0;
    this.floors.clear();
    this.monstersByFloor.clear();
    this.exploredByFloor.clear();
    this.aiRng = new RNG(BASE_SEED + 999);
    this.battleRng = new RNG(BASE_SEED + 555);
    this.gameOver = false;
    this.inventory = makeInventory();
    this.messages.clear();
    this.effects.length = 0;
    this.playerFlashUntil = 0;
    this.lightTurns = 0;
    this.menuOpen = false;
    this.map = this.getFloor(1);
    this.player = makePlayer(this.map.spawn.x, this.map.spawn.y);
    this.refreshFOV();
    this.dirty = true;
  }

  serialize(): SavedRun {
    return {
      version: SAVE_VERSION,
      depth: this.depth,
      kills: this.kills,
      gameOver: this.gameOver,
      screen: this.screen,
      player: this.player,
      inventory: this.inventory,
      lightTurns: this.lightTurns,
      godMode: this.godMode,
      aiRng: this.aiRng.getState(),
      battleRng: this.battleRng.getState(),
      floors: [...this.floors.entries()].map(([depth, map]) => ({
        depth,
        map,
        monsters: this.monstersByFloor.get(depth) ?? [],
        explored: [...(this.exploredByFloor.get(depth) ?? [])],
      })),
      messages: this.messages.snapshot(),
    };
  }

  loadRun(saved: SavedRun): void {
    this.depth = saved.depth;
    this.kills = saved.kills;
    this.gameOver = saved.gameOver;
    this.screen = saved.screen;
    this.player = saved.player;
    this.inventory = saved.inventory;
    this.lightTurns = saved.lightTurns;
    this.godMode = saved.godMode;
    this.aiRng.setState(saved.aiRng);
    this.battleRng.setState(saved.battleRng);

    this.floors.clear();
    this.monstersByFloor.clear();
    this.exploredByFloor.clear();
    for (const floor of saved.floors) {
      this.floors.set(floor.depth, floor.map);
      this.monstersByFloor.set(floor.depth, floor.monsters);
      this.exploredByFloor.set(floor.depth, new Set(floor.explored));
    }

    this.map = this.floors.get(this.depth) ?? this.getFloor(this.depth);
    if (!this.exploredByFloor.has(this.depth)) this.exploredByFloor.set(this.depth, new Set());
    this.messages.restore(saved.messages);
    this.effects.length = 0;
    this.playerFlashUntil = 0;
    this.menuOpen = false;
    this.refreshFOV();
    this.dirty = true;
  }

  camera(): { x: number; y: number } {
    return {
      x: Math.max(0, Math.min(this.player.x - ((VIEW_COLS - 1) >> 1), MAP_W - VIEW_COLS)),
      y: Math.max(0, Math.min(this.player.y - ((VIEW_ROWS - 1) >> 1), MAP_H - VIEW_ROWS)),
    };
  }

  buildScene(): CellView[][] {
    const cam = this.camera();
    const scene: CellView[][] = [];
    for (let vy = 0; vy < VIEW_ROWS; vy++) {
      const row: CellView[] = [];
      for (let vx = 0; vx < VIEW_COLS; vx++) {
        const mx = cam.x + vx;
        const my = cam.y + vy;
        const key = my * MAP_W + mx;
        const explored = this.exploredByFloor.get(this.depth)!.has(key);
        if (!explored) {
          row.push({ floor: T.Black });
          continue;
        }

        const cell = this.map.cells[my]![mx]!;
        const view: CellView = { floor: T.Floor };
        if (cell === "wall") view.feature = T.Wall;
        else if (cell === "stairs") view.feature = T.Stairs;
        else if (cell === "stairsUp") view.feature = T.StairsUp;
        else if (cell === "doorClosed") view.feature = T.DoorClosed;
        else if (cell === "doorOpen") view.feature = T.DoorOpen;
        else if (cell === "trap") view.feature = T.Trap;

        const item = this.map.items.find((i) => i.x === mx && i.y === my);
        if (item) view.feature = item.tile;

        const isVisible = this.visible.has(key);
        if (isVisible) {
          const monster = this.monsters().find((m) => m.alive && m.x === mx && m.y === my);
          if (monster) view.entity = monster.sprite;
        } else {
          view.dim = true;
        }
        row.push(view);
      }
      scene.push(row);
    }

    const px = this.player.x - cam.x;
    const py = this.player.y - cam.y;
    if (px >= 0 && px < VIEW_COLS && py >= 0 && py < VIEW_ROWS) {
      scene[py]![px]!.entity = T.Player;
    }
    return scene;
  }
}
