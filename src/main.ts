import { T, TILE_SIZE } from "./tiles.ts";
import { Tileset, drawScene, type CellView } from "./render.ts";
import { generateMap, MAP_H, MAP_W, type GameMap } from "./map.ts";
import { RNG } from "./rng.ts";
import { makePlayer, spawnMonsters, attack, gainXp, type Entity } from "./entities.ts";
import { computeFOV } from "./fov.ts";
import { chaseDistances, monsterStep } from "./ai.ts";
import { makeInventory, pickUp, usePotion } from "./items.ts";
import { MenuNav, MessageLog, computeScaling, SCALING_MODES, type MenuEntry, type ScalingMode } from "./ui.ts";

const VIEW_COLS = 30;
const VIEW_ROWS = 20;

const LOGICAL_W = VIEW_COLS * TILE_SIZE;
const LOGICAL_H = VIEW_ROWS * TILE_SIZE;

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

let dirty = true;

const SETTINGS_KEY = "roguelike.settings";
let scalingMode: ScalingMode = "fractional";

function loadSettings(): void {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as { scalingMode?: ScalingMode; fractionalScaling?: boolean };
      if (s.scalingMode && SCALING_MODES.includes(s.scalingMode)) {
        scalingMode = s.scalingMode;
      } else if (typeof s.fractionalScaling === "boolean") {
        scalingMode = s.fractionalScaling ? "fractional" : "integer";
      }
    }
  } catch {
    scalingMode = "fractional";
  }
}

function saveSettings(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ scalingMode }));
  } catch {
    // storage unavailable; keep in-memory setting
  }
}

function fitCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
  const s = computeScaling(scalingMode, LOGICAL_W, LOGICAL_H, fit, dpr);
  canvas.width = s.backingW;
  canvas.height = s.backingH;
  canvas.style.width = `${s.cssW}px`;
  canvas.style.height = `${s.cssH}px`;
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
let screen: "title" | "game" = "title";
let kills = 0;
let inventory = makeInventory();
const messageLog = new MessageLog(4);

interface Effect {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
}

const effects: Effect[] = [];
let playerFlashUntil = 0;

function spawnEffect(x: number, y: number, text: string, color: string): void {
  effects.push({ x, y, text, color, born: performance.now() });
  dirty = true;
}

function logMessage(msg: string): void {
  messageLog.push(msg);
}
let showInventory = false;
let menuOpen = false;
const menu = new MenuNav(menuTree);

const HELP_LINES: [string, string][] = [
  ["arrows", "move / bump attack"],
  ["home pgup end pgdn", "diagonal move"],
  [".", "stairs down"],
  [",", "stairs up"],
  ["g", "pick up item"],
  ["u", "drink potion"],
  ["i", "toggle inventory"],
  ["esc", "open/close menu"],
  ["enter", "start / title (when dead)"],
];

function cycleScaling(): void {
  scalingMode = SCALING_MODES[(SCALING_MODES.indexOf(scalingMode) + 1) % SCALING_MODES.length] ?? "fractional";
  saveSettings();
  fitCanvas();
}

function menuTree(): MenuEntry[] {
  return [
    { label: "Help", submenu: () => [{ label: "Back", action: () => menu.back() }] },
    {
      label: "Settings",
      submenu: () => [
        { label: `Scaling mode: ${scalingMode}`, action: cycleScaling },
        { label: "Back", action: () => menu.back() },
      ],
    },
    { label: "Restart", action: resetGame },
  ];
}

