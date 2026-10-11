import { mkdirSync, writeFileSync } from "node:fs";
import { arts, encodePNG, GRID, TILE } from "./make-tiles.ts";
import { generateMap, MAP_H, MAP_W } from "../src/core/map.ts";
import { RNG } from "../src/core/rng.ts";
import { makePlayer, spawnMonsters, type Entity } from "../src/core/entities.ts";
import { computeFOV } from "../src/core/fov.ts";
import { bfsDistances } from "../src/core/mapgen/common.ts";
import { FONT } from "../src/ui/pixel-font.ts";
import { T } from "../src/core/tiles.ts";

const VIEW_COLS = 30;
const VIEW_ROWS = 20;
const LOGICAL_W = VIEW_COLS * TILE;
const LOGICAL_H = VIEW_ROWS * TILE;
const SCALE = TILE / GRID;

type RGBA = readonly [number, number, number, number];
const C = (r: number, g: number, b: number, a = 255): RGBA => [r, g, b, a];

function setPixel(data: Buffer, x: number, y: number, c: RGBA): void {
  if (x < 0 || y < 0 || x >= LOGICAL_W || y >= LOGICAL_H) return;
  const o = (y * LOGICAL_W + x) * 4;
  if (c[3] === 255) {
    data[o] = c[0];
    data[o + 1] = c[1];
    data[o + 2] = c[2];
    data[o + 3] = 255;
    return;
  }
  const a = c[3] / 255;
  const ia = 1 - a;
  data[o] = Math.round((data[o] ?? 0) * ia + c[0] * a);
  data[o + 1] = Math.round((data[o + 1] ?? 0) * ia + c[1] * a);
  data[o + 2] = Math.round((data[o + 2] ?? 0) * ia + c[2] * a);
  data[o + 3] = 255;
}

function fillRect(data: Buffer, x: number, y: number, w: number, h: number, c: RGBA): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(data, xx, yy, c);
  }
}

function strokeRect(data: Buffer, x: number, y: number, w: number, h: number, c: RGBA): void {
  fillRect(data, x, y, w, 1, c);
  fillRect(data, x, y + h - 1, w, 1, c);
  fillRect(data, x, y, 1, h, c);
  fillRect(data, x + w - 1, y, 1, h, c);
}

function drawTile(data: Buffer, index: number, tileX: number, tileY: number): void {
  const art = arts[index];
  if (!art) return;
  for (let y = 0; y < GRID; y++) {
    const row = art.rows[y]!;
    for (let x = 0; x < GRID; x++) {
      const ch = row[x]!;
      const c = ch === " " ? undefined : art.pal[ch];
      if (!c) continue;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          setPixel(data, tileX * TILE + x * SCALE + dx, tileY * TILE + y * SCALE + dy, c);
        }
      }
    }
  }
}

function drawText(data: Buffer, text: string, x: number, y: number, color: RGBA, scale = 2): void {
  let cx = x;
  for (const raw of text) {
    const glyph = FONT[raw] ?? FONT[raw.toUpperCase()] ?? FONT["?"]!;
    for (let row = 0; row < glyph.length; row++) {
      const line = glyph[row]!;
      for (let col = 0; col < line.length; col++) {
        if (line[col] === "#") fillRect(data, cx + col * scale, y + row * scale, scale, scale, color);
      }
    }
    cx += 6 * scale;
  }
}

function textWidth(text: string, scale: number): number {
  return Math.max(0, text.length * 6 * scale - scale);
}

function drawTextCenter(data: Buffer, text: string, centerX: number, y: number, color: RGBA, scale = 2): void {
  drawText(data, text, Math.round(centerX - textWidth(text, scale) / 2), y, color, scale);
}

function drawTextRight(data: Buffer, text: string, rightX: number, y: number, color: RGBA, scale = 2): void {
  drawText(data, text, rightX - textWidth(text, scale), y, color, scale);
}

function camera(player: Entity): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(player.x - ((VIEW_COLS - 1) >> 1), MAP_W - VIEW_COLS)),
    y: Math.max(0, Math.min(player.y - ((VIEW_ROWS - 1) >> 1), MAP_H - VIEW_ROWS)),
  };
}

