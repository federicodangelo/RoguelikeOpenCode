import { describe, expect, it } from "bun:test";
import { Game } from "../../src/core/game.ts";
import { TORCH_TURNS } from "../../src/core/constants.ts";
import { MAP_W } from "../../src/core/map.ts";
import { T } from "../../src/core/tiles.ts";
import { addStatus, hasStatus } from "../../src/core/status.ts";
import { type Entity } from "../../src/core/entities.ts";
import { openInterior, placedItem } from "./helpers.ts";

function monster(x: number, y: number, overrides: Partial<Entity> = {}): Entity {
  return {
    id: 1,
    name: "rat",
    x,
    y,
    hp: 4,
    maxHp: 4,
    atk: 2,
    def: 0,
    baseAtk: 2,
    baseDef: 0,
    sprite: T.Rat,
    isPlayer: false,
    alive: true,
    xp: 0,
    level: 1,
    xpValue: 2,
    skillPoints: 0,
    archetype: "normal",
    speed: 1,
    range: 0,
    statuses: [],
    ...overrides,
  };
}

describe("Game torches", () => {
  it("lighting a torch consumes it and sets temporary light turns", () => {
    const game = new Game();
    game.inventory.consumables.push({
      kind: "torch",
      variant: "torch",
      quality: "common",
      tile: T.Torch,
      stat: TORCH_TURNS,
      count: 1,
    });
    expect(game.useTorch()).toBe(true);
    expect(game.inventory.consumables.length).toBe(0);
    expect(game.lightTurns).toBe(TORCH_TURNS);
    game.monstersAct();
    expect(game.lightTurns).toBe(TORCH_TURNS - 1);
  });
});

describe("Game status effects", () => {
  it("ticks player poison after monsters act", () => {
    const game = new Game();
    addStatus(game.player, "poison", 2, 1);
    const hp = game.player.hp;
    game.monstersAct();
    expect(game.player.hp).toBeLessThan(hp);
    expect(hasStatus(game.player, "poison")).toBe(true);
  });

  it("reports stunned players", () => {
    const game = new Game();
    addStatus(game.player, "stun", 1, 1);
    expect(game.playerStunned()).toBe(true);
  });
});

describe("Game skills", () => {
  it("spends skill points on stats", () => {
    const game = new Game();
    game.player.skillPoints = 2;
    const atk = game.player.atk;
    const def = game.player.def;
    const maxHp = game.player.maxHp;

    expect(game.spendSkill("atk")).toBe(true);
    expect(game.player.atk).toBe(atk + 1);
    expect(game.spendSkill("def")).toBe(true);
    expect(game.player.def).toBe(def + 1);
    expect(game.spendSkill("hp")).toBe(false);
    expect(game.player.maxHp).toBe(maxHp);
  });
});

