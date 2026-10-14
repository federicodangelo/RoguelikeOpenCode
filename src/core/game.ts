import { MAP_W, type GameMap } from "./map.ts";
import { RNG } from "./rng.ts";
import { attack, gainXp, makePlayer, xpNeeded, type Entity } from "./entities.ts";
import { computeFOV } from "./fov.ts";
import { hasStatus } from "./status.ts";
import {
  dropCarried as dropCarriedItem,
  dropConsumable as dropConsumableStack,
  equipCarried,
  itemName,
  makeCorpse,
  makeGold,
  makeInstance,
  makeInventory,
  pickDefWhere,
  pickUp,
  qualityColor,
  recalcStats,
  rollQuality,
  unequipSlot,
  usePotion,
  useTorch,
  type EquipSlot,
  type Inventory,
  type ItemDef,
  type ItemKind,
  type Quality,
} from "./items.ts";
import { MessageLog } from "./messages.ts";
import { BASE_SEED, CORPSE_CAP, TORCH_RADIUS } from "./constants.ts";
import type { Effect } from "./effects.ts";
import type { CellView } from "./scene.ts";
import type { SavedRun } from "./save.ts";
import { FloorCache } from "./floorCache.ts";
import type { GameEvents } from "./events.ts";
import { runMonsterTurn, type TurnContext } from "./turnPipeline.ts";
import { buildScene, camera } from "./sceneBuilder.ts";
import { applySavedRun, serializeRun } from "./saveDto.ts";

export type { GameEvents } from "./events.ts";

export class Game {
  depth = 1;
  map: GameMap;
  player: Entity;
  visible = new Set<number>();
  runSeed: number;
  aiRng: RNG;
  battleRng: RNG;
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
  private readonly clock: () => number;
  private readonly cache: FloorCache;

  constructor(clock: () => number = () => 0, runSeed: number = BASE_SEED) {
    this.clock = clock;
    this.runSeed = runSeed;
    this.cache = new FloorCache(runSeed);
    this.aiRng = new RNG(runSeed + 999);
    this.battleRng = new RNG(runSeed + 555);
    this.map = this.getFloor(1);
    this.player = makePlayer(this.map.spawn.x, this.map.spawn.y);
    this.refreshFOV();
  }

  get floorCache(): FloorCache {
    return this.cache;
  }

  get floors(): Map<number, GameMap> {
    return this.cache.maps;
  }

  get monstersByFloor(): Map<number, Entity[]> {
    return this.cache.monsters;
  }

  get exploredByFloor(): Map<number, Set<number>> {
    return this.cache.explored;
  }

  get mapVersion(): number {
    return this.cache.version;
  }

  set mapVersion(value: number) {
    this.cache.version = value;
  }

  get exploredVersion(): number {
    return this.cache.exploredVersion;
  }

  set exploredVersion(value: number) {
    this.cache.exploredVersion = value;
  }

  getFloor(d: number, upAt?: { x: number; y: number }): GameMap {
    return this.cache.get(d, upAt);
  }

  monsters(): Entity[] {
    return this.cache.monstersAt(this.depth);
  }

  playerStunned(): boolean {
    return hasStatus(this.player, "stun");
  }

  refreshFOV(): void {
    const radius = this.lightTurns > 0 ? TORCH_RADIUS : undefined;
    this.visible = computeFOV(this.map, this.player.x, this.player.y, radius);
    const explored = this.cache.ensureExplored(this.depth);
    const before = explored.size;
    for (const k of this.visible) explored.add(k);
    if (explored.size !== before) this.cache.exploredVersion++;
  }

  logMessage(msg: string, color?: string): void {
    this.messages.push(msg, color);
  }

  private protectPlayer(): void {
    if (!this.godMode) return;
    if (!this.player.alive || this.player.hp <= 0) {
      this.player.alive = true;
      this.player.hp = Math.max(1, this.player.hp);
    }
  }