function renderTitle(data: Buffer): void {
  fillRect(data, 0, 0, LOGICAL_W, LOGICAL_H, C(17, 17, 17, 255));
  drawTextCenter(data, "ROGUELIKE", LOGICAL_W / 2, 170, C(232, 228, 218, 255), 6);
  drawTextCenter(data, "ARROWS MOVE - BUMP ATTACK - . DESCEND - , ASCEND", LOGICAL_W / 2, 260, C(154, 149, 140, 255), 2);
  drawTextCenter(data, "PRESS ENTER TO START", LOGICAL_W / 2, 320, C(255, 217, 122, 255), 3);

  const icons = [T.Player, T.Rat, T.Goblin, T.Skeleton, T.Potion, T.Sword, T.Shield, T.Gold];
  const startTile = Math.floor((VIEW_COLS - icons.length) / 2);
  icons.forEach((idx, i) => drawTile(data, idx, startTile + i, 12));
}

function drawHUD(
  data: Buffer,
  player: Entity,
  algorithm: string,
  monsters: Entity[],
  visible: Set<number>,
  cam: { x: number; y: number },
): void {
  fillRect(data, 0, LOGICAL_H - 24, LOGICAL_W, 24, C(0, 0, 0, 166));

  const barX = 8;
  const barY = LOGICAL_H - 18;
  const barW = 120;
  const barH = 12;
  fillRect(data, barX, barY, barW, barH, C(58, 26, 26, 255));
  const pct = player.maxHp > 0 ? player.hp / player.maxHp : 0;
  const barColor = pct > 0.5 ? C(76, 175, 80, 255) : pct > 0.25 ? C(201, 162, 39, 255) : C(192, 57, 43, 255);
  fillRect(data, barX, barY, Math.round(barW * pct), barH, barColor);
  strokeRect(data, barX, barY, barW, barH, C(90, 84, 74, 255));

  const textY = LOGICAL_H - 18;
  const text = C(232, 228, 218, 255);
  drawText(data, `HP ${player.hp}/${player.maxHp}`, barX + barW + 10, textY, text, 2);
  drawText(data, `Atk ${player.atk}  Def ${player.def}`, 250, textY, text, 2);
  drawText(data, `Lvl ${player.level}`, 400, textY, text, 2);
  drawText(data, "Gold 2", 490, textY, text, 2);
  drawText(data, `Depth 1 (${algorithm})`, 600, textY, text, 2);
  drawTextRight(data, "esc menu", LOGICAL_W - 8, textY, C(154, 149, 140, 255), 2);

  const messages = [
    "Level up! You are now level 2.",
    "You pick up some gold.",
    "The rat hits you for 1.",
    "You hit the rat for 3.",
  ];
  for (let i = 0; i < messages.length; i++) {
    const color = i === messages.length - 1 ? C(232, 228, 218, 255) : C(154, 149, 140, 255);
    drawText(data, messages[i]!, 8, LOGICAL_H - 42 - (messages.length - 1 - i) * 16, color, 2);
  }

  const target = monsters.find((m) => m.alive && visible.has(m.y * MAP_W + m.x));
  if (target) {
    const tx = (target.x - cam.x) * TILE + TILE / 2;
    const ty = (target.y - cam.y) * TILE + 2;
    drawTextCenter(data, "-3", tx, ty, C(255, 217, 122, 255), 2);
  }
}

function drawMenu(data: Buffer): void {
  fillRect(data, 0, 0, LOGICAL_W, LOGICAL_H, C(0, 0, 0, 184));
  const w = 640;
  const h = 160;
  const x = Math.round((LOGICAL_W - w) / 2);
  const y = Math.round((LOGICAL_H - h) / 2);
  fillRect(data, x, y, w, h, C(23, 21, 15, 255));
  strokeRect(data, x, y, w, h, C(90, 84, 74, 255));

  drawText(data, "MENU", x + 20, y + 20, C(232, 228, 218, 255), 3);
  const entries = ["> Help  >", "  Settings  >", "  Restart"];
  entries.forEach((label, i) => {
    const color = i === 0 ? C(255, 217, 122, 255) : C(154, 149, 140, 255);
    drawText(data, label, x + 20, y + 60 + i * 24, color, 2);
  });

}

