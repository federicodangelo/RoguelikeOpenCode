import { T, TILE_SIZE } from "./tiles.ts";
import { Tileset, drawScene, type CellView } from "./render.ts";
import { generateMap, MAP_H, MAP_W, type GameMap } from "./map.ts";
import { RNG } from "./rng.ts";
import { makePlayer, spawnMonsters, attack, gainXp, type Entity } from "./entities.ts";
import { computeFOV } from "./fov.ts";
import { chaseDistances, monsterStep } from "./ai.ts";
import { makeInventory, pickUp, usePotion } from "./items.ts";

const VIEW_COLS = 30;
const VIEW_ROWS = 20;

const LOGICAL_W = VIEW_COLS * TILE_SIZE;
const LOGICAL_H = VIEW_ROWS * TILE_SIZE;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
canvas.width = LOGICAL_W;
canvas.height = LOGICAL_H;
ctx.imageSmoothingEnabled = false;

let dirty = true;

const SETTINGS_KEY = "roguelike.settings";
let fractionalScaling = true;

function loadSettings(): void {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as { fractionalScaling?: boolean };
      fractionalScaling = s.fractionalScaling ?? true;
    }
  } catch {
    fractionalScaling = true;
  }
}

function saveSettings(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ fractionalScaling }));
  } catch {
    // storage unavailable; keep in-memory setting
  }
}

function fitCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
  const scale = fractionalScaling ? fit : Math.max(1, Math.floor(fit));
  const factor = fractionalScaling ? scale * dpr : Math.max(1, Math.round(scale * dpr));
  canvas.width = Math.round(LOGICAL_W * factor);
  canvas.height = Math.round(LOGICAL_H * factor);
  canvas.style.width = `${Math.round(LOGICAL_W * scale)}px`;
  canvas.style.height = `${Math.round(LOGICAL_H * scale)}px`;
  ctx.setTransform(factor, 0, 0, factor, 0, 0);
  ctx.imageSmoothingEnabled = false;
  dirty = true;
}
window.addEventListener("resize", fitCanvas);
loadSettings();
fitCanvas();

const BASE_SEED = 1337;
const floors = new Map<number, GameMap>();
const monstersByFloor = new Map<number, Entity[]>();

function getFloor(d: number, upAt?: { x: number; y: number }): GameMap {
  let m = floors.get(d);
  if (!m) {
    m = generateMap(new RNG(BASE_SEED + d * 7919), d, { upAt });
    floors.set(d, m);
    monstersByFloor.set(d, spawnMonsters(m, new RNG(BASE_SEED + d * 7919 + 17), d));
  }
  return m;
}

let depth = 1;
let map: GameMap = getFloor(1);
let player: Entity = makePlayer(map.spawn.x, map.spawn.y);

const exploredByFloor = new Map<number, Set<number>>();
let visible = new Set<number>();

function refreshFOV(): void {
  visible = computeFOV(map, player.x, player.y);
  let explored = exploredByFloor.get(depth);
  if (!explored) {
    explored = new Set<number>();
    exploredByFloor.set(depth, explored);
  }
  for (const k of visible) explored.add(k);
}
refreshFOV();

function monsters(): Entity[] {
  return monstersByFloor.get(depth)!;
}

const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  Home: [-1, -1],
  PageUp: [1, -1],
  End: [-1, 1],
  PageDown: [1, 1],
};

let AI_RNG = new RNG(BASE_SEED + 999);
let BATTLE_RNG = new RNG(BASE_SEED + 555);
let gameOver = false;
let inventory = makeInventory();
let message = "";
let showInventory = false;
let menuOpen = false;
let menuIndex = 0;

const MENU_ITEMS = ["Help", "Settings", "Restart"] as const;
const HELP_LINES: [string, string][] = [
  ["arrows", "move / bump attack"],
  ["home pgup end pgdn", "diagonal move"],
  [".", "stairs down"],
  [",", "stairs up"],
  ["g", "pick up item"],
  ["u", "drink potion"],
  ["i", "toggle inventory"],
  ["esc", "open/close menu"],
  ["enter", "restart (when dead)"],
];

function monstersAct(): void {
  const dist = chaseDistances(map, player);
  for (const m of monsters()) {
    if (!m.alive) continue;
    monsterStep(m, { player, map, rng: AI_RNG, dist, monsters: monsters() });
    if (!player.alive) {
      gameOver = true;
      break;
    }
  }
}

function dropLoot(m: Entity): void {
  map.items.push({ x: m.x, y: m.y, tile: BATTLE_RNG.next() < 0.3 ? T.Gold : T.Corpse });
}

