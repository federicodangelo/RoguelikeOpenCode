import { TILE_SIZE } from "../core/tiles.ts";
import { LOGICAL_H, LOGICAL_W, VIEW_COLS, VIEW_ROWS } from "../core/constants.ts";
import { drawPixelText, drawPixelTextRight, pixelTextWidth } from "./pixel-font.ts";
import { drawIcon, type Iconset } from "./icons.ts";
import { minimapRect } from "./minimap.ts";
import type { Entity, Status, StatusKind } from "../core/entities.ts";
import type { Inventory } from "../core/items.ts";
import type { MessageLog } from "../core/messages.ts";

export const HUD_HEIGHT = 52;

export interface HudData {
  player: Entity;
  inventory: Inventory;
  depth: number;
  algorithm: string;
  messages: MessageLog;
  lightTurns: number;
  statuses: Status[];
  icons: Iconset;
}

export type HintIcon = "item" | "stairs" | "stairsUp" | "trap" | "door" | "potion" | "torch" | "skill";

export interface ContextualHint {
  text: string;
  icon: HintIcon;
  color?: string;
}

export function hintIconColor(icon: HintIcon): string {
  switch (icon) {
    case "item":
      return "#ffd97a";
    case "stairs":
      return "#ffd97a";
    case "stairsUp":
      return "#7ab8ff";
    case "trap":
      return "#ff6a6a";
    case "door":
      return "#c98a4a";
    case "potion":
      return "#9be56f";
    case "torch":
      return "#ff9a4a";
    case "skill":
      return "#ffd97a";
  }
}

export interface ContextualHintInput {
  hasPickableItem: boolean;
  itemName?: string | null;
  itemNameColor?: string | null;
  cell: string;
  depth: number;
  potions: number;
  torches: number;
  hp: number;
  maxHp: number;
  skillPoints: number;
  adjacentDoorClosed?: boolean;
  adjacentTrap?: boolean;
}

export function contextualHints(input: ContextualHintInput): ContextualHint[] {
  const hints: ContextualHint[] = [];

  if (input.itemName) {
    hints.push({ text: `g: pick up ${input.itemName}`, icon: "item", color: input.itemNameColor ?? undefined });
  } else if (input.hasPickableItem) {
    hints.push({ text: "g: pick up", icon: "item" });
  }
  if (input.cell === "stairs") {
    hints.push({ text: ".: descend stairs", icon: "stairs" });
  }
  if (input.cell === "stairsUp" && input.depth > 1) {
    hints.push({ text: ",: ascend stairs", icon: "stairsUp" });
  }
  if (input.adjacentDoorClosed) {
    hints.push({ text: "bump: open door", icon: "door" });
  }
  if (input.adjacentTrap) {
    hints.push({ text: "trap: danger", icon: "trap" });
  }
  if (input.potions > 0 && input.hp * 2 < input.maxHp) {
    hints.push({ text: "u: drink potion", icon: "potion" });
  }
  if (input.torches > 0) {
    hints.push({ text: "t: light torch", icon: "torch" });
  }
  if (input.skillPoints > 0) {
    hints.push({ text: `esc: skills (${input.skillPoints})`, icon: "skill" });
  }

  return hints.slice(0, 4);
}

export function statusIndicatorColor(kind: StatusKind): string {
  switch (kind) {
    case "poison":
      return "#9be56f";
    case "bleeding":
      return "#ff6a6a";
    case "haste":
      return "#7ab8ff";
    case "stun":
      return "#ffd97a";
    case "fear":
      return "#c58fff";
  }
}