describe("Game pickups", () => {
  it("picks up loot stacked under a corpse at the player tile", () => {
    const game = new Game();
    const x = game.player.x;
    const y = game.player.y;
    game.map.items.push(placedItem(x, y, "corpse", T.Corpse));
    game.map.items.push(placedItem(x, y, "gold", T.Gold, 1));

    expect(game.pickup()).toBe(true);
    expect(game.inventory.gold).toBe(1);
    expect(game.map.items.some((i) => i.tile === T.Corpse && i.x === x && i.y === y)).toBe(true);
  });

  it("reports the pickable item kind when a corpse is on top", () => {
    const game = new Game();
    const x = game.player.x;
    const y = game.player.y;
    game.map.items.push(placedItem(x, y, "corpse", T.Corpse));
    game.map.items.push(placedItem(x, y, "potion", T.Potion, 5));

    expect(game.hasPickableItemAtPlayer()).toBe(true);
    expect(game.itemKindAtPlayer()).toBe("potion");
  });

  it("does not pick up a lone corpse", () => {
    const game = new Game();
    game.map.items.push(placedItem(game.player.x, game.player.y, "corpse", T.Corpse));

    expect(game.hasPickableItemAtPlayer()).toBe(false);
    expect(game.pickup()).toBe(false);
  });

  it("stows a second weapon and removes it from the floor", () => {
    const game = new Game();
    const x = game.player.x;
    const y = game.player.y;
    game.map.items.push(placedItem(x, y, "weapon", T.Sword, 2, "short sword"));
    expect(game.pickup()).toBe(true);
    game.map.items.push(placedItem(x, y, "weapon", T.Sword, 1, "dagger"));
    expect(game.pickup()).toBe(true);
    expect(game.inventory.equipment.weapon?.variant).toBe("short sword");
    expect(game.inventory.carried.length).toBe(1);
    expect(game.map.items.some((i) => i.kind === "weapon" && i.x === x && i.y === y)).toBe(false);
  });

  it("leaves equipment on the floor when the pack is full", () => {
    const game = new Game();
    const x = game.player.x;
    const y = game.player.y;
    game.map.items.push(placedItem(x, y, "weapon", T.Sword, 2, "short sword"));
    game.pickup();
    for (let i = 0; i < 6; i++) {
      game.map.items.push(placedItem(x, y, "weapon", T.Sword, 1, "dagger"));
      game.pickup();
    }
    expect(game.inventory.carried.length).toBe(6);
    game.map.items.push(placedItem(x, y, "weapon", T.Sword, 3, "long sword"));
    expect(game.pickup()).toBe(true);
    expect(game.inventory.carried.length).toBe(6);
    expect(game.map.items.some((i) => i.variant === "long sword" && i.x === x && i.y === y)).toBe(true);
  });

  it("equips a carried weapon and swaps the old piece back", () => {
    const game = new Game();
    const x = game.player.x;
    const y = game.player.y;
    game.map.items.push(placedItem(x, y, "weapon", T.Sword, 2, "short sword"));
    game.pickup();
    game.map.items.push(placedItem(x, y, "weapon", T.Sword, 3, "long sword"));
    game.pickup();
    expect(game.equipCarried(0)).toBe(true);
    expect(game.inventory.equipment.weapon?.variant).toBe("long sword");
    expect(game.inventory.carried[0]!.variant).toBe("short sword");
    expect(game.player.atk).toBe(game.player.baseAtk + 3);
  });

  it("unequipping stows the piece and updates ATK", () => {
    const game = new Game();
    game.map.items.push(placedItem(game.player.x, game.player.y, "weapon", T.Sword, 2, "short sword"));
    game.pickup();
    expect(game.unequip("weapon")).toBe(true);
    expect(game.inventory.equipment.weapon).toBeNull();
    expect(game.inventory.carried.length).toBe(1);
    expect(game.player.atk).toBe(game.player.baseAtk);
    expect(game.unequip("weapon")).toBe(false);
  });

  it("dropping a carried weapon places it on the floor at the player", () => {
    const game = new Game();
    const x = game.player.x;
    const y = game.player.y;
    game.map.items.push(placedItem(x, y, "weapon", T.Sword, 2, "short sword"));
    game.pickup();
    game.map.items.push({ ...placedItem(x, y, "weapon", T.LongSword, 4, "long sword"), quality: "uncommon" });
    game.pickup();
    expect(game.inventory.carried.length).toBe(1);
    expect(game.dropCarried(0)).toBe(true);
    expect(game.inventory.carried.length).toBe(0);
    expect(game.player.atk).toBe(game.player.baseAtk + 2);
    const dropped = game.map.items.find((i) => i.variant === "long sword");
    expect(dropped).toBeDefined();
    expect(dropped!.x).toBe(x);
    expect(dropped!.y).toBe(y);
    expect(dropped!.quality).toBe("uncommon");
    expect(dropped!.stat).toBe(4);
    expect(game.messages.at(game.messages.length - 1)).toContain("drop");
    expect(game.messages.colorAt(game.messages.length - 1)).toBe("#9be56f");
    expect(game.dropCarried(0)).toBe(false);
  });

  it("dropping a consumable places one item on the floor", () => {
    const game = new Game();
    game.inventory.consumables.push({
      kind: "potion",
      variant: "minor potion",
      quality: "common",
      tile: T.Potion,
      stat: 5,
      count: 2,
    });
    expect(game.dropConsumable("potion")).toBe(true);
    expect(game.inventory.consumables[0]!.count).toBe(1);
    const dropped = game.map.items.find((i) => i.kind === "potion" && i.x === game.player.x && i.y === game.player.y);
    expect(dropped).toBeDefined();
    expect(dropped!.variant).toBe("minor potion");
    expect(game.dropConsumable("torch")).toBe(false);
  });
});