  spawnEffect(x: number, y: number, text: string, color: string): void {
    this.effects.push({ x, y, text, color, born: this.clock() });
    this.dirty = true;
  }

  hasPickableItemAtPlayer(): boolean {
    return this.map.items.some((i) => i.kind !== "corpse" && i.x === this.player.x && i.y === this.player.y);
  }

  itemKindAtPlayer(): ItemKind | null {
    const item = this.map.items.find((i) => i.kind !== "corpse" && i.x === this.player.x && i.y === this.player.y);
    return item ? item.kind : null;
  }

  itemNameAtPlayer(): string | null {
    const item = this.map.items.find((i) => i.kind !== "corpse" && i.x === this.player.x && i.y === this.player.y);
    return item ? itemName(item) : null;
  }

  itemQualityAtPlayer(): Quality | null {
    const item = this.map.items.find((i) => i.kind !== "corpse" && i.x === this.player.x && i.y === this.player.y);
    return item ? item.quality : null;
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
    const ctx: TurnContext = {
      map: this.map,
      player: this.player,
      monsters: () => this.monsters(),
      aiRng: this.aiRng,
      battleRng: this.battleRng,
      lightTurns: this.lightTurns,
      gameOver: this.gameOver,
      events: this.events,
      mapVersion: this.mapVersion,
      playerFlashUntil: this.playerFlashUntil,
      clock: this.clock,
      spawnEffect: (x, y, text, color) => this.spawnEffect(x, y, text, color),
      logMessage: (msg) => this.logMessage(msg),
      handleMonsterDeath: (m) => this.handleMonsterDeath(m),
      protectPlayer: () => this.protectPlayer(),
    };

    runMonsterTurn(ctx);

    this.lightTurns = ctx.lightTurns;
    this.gameOver = ctx.gameOver;
    this.mapVersion = ctx.mapVersion;
    this.playerFlashUntil = ctx.playerFlashUntil;
  }

  dropLoot(m: Entity): void {
    const rng = this.battleRng;
    const roll = rng.next();
    if (roll < 0.35) {
      const sub = rng.next();
      if (sub < 0.5) {
        this.map.items.push({ x: m.x, y: m.y, ...makeGold(rng.int(5 + 2 * this.depth, 10 + 4 * this.depth)) });
      } else {
        const pred =
          sub < 0.8
            ? (d: ItemDef) => d.kind === "potion" || d.kind === "torch"
            : (d: ItemDef) => d.kind === "weapon" || d.kind === "armor";
        const def = pickDefWhere(rng, this.depth, pred);
        if (def) this.map.items.push({ x: m.x, y: m.y, ...makeInstance(def, rollQuality(rng, this.depth)) });
      }
      return;
    }
    if (roll < 0.75) {
      this.map.items.push({ x: m.x, y: m.y, ...makeCorpse() });
      this.capCorpses();
    }
  }

  private capCorpses(): void {
    let count = 0;
    for (const i of this.map.items) if (i.kind === "corpse") count++;
    while (count > CORPSE_CAP) {
      const idx = this.map.items.findIndex((i) => i.kind === "corpse");
      this.map.items.splice(idx, 1);
      count--;
    }
  }

  private handleMonsterDeath(m: Entity): void {
    this.dropLoot(m);
    this.kills++;
    const levels = gainXp(this.player, m.xpValue);
    if (levels > 0) {
      recalcStats(this.player, this.inventory);
      this.logMessage(`Level up! You are now level ${this.player.level}.`);
      this.events.level?.();
    } else {
      this.events.kill?.();
    }
  }