export function drawHUD(bctx: CanvasRenderingContext2D, data: HudData): void {
  const panelY = LOGICAL_H - HUD_HEIGHT;
  bctx.fillStyle = "rgba(0,0,0,0.72)";
  bctx.fillRect(0, panelY, LOGICAL_W, HUD_HEIGHT);

  const row1Y = panelY + 6;
  const barX = 20;
  const barY = row1Y;
  const barW = 120;
  const barH = 12;

  drawIcon(bctx, data.icons, "heart", 8, row1Y);
  bctx.fillStyle = "#3a1a1a";
  bctx.fillRect(barX, barY, barW, barH);

  const pct = data.player.maxHp > 0 ? data.player.hp / data.player.maxHp : 0;
  bctx.fillStyle = pct > 0.5 ? "#4caf50" : pct > 0.25 ? "#c9a227" : "#c0392b";
  bctx.fillRect(barX, barY, Math.round(barW * pct), barH);
  bctx.strokeStyle = "#5a544a";
  bctx.strokeRect(barX + 0.5, barY + 0.5, barW, barH);

  const hpText = `HP ${data.player.hp}/${data.player.maxHp}`;
  const hpX = barX + barW + 8;
  drawPixelText(bctx, hpText, hpX, row1Y, "#e8e4da", 2);

  const lvlText = `Lvl ${data.player.level}`;
  const lvlX = hpX + pixelTextWidth(hpText, 2) + 12;
  drawPixelText(bctx, lvlText, lvlX, row1Y, "#e8e4da", 2);

  const swordX = lvlX + pixelTextWidth(lvlText, 2) + 12;
  const weapon = data.inventory.equipment.weapon;
  if (!weapon) {
    bctx.globalAlpha = 0.35;
    drawIcon(bctx, data.icons, "sword", swordX, row1Y);
    bctx.globalAlpha = 1;
  } else {
    drawIcon(bctx, data.icons, "sword", swordX, row1Y);
  }
  const atkText = `Atk ${data.player.atk}`;
  const atkX = swordX + 12;
  drawPixelText(bctx, atkText, atkX, row1Y, "#e8e4da", 2);

  const shieldX = atkX + pixelTextWidth(atkText, 2) + 12;
  const armor = data.inventory.equipment.armor;
  if (!armor) {
    bctx.globalAlpha = 0.35;
    drawIcon(bctx, data.icons, "shield", shieldX, row1Y);
    bctx.globalAlpha = 1;
  } else {
    drawIcon(bctx, data.icons, "shield", shieldX, row1Y);
  }
  const defText = `Def ${data.player.def}`;
  const defX = shieldX + 12;
  drawPixelText(bctx, defText, defX, row1Y, "#e8e4da", 2);

  const goldX = defX + pixelTextWidth(defText, 2) + 12;
  drawIcon(bctx, data.icons, "gold", goldX, row1Y);
  const goldText = `Gold ${data.inventory.gold}`;
  const goldTextX = goldX + 12;
  drawPixelText(bctx, goldText, goldTextX, row1Y, "#e8e4da", 2);

  if (data.player.skillPoints > 0) {
    const skillX = goldTextX + pixelTextWidth(goldText, 2) + 12;
    drawIcon(bctx, data.icons, "skill", skillX, row1Y);
    drawPixelText(bctx, `Skills ${data.player.skillPoints}`, skillX + 12, row1Y, "#ffd97a", 2);
  }

  drawPixelTextRight(bctx, "esc menu", LOGICAL_W - 8, row1Y, "#9a958c", 2);

  const row2Y = panelY + 28;
  const lightColor = data.lightTurns > 0 ? "#ffd97a" : "#5a544a";
  if (data.lightTurns > 0) {
    drawIcon(bctx, data.icons, "light", 8, row2Y);
  } else {
    bctx.globalAlpha = 0.45;
    drawIcon(bctx, data.icons, "light", 8, row2Y);
    bctx.globalAlpha = 1;
  }
  drawPixelText(bctx, data.lightTurns > 0 ? `Light ${data.lightTurns}` : "Light off", 20, row2Y, lightColor, 2);

  drawIcon(bctx, data.icons, "depth", 160, row2Y);
  drawPixelText(bctx, `Depth ${data.depth} (${data.algorithm})`, 172, row2Y, "#e8e4da", 2);

  let statusX = 360;
  for (const status of data.statuses) {
    const color = statusIndicatorColor(status.kind);
    const text = `${status.kind} ${status.turns}`;
    if (statusX > LOGICAL_W - 80) break;
    bctx.fillStyle = color;
    bctx.fillRect(statusX, row2Y, 10, 14);
    drawPixelText(bctx, text, statusX + 12, row2Y, color, 2);
    statusX += 12 + pixelTextWidth(text, 2) + 12;
  }

  const n = data.messages.length;
  for (let i = 0; i < n; i++) {
    const fallback = i === n - 1 ? "#e8e4da" : "#9a958c";
    drawPixelText(
      bctx,
      data.messages.at(i),
      8,
      panelY - 16 - (n - 1 - i) * 16,
      data.messages.colorAt(i) ?? fallback,
      2,
    );
  }
}

export function drawContextHints(
  bctx: CanvasRenderingContext2D,
  icons: Iconset,
  player: Entity,
  cam: { x: number; y: number },
  hints: ContextualHint[],
): void {
  if (hints.length === 0) return;

  const px = player.x - cam.x;
  const py = player.y - cam.y;
  if (px < 0 || px >= VIEW_COLS || py < 0 || py >= VIEW_ROWS) return;

  const rowH = 18;
  const rows = hints.map((hint) => ({
    ...hint,
    width: 8 + 6 + pixelTextWidth(hint.text, 2),
  }));
  const w = Math.max(...rows.map((row) => row.width)) + 12;
  const h = rows.length * rowH + 8;
  const centerX = px * TILE_SIZE + TILE_SIZE / 2;
  const minimap = minimapRect();
  const hudTop = LOGICAL_H - HUD_HEIGHT - 2;

  const clampX = (x: number): number => Math.max(2, Math.min(LOGICAL_W - w - 2, x));
  const clampY = (y: number): number => Math.max(2, Math.min(hudTop - h, y));
  const intersectsMinimap = (x: number, y: number): boolean =>
    x < minimap.x + minimap.w && x + w > minimap.x && y < minimap.y + minimap.h && y + h > minimap.y;

  const candidates = [
    { x: clampX(centerX - w / 2), y: clampY(py * TILE_SIZE - h - 2) },
    { x: clampX(centerX - w / 2), y: clampY(py * TILE_SIZE + TILE_SIZE + 2) },
    { x: clampX(minimap.x - w - 4), y: clampY(py * TILE_SIZE - h / 2) },
    { x: clampX(centerX - w / 2), y: clampY(minimap.y + minimap.h + 4) },
    { x: clampX(centerX - w / 2), y: clampY(hudTop - h) },
  ];

  let chosen = candidates[0]!;
  for (const candidate of candidates) {
    if (!intersectsMinimap(candidate.x, candidate.y)) {
      chosen = candidate;
      break;
    }
  }

  bctx.fillStyle = "rgba(0,0,0,0.78)";
  bctx.fillRect(chosen.x, chosen.y, w, h);
  bctx.strokeStyle = "#5a544a";
  bctx.strokeRect(chosen.x + 0.5, chosen.y + 0.5, w, h);

  rows.forEach((row, i) => {
    const rowY = chosen.y + 4 + i * rowH;
    drawIcon(bctx, icons, row.icon, chosen.x + 6, rowY);
    drawPixelText(bctx, row.text, chosen.x + 20, rowY, row.color ?? hintIconColor(row.icon), 2);
  });
}