describe("Game interactables", () => {
  it("reports the item kind at the player", () => {
    const game = new Game();
    game.map.items.push(placedItem(game.player.x, game.player.y, "potion", T.Potion, 5));
    expect(game.itemKindAtPlayer()).toBe("potion");
  });

  it("reports visible adjacent interactables", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    const x = game.player.x;
    const y = game.player.y;

    game.map.cells[y + 1]![x] = "doorClosed";
    game.map.cells[y]![x + 1] = "trap";
    game.monstersByFloor.get(game.depth)!.push({
      id: 999,
      name: "test rat",
      x: x - 1,
      y,
      hp: 1,
      maxHp: 1,
      atk: 1,
      def: 0,
      baseAtk: 1,
      baseDef: 0,
      sprite: T.Rat,
      isPlayer: false,
      alive: true,
      xp: 0,
      level: 1,
      xpValue: 1,
      skillPoints: 0,
      archetype: "normal",
      speed: 1,
      range: 0,
      statuses: [],
    });

    game.visible = new Set([y * MAP_W + (x - 1), (y + 1) * MAP_W + x, y * MAP_W + (x + 1)]);

    const adjacent = game.adjacentInteractables();
    expect(adjacent.doorClosed).toBe(true);
    expect(adjacent.trap).toBe(true);
    expect(adjacent.monster?.name).toBe("test rat");
  });

  it("ignores diagonal interactables", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    const x = game.player.x;
    const y = game.player.y;

    game.map.cells[y + 1]![x + 1] = "trap";
    game.visible = new Set([(y + 1) * MAP_W + (x + 1)]);

    expect(game.adjacentInteractables().trap).toBe(false);
  });
});

describe("Game cheats", () => {
  it("god mode prevents death from traps", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    game.godMode = true;
    game.player.hp = 1;
    game.map.cells[game.player.y + 1]![game.player.x] = "trap";

    expect(game.tryMove(0, 1)).toBe(true);
    expect(game.player.alive).toBe(true);
    expect(game.player.hp).toBe(1);
    expect(game.gameOver).toBe(false);
  });

  it("god mode prevents death from status effects", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    game.godMode = true;
    game.player.hp = 1;
    addStatus(game.player, "poison", 1, 10);

    game.monstersAct();
    expect(game.player.alive).toBe(true);
    expect(game.player.hp).toBe(1);
    expect(game.gameOver).toBe(false);
  });

  it("level up cheat increases level and grants a skill point", () => {
    const game = new Game();
    game.cheatLevelUp();
    expect(game.player.level).toBe(2);
    expect(game.player.skillPoints).toBe(1);
  });

  it("next depth cheat descends without stairs", () => {
    const game = new Game();
    game.cheatNextDepth();
    expect(game.depth).toBe(2);
    expect(game.map).toBe(game.floors.get(2)!);
  });
});

describe("Game fear", () => {
  it("applies fear once to a wounded monster and lets it expire without refreshing", () => {
    const game = new Game();
    game.map.cells = openInterior();
    game.monstersByFloor.set(game.depth, []);
    const m = monster(25, 20, { hp: 1, maxHp: 12 });
    game.monstersByFloor.get(game.depth)!.push(m);

    game.monstersAct();
    expect(hasStatus(m, "fear")).toBe(true);
    expect(m.statuses.find((s) => s.kind === "fear")!.turns).toBe(2);

    game.monstersAct();
    game.monstersAct();
    expect(hasStatus(m, "fear")).toBe(false);

    game.monstersAct();
    expect(hasStatus(m, "fear")).toBe(false);
  });
});

