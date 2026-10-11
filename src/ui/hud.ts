import { TILE_SIZE } from "../core/tiles.ts";
import { LOGICAL_H, LOGICAL_W, VIEW_COLS, VIEW_ROWS } from "../core/constants.ts";
import { drawPixelText, drawPixelTextRight, pixelTextWidth } from "./pixel-font.ts";
import { drawIcon } from "./icons.ts";
import type { Archetype, Entity, Status, StatusKind } from "../core/entities.ts";
import type { Inventory, ItemKind } from "../core/items.ts";
import type { MessageLog } from "./menu.ts";

export const HUD_HEIGHT = 52;

export interface HudData {
  player: Entity;
  inventory: Inventory;
  depth: number;
  algorithm: string;
  messages: MessageLog;
  showInventory: boolean;
  lightTurns: number;
  statuses: Status[];
  soundLabel: string;
}

export type HintIcon =
  | "item"
  | "stairs"
  | "stairsUp"
  | "trap"
  | "door"
  | "monster"
  | "potion"
  | "torch"
  | "skill";

export interface ContextualHint {
  text: string;
  icon: HintIcon;
}

export interface MonsterHint {
  name: string;
  archetype: Archetype;
  range: number;
}

export interface ContextualHintInput {
  hasPickableItem: boolean;
  itemKind?: ItemKind | null;
  cell: string;
  depth: number;
  potions: number;
  torches: number;
  hp: number;
  maxHp: number;
  skillPoints: number;
  adjacentDoorClosed?: boolean;
  adjacentTrap?: boolean;
  adjacentMonster?: MonsterHint | null;
}

export function contextualHints(input: ContextualHintInput): ContextualHint[] {
  const hints: ContextualHint[] = [];

  if (input.itemKind && input.itemKind !== "corpse") {
    hints.push({ text: `g: pick up ${input.itemKind}`, icon: "item" });
  } else if (input.hasPickableItem) {
    hints.push({ text: "g: pick up", icon: "item" });
  }
  if (input.cell === "stairs") {
    hints.push({ text: ".: descend stairs", icon: "stairs" });
  }
  if (input.cell === "stairsUp" && input.depth > 1) {
    hints.push({ text: ",: ascend stairs", icon: "stairsUp" });
  }
  if (input.adjacentMonster) {
    hints.push({ text: `bump: attack ${input.adjacentMonster.name}`, icon: "monster" });
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

  drawIcon(bctx, "heart", 8, row1Y + 2, "#ff6a6a");
  bctx.fillStyle = "#3a1a1a";
  bctx.fillRect(barX, barY, barW, barH);

  const pct = data.player.maxHp > 0 ? data.player.hp / data.player.maxHp : 0;
  bctx.fillStyle = pct > 0.5 ? "#4caf50" : pct > 0.25 ? "#c9a227" : "#c0392b";
  bctx.fillRect(barX, barY, Math.round(barW * pct), barH);
  bctx.strokeStyle = "#5a544a";
  bctx.strokeRect(barX + 0.5, barY + 0.5, barW, barH);

  drawPixelText(bctx, `HP ${data.player.hp}/${data.player.maxHp}`, barX + barW + 8, row1Y, "#e8e4da", 2);
  drawPixelText(bctx, `Lvl ${data.player.level}`, 240, row1Y, "#e8e4da", 2);

  drawIcon(bctx, "sword", 320, row1Y + 2, "#d8d8d8");
  drawPixelText(bctx, `Atk ${data.player.atk}`, 332, row1Y, "#e8e4da", 2);

  drawIcon(bctx, "shield", 440, row1Y + 2, "#7ab8ff");
  drawPixelText(bctx, `Def ${data.player.def}`, 452, row1Y, "#e8e4da", 2);

  drawIcon(bctx, "gold", 560, row1Y + 2, "#ffd97a");
  drawPixelText(bctx, `Gold ${data.inventory.gold}`, 572, row1Y, "#e8e4da", 2);

  if (data.player.skillPoints > 0) {
    drawIcon(bctx, "skill", 680, row1Y + 2, "#ffd97a");
    drawPixelText(bctx, `Skills ${data.player.skillPoints}`, 692, row1Y, "#ffd97a", 2);
  }

  drawPixelTextRight(bctx, "esc menu", LOGICAL_W - 8, row1Y, "#9a958c", 2);

  const row2Y = panelY + 28;
  const lightColor = data.lightTurns > 0 ? "#ffd97a" : "#5a544a";
  drawIcon(bctx, "light", 8, row2Y + 2, lightColor);
  drawPixelText(
    bctx,
    data.lightTurns > 0 ? `Light ${data.lightTurns}` : "Light off",
    20,
    row2Y,
    lightColor,
    2,
  );

  drawIcon(bctx, "depth", 160, row2Y + 2, "#9a958c");
  drawPixelText(bctx, `Depth ${data.depth} (${data.algorithm})`, 172, row2Y, "#e8e4da", 2);

  const muted = data.soundLabel.startsWith("Muted");
  drawIcon(bctx, muted ? "mute" : "sound", 360, row2Y + 2, muted ? "#ff6a6a" : "#9a958c");
  drawPixelText(bctx, data.soundLabel, 372, row2Y, muted ? "#ff6a6a" : "#9a958c", 2);

  let statusX = 520;
  for (const status of data.statuses) {
    const color = statusIndicatorColor(status.kind);
    const text = `${status.kind} ${status.turns}`;
    if (statusX > LOGICAL_W - 80) break;
    bctx.fillStyle = color;
    bctx.fillRect(statusX, row2Y + 2, 8, 8);
    drawPixelText(bctx, text, statusX + 12, row2Y, color, 2);
    statusX += 12 + pixelTextWidth(text, 2) + 12;
  }

  if (data.showInventory) {
    const inv = `Sword: ${data.inventory.sword ? "+1 ATK" : "-"}   Shield: ${data.inventory.shield ? "+1 DEF" : "-"}   Potions: ${data.inventory.potions}   Torches: ${data.inventory.torches}   Gold: ${data.inventory.gold}   Skill Points: ${data.player.skillPoints}`;
    drawPixelText(bctx, inv, 8, panelY - 16, "#e8e4da", 2);
  } else {
    const n = data.messages.length;
    for (let i = 0; i < n; i++) {
      drawPixelText(
        bctx,
        data.messages.at(i),
        8,
        panelY - 16 - (n - 1 - i) * 16,
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
  hints: ContextualHint[],
): void {
  if (hints.length === 0) return;

  const px = player.x - cam.x;
  const py = player.y - cam.y;
  if (px < 0 || px >= VIEW_COLS || py < 0 || py >= VIEW_ROWS) return;

  const text = hints.map((hint) => hint.text).join("  ");
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