function tryMove(dx: number, dy: number): boolean {
  const nx = player.x + dx;
  const ny = player.y + dy;
  const cell = map.cells[ny]?.[nx];
  if (!cell || cell === "wall") return false;
  if (cell === "doorClosed") {
    map.cells[ny]![nx] = "doorOpen";
    return true;
  }
  const target = monsters().find((m) => m.alive && m.x === nx && m.y === ny);
  if (target) {
    attack(BATTLE_RNG, player, target);
    if (!target.alive) {
      dropLoot(target);
      const levels = gainXp(player, target.xpValue);
      message = levels > 0 ? `Level up! You are now level ${player.level}.` : `You slay the ${target.name}.`;
    }
    return true;
  }
  player.x = nx;
  player.y = ny;
  return true;
}

function descend(): boolean {
  if (map.cells[player.y]![player.x] !== "stairs") return false;
  const from = map.stairs;
  depth++;
  map = getFloor(depth, from);
  const target = map.upStairs ?? map.spawn;
  player.x = target.x;
  player.y = target.y;
  return true;
}

function ascend(): boolean {
  if (map.cells[player.y]![player.x] !== "stairsUp" || depth <= 1) return false;
  depth--;
  map = getFloor(depth);
  player.x = map.stairs.x;
  player.y = map.stairs.y;
  return true;
}

function resetGame(): void {
  depth = 1;
  floors.clear();
  monstersByFloor.clear();
  exploredByFloor.clear();
  AI_RNG = new RNG(BASE_SEED + 999);
  BATTLE_RNG = new RNG(BASE_SEED + 555);
  gameOver = false;
  inventory = makeInventory();
  message = "";
  showInventory = false;
  menuOpen = false;
  menuIndex = 0;
  map = getFloor(1);
  player = makePlayer(map.spawn.x, map.spawn.y);
  refreshFOV();
  dirty = true;
}

window.addEventListener("keydown", (e) => {
  if (gameOver) {
    if (e.key === "Enter") {
      e.preventDefault();
      resetGame();
    }
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    menuOpen = !menuOpen;
    dirty = true;
    return;
  }
  if (menuOpen) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      menuIndex = (menuIndex + MENU_ITEMS.length - 1) % MENU_ITEMS.length;
      dirty = true;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      menuIndex = (menuIndex + 1) % MENU_ITEMS.length;
      dirty = true;
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (MENU_ITEMS[menuIndex] === "Restart") {
        resetGame();
      } else if (MENU_ITEMS[menuIndex] === "Settings") {
        fractionalScaling = !fractionalScaling;
        saveSettings();
        fitCanvas();
      }
    }
    return;
  }
  let acted = false;
  const move = MOVE_KEYS[e.key];
  if (move) {
    e.preventDefault();
    acted = tryMove(move[0], move[1]);
  } else if (e.key === "." || e.key === "Enter") {
    e.preventDefault();
    acted = descend() || true;
  } else if (e.key === ",") {
    e.preventDefault();
    acted = ascend();
  } else if (e.key === "g") {
    e.preventDefault();
    const idx = map.items.findIndex((i) => i.x === player.x && i.y === player.y);
    if (idx !== -1) {
      const msg = pickUp(player, inventory, map.items[idx]!.tile);
      if (msg) {
        map.items.splice(idx, 1);
        message = msg;
        acted = true;
      }
    }
  } else if (e.key === "u") {
    e.preventDefault();
    const msg = usePotion(player, inventory);
    if (msg) {
      message = msg;
      acted = true;
    }
  } else if (e.key === "i") {
    e.preventDefault();
    showInventory = !showInventory;
    dirty = true;
  }
  if (acted) {
    monstersAct();
    refreshFOV();
    dirty = true;
  }
});

function camera(): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(player.x - ((VIEW_COLS - 1) >> 1), MAP_W - VIEW_COLS)),
    y: Math.max(0, Math.min(player.y - ((VIEW_ROWS - 1) >> 1), MAP_H - VIEW_ROWS)),
  };
}