describe("Game scene lookup", () => {
  it("uses the first item when multiple items share a cell", () => {
    const game = new Game();
    game.map.items.push(placedItem(game.player.x, game.player.y, "gold", T.Gold, 1));
    game.map.items.push(placedItem(game.player.x, game.player.y, "potion", T.Potion, 5));

    const cam = game.camera();
    const scene = game.buildScene();
    expect(scene[game.player.y - cam.y]![game.player.x - cam.x]!.feature).toBe(T.Gold);
  });

  it("draws visible monsters through the lookup map", () => {
    const game = new Game();
    game.map.cells = openInterior();
    game.player.x = 25;
    game.player.y = 20;
    game.monstersByFloor.set(game.depth, []);
    game.refreshFOV();
    game.monstersByFloor.get(game.depth)!.push(monster(26, 20));

    const cam = game.camera();
    const scene = game.buildScene();
    expect(scene[20 - cam.y]![26 - cam.x]!.entity).toBe(T.Rat);
  });

  it("ignores dead monsters in the lookup map", () => {
    const game = new Game();
    game.map.cells = openInterior();
    game.player.x = 25;
    game.player.y = 20;
    game.monstersByFloor.set(game.depth, []);
    game.refreshFOV();
    game.monstersByFloor.get(game.depth)!.push(monster(26, 20, { alive: false }));

    const cam = game.camera();
    const scene = game.buildScene();
    expect(scene[20 - cam.y]![26 - cam.x]!.entity).toBeUndefined();
  });

  it("marks non-common items with a quality pip and leaves common items unmarked", () => {
    const game = new Game();
    game.map.items.push({
      x: game.player.x,
      y: game.player.y,
      kind: "weapon",
      variant: "battle axe",
      quality: "rare",
      tile: T.BattleAxe,
      stat: 6,
    });
    const cam = game.camera();
    const cell = game.buildScene()[game.player.y - cam.y]![game.player.x - cam.x]!;
    expect(cell.feature).toBe(T.BattleAxe);
    expect(cell.pip).toBe("#7ab8ff");

    game.map.items.length = 0;
    game.map.items.push(placedItem(game.player.x, game.player.y, "weapon", T.Dagger, 1, "dagger"));
    const cam2 = game.camera();
    const plain = game.buildScene()[game.player.y - cam2.y]![game.player.x - cam2.x]!;
    expect(plain.feature).toBe(T.Dagger);
    expect(plain.pip).toBeUndefined();
  });
});

describe("Game kill rewards", () => {
  it("trap kills grant kills, xp, and loot", () => {
    const game = new Game();
    game.map.cells = openInterior();
    game.monstersByFloor.set(game.depth, []);
    const m = monster(25, 20, { hp: 1, maxHp: 12, xpValue: 2, atk: 0 });
    game.map.cells[20]![25] = "trap";
    game.map.cells[19]![25] = "wall";
    game.map.cells[21]![25] = "wall";
    game.map.cells[20]![24] = "wall";
    game.map.cells[20]![26] = "wall";
    game.monstersByFloor.get(game.depth)!.push(m);
    game.battleRng.setState(0);

    game.monstersAct();
    expect(m.alive).toBe(false);
    expect(game.kills).toBe(1);
    expect(game.player.xp).toBe(2);
    expect(game.map.items.some((i) => i.x === 25 && i.y === 20)).toBe(true);
    expect(game.map.cells[20]![25] as string).toBe("floor");
  });

  it("status-effect kills grant kills, xp, and loot", () => {
    const game = new Game();
    game.map.cells = openInterior();
    game.monstersByFloor.set(game.depth, []);
    const m = monster(25, 20, { hp: 1, maxHp: 12, xpValue: 2 });
    addStatus(m, "poison", 1, 2);
    game.monstersByFloor.get(game.depth)!.push(m);
    game.battleRng.setState(0);

    game.monstersAct();
    expect(m.alive).toBe(false);
    expect(game.kills).toBe(1);
    expect(game.player.xp).toBe(2);
    expect(game.map.items.some((i) => i.x === 25 && i.y === 20)).toBe(true);
  });
});

