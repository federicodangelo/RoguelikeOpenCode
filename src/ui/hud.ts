import { TILE_SIZE } from "../core/tiles.ts";
import { LOGICAL_H, LOGICAL_W, VIEW_COLS, VIEW_ROWS } from "../core/constants.ts";
import { drawPixelText, drawPixelTextRight, pixelTextWidth } from "./pixel-font.ts";
import type { Entity } from "../core/entities.ts";
import type { Inventory } from "../core/items.ts";
import type { MessageLog } from "./menu.ts";

export interface HudData {
  player: Entity;
  inventory: Inventory;
  depth: number;
  algorithm: string;
  messages: MessageLog;
  showInventory: boolean;
  lightTurns: number;
  statusText: string;
}

export interface ContextualHintInput {
  hasPickableItem: boolean;
  cell: string;
  depth: number;
  potions: number;
  torches: number;
  hp: number;
  maxHp: number;
  skillPoints: number;
}

export function contextualHints(input: ContextualHintInput): string[] {
  const hints: string[] = [];

  if (input.hasPickableItem) {
    hints.push("g: pick up");
  }
  if (input.cell === "stairs") {
    hints.push(".: descend");
  }
  if (input.cell === "stairsUp" && input.depth > 1) {
    hints.push(",: ascend");
  }
  if (input.potions > 0 && input.hp * 2 < input.maxHp) {
    hints.push("u: drink");
  }
  if (input.torches > 0) {
    hints.push("t: torch");
  }
  if (input.skillPoints > 0) {
    hints.push(`esc: skills (${input.skillPoints})`);
  }

  return hints;
}

export function drawHUD(bctx: CanvasRenderingContext2D, data: HudData): void {
  bctx.fillStyle = "rgba(0,0,0,0.65)";
  bctx.fillRect(0, LOGICAL_H - 24, LOGICAL_W, 24);

  const barX = 8;
  const barY = LOGICAL_H - 18;
  const barW = 120;
  const barH = 12;
  bctx.fillStyle = "#3a1a1a";
  bctx.fillRect(barX, barY, barW, barH);

  const pct = data.player.maxHp > 0 ? data.player.hp / data.player.maxHp : 0;
  bctx.fillStyle = pct > 0.5 ? "#4caf50" : pct > 0.25 ? "#c9a227" : "#c0392b";
  bctx.fillRect(barX, barY, Math.round(barW * pct), barH);
  bctx.strokeStyle = "#5a544a";
  bctx.strokeRect(barX + 0.5, barY + 0.5, barW, barH);

  const hudY = LOGICAL_H - 18;
  drawPixelText(
    bctx,
    `HP ${data.player.hp}/${data.player.maxHp}`,
    barX + barW + 10,
    hudY,
    "#e8e4da",
    2,
  );
  drawPixelText(bctx, `Atk ${data.player.atk}  Def ${data.player.def}`, 250, hudY, "#e8e4da", 2);
  drawPixelText(bctx, `Lvl ${data.player.level}`, 400, hudY, "#e8e4da", 2);
  drawPixelText(bctx, `Gold ${data.inventory.gold}`, 490, hudY, "#e8e4da", 2);
  if (data.lightTurns > 0) {
    drawPixelText(bctx, `Light ${data.lightTurns}`, 600, hudY, "#ffd97a", 2);
    drawPixelText(bctx, `Depth ${data.depth} (${data.algorithm})`, 700, hudY, "#e8e4da", 2);
  } else {
    drawPixelText(bctx, `Depth ${data.depth} (${data.algorithm})`, 600, hudY, "#e8e4da", 2);
  }
  drawPixelTextRight(bctx, "esc menu", LOGICAL_W - 8, hudY, "#9a958c", 2);

  if (data.statusText) {
    drawPixelText(bctx, data.statusText, 8, LOGICAL_H - 60, "#9be56f", 2);
  }

  if (data.showInventory) {
    const inv = `Sword: ${data.inventory.sword ? "+1 ATK" : "-"}   Shield: ${data.inventory.shield ? "+1 DEF" : "-"}   Potions: ${data.inventory.potions}   Torches: ${data.inventory.torches}   Gold: ${data.inventory.gold}   Skill Points: ${data.player.skillPoints}`;
    drawPixelText(bctx, inv, 8, LOGICAL_H - 42, "#e8e4da", 2);
  } else {
    const n = data.messages.length;
    for (let i = 0; i < n; i++) {
      drawPixelText(
        bctx,
        data.messages.at(i),
        8,
        LOGICAL_H - 42 - (n - 1 - i) * 16,
        i === n - 1 ? "#e8e4da" : "#9a958c",
        2,
      );
    }
  }
}

export function drawContextHints(
  bctx: CanvasRenderingContext2D,
  player: Entity,
  cam: { x: number; y: number },
  hints: string[],
): void {
  if (hints.length === 0) return;

  const px = player.x - cam.x;
  const py = player.y - cam.y;
  if (px < 0 || px >= VIEW_COLS || py < 0 || py >= VIEW_ROWS) return;

  const text = hints.join("  ");
  const w = pixelTextWidth(text, 2) + 12;
  const h = 18;
  let x = px * TILE_SIZE + TILE_SIZE / 2 - w / 2;
  let y = py * TILE_SIZE - h - 2;
  if (y < 0) y = py * TILE_SIZE + TILE_SIZE + 2;
  x = Math.max(2, Math.min(LOGICAL_W - w - 2, x));
  y = Math.max(2, Math.min(LOGICAL_H - 24 - h - 2, y));

  bctx.fillStyle = "rgba(0,0,0,0.72)";
  bctx.fillRect(x, y, w, h);
  bctx.strokeStyle = "#5a544a";
  bctx.strokeRect(x + 0.5, y + 0.5, w, h);
  drawPixelText(bctx, text, x + 6, y + 4, "#ffd97a", 2);
}