function buildScene(): CellView[][] {
  const cam = camera();
  const scene: CellView[][] = [];
  for (let vy = 0; vy < VIEW_ROWS; vy++) {
    const row: CellView[] = [];
    for (let vx = 0; vx < VIEW_COLS; vx++) {
      const mx = cam.x + vx;
      const my = cam.y + vy;
      const key = my * MAP_W + mx;
      const explored = exploredByFloor.get(depth)!.has(key);
      if (!explored) {
        row.push({ floor: T.Black });
        continue;
      }
      const cell = map.cells[my]![mx]!;
      const view: CellView = { floor: T.Floor };
      if (cell === "wall") view.feature = T.Wall;
      else if (cell === "stairs") view.feature = T.Stairs;
      else if (cell === "stairsUp") view.feature = T.StairsUp;
      else if (cell === "doorClosed") view.feature = T.DoorClosed;
      else if (cell === "doorOpen") view.feature = T.DoorOpen;
      const item = map.items.find((i) => i.x === mx && i.y === my);
      if (item) view.feature = item.tile;
      const isVisible = visible.has(key);
      if (isVisible) {
        const monster = monsters().find((m) => m.alive && m.x === mx && m.y === my);
        if (monster) view.entity = monster.sprite;
      } else {
        view.dim = true;
      }
      row.push(view);
    }
    scene.push(row);
  }
  const px = player.x - cam.x;
  const py = player.y - cam.y;
  if (px >= 0 && px < VIEW_COLS && py >= 0 && py < VIEW_ROWS) {
    scene[py]![px]!.entity = T.Player;
  }
  return scene;
}

async function main(): Promise<void> {
  const tiles = await Tileset.load("assets/tiles.png");

  function draw(): void {
    drawScene(ctx, tiles, buildScene());
    drawHUD();
    if (gameOver) drawGameOver();
    if (menuOpen) drawMenu();
    dirty = false;
  }

  function drawMenu(): void {
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    const w = 460;
    const h = 380;
    const x = (LOGICAL_W - w) / 2;
    const y = (LOGICAL_H - h) / 2;
    ctx.fillStyle = "#17150f";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#5a544a";
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#e8e4da";
    ctx.font = "bold 20px monospace";
    ctx.fillText("MENU", x + 20, y + 34);
    ctx.font = "16px monospace";
    MENU_ITEMS.forEach((it, i) => {
      ctx.fillStyle = i === menuIndex ? "#ffd97a" : "#9a958c";
      ctx.fillText(`${i === menuIndex ? ">" : " "} ${it}`, x + 20, y + 64 + i * 24);
    });
    if (menuIndex === 0) {
      HELP_LINES.forEach(([k, v], i) => {
        ctx.fillStyle = "#e8e4da";
        ctx.fillText(k, x + 24, y + 130 + i * 24);
        ctx.fillStyle = "#9a958c";
        ctx.fillText(v, x + 220, y + 130 + i * 24);
      });
    } else if (menuIndex === 1) {
      ctx.fillStyle = "#e8e4da";
      ctx.fillText("Fractional scaling:", x + 24, y + 130);
      ctx.fillStyle = fractionalScaling ? "#7ac47a" : "#c47a7a";
      ctx.fillText(fractionalScaling ? "on" : "off", x + 250, y + 130);
      ctx.fillStyle = "#9a958c";
      ctx.fillText("Press Enter to toggle", x + 24, y + 154);
    } else {
      ctx.fillStyle = "#e8e4da";
      ctx.fillText("Restart the run from depth 1.", x + 24, y + 130);
      ctx.fillText("Press Enter.", x + 24, y + 154);
    }
  }

  function drawHUD(): void {
    const stats = `Depth ${depth} (${map.algorithm})   HP ${player.hp}/${player.maxHp}   Lvl ${player.level}   Gold ${inventory.gold}   Potions ${inventory.potions}`;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, LOGICAL_H - 24, LOGICAL_W, 24);
    ctx.fillStyle = "#e8e4da";
    ctx.font = "14px monospace";
    ctx.fillText(stats, 8, LOGICAL_H - 7);
    ctx.fillStyle = "#9a958c";
    ctx.textAlign = "right";
    ctx.fillText("esc menu", LOGICAL_W - 8, LOGICAL_H - 7);
    ctx.textAlign = "left";
    if (showInventory) {
      const inv = `Sword: ${inventory.sword ? "+1 ATK" : "-"}   Shield: ${inventory.shield ? "+1 DEF" : "-"}   Potions: ${inventory.potions}   Gold: ${inventory.gold}`;
      ctx.fillText(inv, 8, LOGICAL_H - 40);
    } else if (message) {
      ctx.fillText(message, 8, LOGICAL_H - 40);
    }
  }

  function drawGameOver(): void {
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = "#e8e4da";
    ctx.textAlign = "center";
    ctx.font = "bold 32px monospace";
    ctx.fillText("You died!", LOGICAL_W / 2, LOGICAL_H / 2 - 10);
    ctx.font = "16px monospace";
    ctx.fillText("Press Enter to restart", LOGICAL_W / 2, LOGICAL_H / 2 + 24);
    ctx.textAlign = "left";
  }

  function frame(): void {
    if (dirty) draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