describe("Game drop budget", () => {
  it("kills do not drop an item every time", () => {
    const game = new Game();
    game.battleRng.setState(0);
    let drops = 0;
    for (let i = 0; i < 40; i++) {
      const before = game.map.items.length;
      game.dropLoot(monster(2 + i, 2));
      if (game.map.items.length > before) drops++;
    }
    expect(drops).toBeGreaterThan(0);
    expect(drops).toBeLessThan(40);
  });

  it("caps corpses at 6 per floor", () => {
    const game = new Game();
    game.battleRng.setState(0);
    for (let i = 0; i < 60; i++) game.dropLoot(monster(2 + i, 2));
    expect(game.map.items.filter((i) => i.kind === "corpse").length).toBeLessThanOrEqual(6);
  });

  it("gold drops scale with depth", () => {
    const game = new Game();
    game.depth = 5;
    game.battleRng.setState(0);
    game.dropLoot(monster(10, 10));
    const gold = game.map.items.find((i) => i.kind === "gold");
    expect(gold).toBeDefined();
    expect(gold!.stat).toBeGreaterThanOrEqual(15);
    expect(gold!.stat).toBeLessThanOrEqual(30);
  });
});

describe("Game determinism", () => {
  it("same seed yields identical item instances across floors", () => {
    const a = new Game(() => 0, 777);
    const b = new Game(() => 0, 777);
    for (let d = 1; d <= 5; d++) {
      expect(b.map.items.map((i) => [i.x, i.y, i.kind, i.variant, i.quality, i.stat])).toEqual(
        a.map.items.map((i) => [i.x, i.y, i.kind, i.variant, i.quality, i.stat]),
      );
      for (const g of [a, b]) {
        g.player.x = g.map.stairs.x;
        g.player.y = g.map.stairs.y;
        g.descend();
      }
    }
  });
});

describe("Game equipment persistence", () => {
  it("keeps equipment and stats through descend and ascend", () => {
    const game = new Game(() => 0, 4242);
    game.map.items.push({
      x: game.player.x,
      y: game.player.y,
      kind: "weapon",
      variant: "long sword",
      quality: "uncommon",
      tile: T.LongSword,
      stat: 5,
    });
    game.pickup();
    expect(game.inventory.equipment.weapon?.stat).toBe(5);
    const atk = game.player.atk;

    game.player.x = game.map.stairs.x;
    game.player.y = game.map.stairs.y;
    expect(game.descend()).toBe(true);
    expect(game.inventory.equipment.weapon?.variant).toBe("long sword");
    expect(game.player.atk).toBe(atk);

    const up = game.map.upStairs;
    expect(up).not.toBeNull();
    game.player.x = up!.x;
    game.player.y = up!.y;
    expect(game.ascend()).toBe(true);
    expect(game.inventory.equipment.weapon?.variant).toBe("long sword");
    expect(game.player.atk).toBe(atk);
  });

  it("save/load mid-swap keeps the unequipped state and stats", () => {
    const game = new Game(() => 0, 4242);
    game.map.items.push({
      x: game.player.x,
      y: game.player.y,
      kind: "weapon",
      variant: "short sword",
      quality: "common",
      tile: T.Sword,
      stat: 2,
    });
    game.pickup();
    expect(game.unequip("weapon")).toBe(true);
    expect(game.inventory.equipment.weapon).toBeNull();
    expect(game.player.atk).toBe(game.player.baseAtk);

    const loaded = new Game(() => 0, 1);
    loaded.loadRun(game.serialize());
    expect(loaded.inventory.equipment.weapon).toBeNull();
    expect(loaded.inventory.carried.length).toBe(1);
    expect(loaded.player.atk).toBe(loaded.player.baseAtk);
  });
});