function monstersAct(): void {
  const dist = chaseDistances(map, player);
  for (const m of monsters()) {
    if (!m.alive) continue;
    const before = player.hp;
    monsterStep(m, { player, map, rng: AI_RNG, dist, monsters: monsters() });
    if (player.hp < before) {
      logMessage(`The ${m.name} hits you for ${before - player.hp}.`);
      spawnEffect(player.x, player.y, `-${before - player.hp}`, "#ff6a6a");
      playerFlashUntil = performance.now() + 250;
    }
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
    const dmg = attack(BATTLE_RNG, player, target);
    spawnEffect(target.x, target.y, `-${dmg}`, "#ffd97a");
    if (target.alive) {
      logMessage(`You hit the ${target.name} for ${dmg}.`);
    } else {
      dropLoot(target);
      kills++;
      const levels = gainXp(player, target.xpValue);
      logMessage(`You slay the ${target.name}.`);
      if (levels > 0) logMessage(`Level up! You are now level ${player.level}.`);
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
  kills = 0;
  floors.clear();
  monstersByFloor.clear();
  exploredByFloor.clear();
  AI_RNG = new RNG(BASE_SEED + 999);
  BATTLE_RNG = new RNG(BASE_SEED + 555);
  gameOver = false;
  inventory = makeInventory();
  messageLog.clear();
  effects.length = 0;
  playerFlashUntil = 0;
  showInventory = false;
  menuOpen = false;
  menu.reset();
  map = getFloor(1);
  player = makePlayer(map.spawn.x, map.spawn.y);
  refreshFOV();
  dirty = true;
}

window.addEventListener("keydown", (e) => {
  if (screen === "title") {
    if (e.key === "Enter") {
      e.preventDefault();
      resetGame();
      screen = "game";
    }
    return;
  }
  if (gameOver) {
    if (e.key === "Enter") {
      e.preventDefault();
      screen = "title";
      dirty = true;
    }
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    if (menuOpen && menu.depth() > 0) {
      menu.back();
    } else {
      menuOpen = !menuOpen;
      if (menuOpen) menu.open();
    }
    dirty = true;
    return;
  }
  if (menuOpen) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      menu.up();
      dirty = true;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      menu.down();
      dirty = true;
    } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
      e.preventDefault();
      if (menu.depth() > 0) {
        menu.back();
        dirty = true;
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      menu.enter();
      dirty = true;
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
        logMessage(msg);
        acted = true;
      }
    }
  } else if (e.key === "u") {
    e.preventDefault();
    const msg = usePotion(player, inventory);
    if (msg) {
      logMessage(msg);
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
    if (screen === "title") {
      drawTitle();
    } else {
      drawScene(bctx, tiles, buildScene());
      drawHUD();
      drawEffects();
      if (gameOver) drawGameOver();
      if (menuOpen) drawMenu();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = scalingMode === "smooth";
    ctx.drawImage(buffer, 0, 0, LOGICAL_W, LOGICAL_H, 0, 0, canvas.width, canvas.height);
    dirty = false;
  }

  function drawTitle(): void {
    bctx.fillStyle = "#111";
    bctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    bctx.textAlign = "center";
    bctx.fillStyle = "#e8e4da";
    bctx.font = "bold 40px monospace";
    bctx.fillText("ROGUELIKE", LOGICAL_W / 2, 220);
    bctx.font = "16px monospace";
    bctx.fillStyle = "#9a958c";
    bctx.fillText("arrows to move - bump to attack - . to descend - , to ascend", LOGICAL_W / 2, 260);
    bctx.fillStyle = "#ffd97a";
    bctx.fillText("Press Enter to start", LOGICAL_W / 2, 320);
    bctx.textAlign = "left";
  }

  function drawMenu(): void {
    bctx.fillStyle = "rgba(0,0,0,0.72)";
    bctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    const entries = menu.entries();
    const showHelp = menu.depth() === 1 && menu.path[0] === 0;
    const detail: string[] = [];
    if (!showHelp) {
      if (menu.depth() === 0) {
        const sel = entries[menu.index]!;
        if (sel.label === "Help") detail.push("Enter to open help");
        else if (sel.label === "Settings") detail.push("Enter to open settings");
        else if (sel.label === "Restart") detail.push("Enter to restart the run from depth 1");
      } else {
        detail.push("Enter: cycle integer / fractional / smooth");
        detail.push("Fractional snaps to 0.25 steps (1.25, 1.5, 1.75)");
      }
    }
    const w = 560;
    const detailH = showHelp ? HELP_LINES.length * 24 : Math.max(1, detail.length) * 24;
    const h = 64 + entries.length * 24 + 16 + detailH + 30;
    const x = (LOGICAL_W - w) / 2;
    const y = (LOGICAL_H - h) / 2;
    bctx.fillStyle = "#17150f";
    bctx.fillRect(x, y, w, h);
    bctx.strokeStyle = "#5a544a";
    bctx.strokeRect(x, y, w, h);
    bctx.fillStyle = "#e8e4da";
    bctx.font = "bold 20px monospace";
    bctx.fillText(menu.depth() === 0 ? "MENU" : menu.path[0] === 0 ? "MENU > Help" : "MENU > Settings", x + 20, y + 34);
    bctx.font = "16px monospace";
    entries.forEach((it, i) => {
      bctx.fillStyle = i === menu.index ? "#ffd97a" : "#9a958c";
      const suffix = it.submenu ? "  >" : "";
      bctx.fillText(`${i === menu.index ? ">" : " "} ${it.label}${suffix}`, x + 20, y + 64 + i * 24);
    });
    const dy = y + 64 + entries.length * 24 + 8;
    bctx.strokeStyle = "#3a352d";
    bctx.beginPath();
    bctx.moveTo(x + 16, dy);
    bctx.lineTo(x + w - 16, dy);
    bctx.stroke();
    if (showHelp) {
      HELP_LINES.forEach(([k, v], i) => {
        bctx.fillStyle = "#e8e4da";
        bctx.fillText(k, x + 24, dy + 24 + i * 24);
        bctx.fillStyle = "#9a958c";
        bctx.fillText(v, x + 280, dy + 24 + i * 24);
      });
    } else {
      bctx.fillStyle = "#9a958c";
      detail.forEach((line, i) => bctx.fillText(line, x + 24, dy + 24 + i * 24));
    }
    bctx.fillStyle = "#6a655c";
    bctx.fillText("arrows: navigate   enter: select   esc: back/close", x + 24, y + h - 12);
  }

  function drawHUD(): void {
    bctx.fillStyle = "rgba(0,0,0,0.65)";
    bctx.fillRect(0, LOGICAL_H - 24, LOGICAL_W, 24);
    const barX = 8;
    const barY = LOGICAL_H - 18;
    const barW = 120;
    const barH = 12;
    bctx.fillStyle = "#3a1a1a";
    bctx.fillRect(barX, barY, barW, barH);
    const pct = player.maxHp > 0 ? player.hp / player.maxHp : 0;
    bctx.fillStyle = pct > 0.5 ? "#4caf50" : pct > 0.25 ? "#c9a227" : "#c0392b";
    bctx.fillRect(barX, barY, Math.round(barW * pct), barH);
    bctx.strokeStyle = "#5a544a";
    bctx.strokeRect(barX + 0.5, barY + 0.5, barW, barH);
    bctx.font = "14px monospace";
    bctx.fillStyle = "#e8e4da";
    bctx.fillText(`HP ${player.hp}/${player.maxHp}`, barX + barW + 10, LOGICAL_H - 7);
    bctx.fillText(`Atk ${player.atk}  Def ${player.def}`, 250, LOGICAL_H - 7);
    bctx.fillText(`Lvl ${player.level}`, 400, LOGICAL_H - 7);
    bctx.fillText(`Gold ${inventory.gold}`, 490, LOGICAL_H - 7);
    bctx.fillText(`Depth ${depth} (${map.algorithm})`, 600, LOGICAL_H - 7);
    bctx.fillStyle = "#9a958c";
    bctx.textAlign = "right";
    bctx.fillText("esc menu", LOGICAL_W - 8, LOGICAL_H - 7);
    bctx.textAlign = "left";
    if (showInventory) {
      const inv = `Sword: ${inventory.sword ? "+1 ATK" : "-"}   Shield: ${inventory.shield ? "+1 DEF" : "-"}   Potions: ${inventory.potions}   Gold: ${inventory.gold}`;
      bctx.fillText(inv, 8, LOGICAL_H - 40);
    } else {
      const n = messageLog.length;
      for (let i = 0; i < n; i++) {
        bctx.fillStyle = i === n - 1 ? "#e8e4da" : "#9a958c";
        bctx.fillText(messageLog.at(i), 8, LOGICAL_H - 40 - (n - 1 - i) * 16);
      }
    }
  }

  function drawGameOver(): void {
    bctx.fillStyle = "rgba(0,0,0,0.72)";
    bctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    bctx.fillStyle = "#e8e4da";
    bctx.textAlign = "center";
    bctx.font = "bold 32px monospace";
    bctx.fillText("You died!", LOGICAL_W / 2, LOGICAL_H / 2 - 40);
    bctx.font = "16px monospace";
    bctx.fillStyle = "#9a958c";
    bctx.fillText(`Depth ${depth}   Level ${player.level}   Gold ${inventory.gold}   Kills ${kills}`, LOGICAL_W / 2, LOGICAL_H / 2);
    bctx.fillStyle = "#ffd97a";
    bctx.fillText("Press Enter for the title screen", LOGICAL_W / 2, LOGICAL_H / 2 + 40);
    bctx.textAlign = "left";
  }

  function drawEffects(): void {
    const now = performance.now();
    const cam = camera();
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i]!;
      const age = now - e.born;
      if (age > 800) {
        effects.splice(i, 1);
        continue;
      }
      const t = age / 800;
      bctx.globalAlpha = 1 - t;
      bctx.fillStyle = e.color;
      bctx.font = "bold 16px monospace";
      bctx.textAlign = "center";
      bctx.fillText(
        e.text,
        (e.x - cam.x) * TILE_SIZE + TILE_SIZE / 2,
        (e.y - cam.y) * TILE_SIZE + 12 - t * 20,
      );
      bctx.textAlign = "left";
      bctx.globalAlpha = 1;
    }
    if (now < playerFlashUntil) {
      bctx.strokeStyle = "rgba(255,60,60,0.8)";
      bctx.lineWidth = 4;
      bctx.strokeRect(2, 2, LOGICAL_W - 4, LOGICAL_H - 4);
      bctx.lineWidth = 1;
    }
  }

  function frame(): void {
    if (effects.length || performance.now() < playerFlashUntil) dirty = true;
    if (dirty) draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