function renderGameplay(data: Buffer, showMenu: boolean): void {
  const map = generateMap(new RNG(1337 + 7919), 1);
  const monsters = spawnMonsters(map, new RNG(1337 + 7919 + 17), 1);
  const player = makePlayer(map.spawn.x, map.spawn.y);
  player.maxHp = 14;
  player.hp = 9;
  player.level = 2;
  player.atk = 4;
  player.def = 2;

  const dist = bfsDistances(map.cells, map.spawn);
  const visible = computeFOV(map, player.x, player.y);
  const explored = new Set<number>();
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] !== -1) explored.add(i);
  }
  for (const k of visible) explored.add(k);

  const knownFloors = [...explored];
  for (const k of knownFloors) {
    const x = k % MAP_W;
    const y = Math.floor(k / MAP_W);
    if (map.cells[y]?.[x] !== "floor") continue;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as [number, number][]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const nk = ny * MAP_W + nx;
      if (map.cells[ny]![nx] !== "floor") explored.add(nk);
    }
  }

  const cam = camera(player);

  for (let vy = 0; vy < VIEW_ROWS; vy++) {
    for (let vx = 0; vx < VIEW_COLS; vx++) {
      const mx = cam.x + vx;
      const my = cam.y + vy;
      const key = my * MAP_W + mx;
      if (!explored.has(key)) {
        drawTile(data, T.Black, vx, vy);
        continue;
      }

      drawTile(data, T.Floor, vx, vy);
      const cell = map.cells[my]![mx]!;
      if (cell === "wall") drawTile(data, T.Wall, vx, vy);
      else if (cell === "stairs") drawTile(data, T.Stairs, vx, vy);
      else if (cell === "stairsUp") drawTile(data, T.StairsUp, vx, vy);
      else if (cell === "doorClosed") drawTile(data, T.DoorClosed, vx, vy);
      else if (cell === "doorOpen") drawTile(data, T.DoorOpen, vx, vy);
      else if (cell === "trap") drawTile(data, T.Trap, vx, vy);

      const item = map.items.find((i) => i.x === mx && i.y === my);
      if (item) drawTile(data, item.tile, vx, vy);

      if (visible.has(key)) {
        const monster = monsters.find((m) => m.alive && m.x === mx && m.y === my);
        if (monster) drawTile(data, monster.sprite, vx, vy);
      } else {
        fillRect(data, vx * TILE, vy * TILE, TILE, TILE, C(0, 0, 0, 140));
      }
    }
  }

  const px = player.x - cam.x;
  const py = player.y - cam.y;
  if (px >= 0 && px < VIEW_COLS && py >= 0 && py < VIEW_ROWS) {
    drawTile(data, T.Player, px, py);
  }

  drawHUD(data, player, map.algorithm, monsters, visible, cam);
  if (showMenu) drawMenu(data);
}

function saveScreenshot(name: string, data: Buffer): void {
  writeFileSync(`public/screenshots/${name}.png`, encodePNG(LOGICAL_W, LOGICAL_H, data));
}

if (import.meta.main) {
  mkdirSync("public/screenshots", { recursive: true });

  const title = Buffer.alloc(LOGICAL_W * LOGICAL_H * 4);
  renderTitle(title);
  saveScreenshot("title", title);

  const gameplay = Buffer.alloc(LOGICAL_W * LOGICAL_H * 4);
  renderGameplay(gameplay, false);
  saveScreenshot("gameplay", gameplay);

  const menu = Buffer.alloc(LOGICAL_W * LOGICAL_H * 4);
  renderGameplay(menu, true);
  saveScreenshot("menu", menu);

  console.log("Wrote public/screenshots/title.png, gameplay.png, menu.png");
}