  tryMove(dx: number, dy: number): boolean {
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;
    const cell = this.map.cells[ny]?.[nx];
    if (!cell || cell === "wall") return false;
    if (cell === "doorClosed") {
      this.map.cells[ny]![nx] = "doorOpen";
      this.mapVersion++;
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
        this.logMessage(`You slay the ${target.name}.`);
        this.handleMonsterDeath(target);
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
      this.mapVersion++;
      this.logMessage(`You trigger a trap and take ${dmg} damage.`);
      this.spawnEffect(this.player.x, this.player.y, `-${dmg}`, "#ff9a4a");
      this.playerFlashUntil = this.clock() + 250;
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
    const idx = this.map.items.findIndex((i) => i.kind !== "corpse" && i.x === this.player.x && i.y === this.player.y);
    if (idx === -1) return false;
    const item = this.map.items[idx]!;
    const result = pickUp(this.player, this.inventory, item);
    if (!result) return false;
    if (result.took) this.map.items.splice(idx, 1);
    this.logMessage(result.message, qualityColor(item.quality));
    this.events.pickup?.();
    return true;
  }

  equipCarried(index: number): boolean {
    const msg = equipCarried(this.player, this.inventory, index);
    if (!msg) return false;
    this.logMessage(msg);
    this.dirty = true;
    return true;
  }

  unequip(slot: EquipSlot): boolean {
    const result = unequipSlot(this.player, this.inventory, slot);
    this.logMessage(result.message);
    if (!result.took) return false;
    this.dirty = true;
    return true;
  }

  dropCarried(index: number): boolean {
    const item = dropCarriedItem(this.inventory, index);
    if (!item) return false;
    this.map.items.push({
      x: this.player.x,
      y: this.player.y,
      kind: item.kind,
      variant: item.variant,
      quality: item.quality,
      tile: item.tile,
      stat: item.stat,
    });
    this.logMessage(`You drop the ${itemName(item)}.`, qualityColor(item.quality));
    this.dirty = true;
    return true;
  }

  dropConsumable(kind: "potion" | "torch"): boolean {
    const stack = dropConsumableStack(this.inventory, kind);
    if (!stack) return false;
    this.map.items.push({
      x: this.player.x,
      y: this.player.y,
      kind: stack.kind,
      variant: stack.variant,
      quality: stack.quality,
      tile: stack.tile,
      stat: stack.stat,
    });
    this.logMessage(`You drop a ${stack.variant}.`, qualityColor(stack.quality));
    this.dirty = true;
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
    const result = useTorch(this.inventory);
    if (!result) return false;
    this.lightTurns = result.turns;
    this.logMessage(`${result.message} Your light radius expands for ${result.turns} turns.`);
    this.events.pickup?.();
    return true;
  }

  spendSkill(stat: "atk" | "def" | "hp"): boolean {
    if (this.player.skillPoints <= 0) return false;
    this.player.skillPoints--;
    if (stat === "atk") {
      this.player.baseAtk += 1;
      recalcStats(this.player, this.inventory);
      this.logMessage("You spend a skill point on ATK.");
    } else if (stat === "def") {
      this.player.baseDef += 1;
      recalcStats(this.player, this.inventory);
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
      recalcStats(this.player, this.inventory);
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

  reset(seed: number = this.runSeed): void {
    this.godMode = false;
    this.depth = 1;
    this.kills = 0;
    this.cache.clear();
    this.cache.setSeed(seed);
    this.runSeed = seed;
    this.aiRng = new RNG(seed + 999);
    this.battleRng = new RNG(seed + 555);
    this.gameOver = false;
    this.inventory = makeInventory();
    this.messages.clear();
    this.effects.length = 0;
    this.playerFlashUntil = 0;
    this.lightTurns = 0;
    this.menuOpen = false;
    this.map = this.getFloor(1);
    this.player = makePlayer(this.map.spawn.x, this.map.spawn.y);
    this.mapVersion++;
    this.exploredVersion++;
    this.refreshFOV();
    this.dirty = true;
  }

  serialize(): SavedRun {
    return serializeRun(this);
  }

  loadRun(saved: SavedRun): void {
    applySavedRun(this, saved);
  }

  camera(): { x: number; y: number } {
    return camera(this);
  }

  buildScene(): CellView[][] {
    return buildScene(this);
  }
}
