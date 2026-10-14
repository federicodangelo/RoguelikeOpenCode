import { T } from "../core/tiles.ts";
import { HELP_LINES, LOGICAL_H, LOGICAL_W, VIEW_COLS } from "../core/constants.ts";
import { drawPixelText, drawPixelTextCenter, drawPixelTextRight, wrapPixelText } from "./pixel-font.ts";
import type { TileDrawer } from "../shared/types.ts";
import type { MenuNav } from "./menu.ts";
import type { ScalingMode } from "./scaling.ts";

const MENU_WIDTH = 640;
const MENU_DETAIL_LINES = 3;

export interface GameOverStats {
  depth: number;
  level: number;
  gold: number;
  kills: number;
}

export function drawTitle(bctx: CanvasRenderingContext2D, tiles: TileDrawer, hasSave: boolean): void {
  bctx.fillStyle = "#111";
  bctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  drawPixelTextCenter(bctx, "ROGUELIKE", LOGICAL_W / 2, 170, "#e8e4da", 6);
  drawPixelTextCenter(bctx, "ARROWS MOVE - BUMP ATTACK - . DESCEND - , ASCEND", LOGICAL_W / 2, 260, "#9a958c", 2);
  drawPixelTextCenter(
    bctx,
    hasSave ? "PRESS ENTER TO CONTINUE" : "PRESS ENTER TO START",
    LOGICAL_W / 2,
    320,
    "#ffd97a",
    3,
  );

  const icons = [T.Player, T.Rat, T.Goblin, T.Skeleton, T.Potion, T.Sword, T.Shield, T.Gold];
  const startTile = Math.floor((VIEW_COLS - icons.length) / 2);
  icons.forEach((idx, i) => {
    tiles.drawTile(bctx, idx, startTile + i, 12);
  });
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || candidate.length <= maxChars) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawErrorScreen(ctx: CanvasRenderingContext2D, message: string): void {
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  ctx.fillStyle = "#e8e4da";
  ctx.font = "bold 32px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Failed to load game assets", LOGICAL_W / 2, LOGICAL_H / 2 - 40);

  ctx.fillStyle = "#9a958c";
  ctx.font = "16px monospace";
  wrapText(message, 60).forEach((line, i) => {
    ctx.fillText(line, LOGICAL_W / 2, LOGICAL_H / 2 + i * 22);
  });

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

export function drawGameOver(bctx: CanvasRenderingContext2D, stats: GameOverStats): void {
  bctx.fillStyle = "rgba(0,0,0,0.72)";
  bctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  drawPixelTextCenter(bctx, "You died!", LOGICAL_W / 2, LOGICAL_H / 2 - 70, "#e8e4da", 4);
  drawPixelTextCenter(
    bctx,
    `Depth ${stats.depth}   Level ${stats.level}   Gold ${stats.gold}   Kills ${stats.kills}`,
    LOGICAL_W / 2,
    LOGICAL_H / 2 - 10,
    "#9a958c",
    2,
  );
  drawPixelTextCenter(bctx, "Press Enter for the title screen", LOGICAL_W / 2, LOGICAL_H / 2 + 30, "#ffd97a", 2);
}

export function menuDetail(menu: MenuNav, scalingMode: ScalingMode): string[] {
  const labels = menu.labels();
  const showHelp = menu.depth() === 1 && labels[0] === "Help";
  if (showHelp) return [];

  const sel = menu.selectedEntry();
  if (!sel) return [];
  if (sel.hint) return Array.isArray(sel.hint) ? sel.hint : [sel.hint];

  if (menu.depth() === 0) {
    if (sel.submenu) return [`Enter to open ${sel.label}`];
    if (sel.action) return [`Enter to select ${sel.label}`];
    return [];
  }

  if (labels[0] === "Settings") {
    return [
      "Enter: cycle integer / fractional / smooth",
      "Fractional snaps to 0.25 steps (1.25, 1.5, 1.75)",
      `Current scaling: ${scalingMode}`,
    ];
  }

  if (sel.action) return [`Enter to select ${sel.label}`];
  if (sel.submenu) return [`Enter to open ${sel.label}`];
  return [];
}

export function drawMenu(bctx: CanvasRenderingContext2D, menu: MenuNav, scalingMode: ScalingMode): void {
  bctx.fillStyle = "rgba(0,0,0,0.72)";
  bctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const entries = menu.entries();
  const labels = menu.labels();
  const showHelp = menu.depth() === 1 && labels[0] === "Help";
  const detail = menuDetail(menu, scalingMode);
  const detailLines = showHelp
    ? []
    : detail.flatMap((line) => wrapPixelText(line, MENU_WIDTH - 48, 2)).slice(0, MENU_DETAIL_LINES);
  const detailH = showHelp ? HELP_LINES.length * 24 : MENU_DETAIL_LINES * 24;
  const h = 64 + entries.length * 24 + 16 + detailH + 8;
  const x = (LOGICAL_W - MENU_WIDTH) / 2;
  const y = (LOGICAL_H - h) / 2;

  bctx.fillStyle = "#17150f";
  bctx.fillRect(x, y, MENU_WIDTH, h);
  bctx.strokeStyle = "#5a544a";
  bctx.strokeRect(x, y, MENU_WIDTH, h);

  const title = menu.depth() === 0 ? "MENU" : (labels[labels.length - 1] ?? "MENU");
  drawPixelText(bctx, title, x + 20, y + 20, "#e8e4da", 3);
  if (menu.depth() > 0) {
    drawPixelTextRight(bctx, "submenu", x + MENU_WIDTH - 20, y + 20, "#9a958c", 2);
  }

  entries.forEach((it, i) => {
    const rowY = y + 60 + i * 24;
    if (i === menu.index) {
      bctx.fillStyle = "rgba(255,217,122,0.12)";
      bctx.fillRect(x + 12, rowY - 4, MENU_WIDTH - 24, 22);
      bctx.strokeStyle = "#ffd97a";
      bctx.strokeRect(x + 12.5, rowY - 3.5, MENU_WIDTH - 25, 21);
    }

    const suffix = it.submenu ? "  >" : "";
    drawPixelText(
      bctx,
      `${i === menu.index ? ">" : " "} ${it.label}${suffix}`,
      x + 20,
      rowY,
      i === menu.index ? "#ffd97a" : (it.color ?? "#e8e4da"),
      2,
    );

    if (it.slider) {
      const range = it.slider.max - it.slider.min;
      const ratio = range === 0 ? 0 : (it.slider.value - it.slider.min) / range;
      const sliderX = x + MENU_WIDTH - 220;
      const sliderW = 180;
      const sliderY = rowY + 4;
      bctx.fillStyle = "#3a352d";
      bctx.fillRect(sliderX, sliderY, sliderW, 8);
      bctx.fillStyle = i === menu.index ? "#ffd97a" : "#9a958c";
      bctx.fillRect(sliderX, sliderY, Math.round(sliderW * ratio), 8);
      bctx.strokeStyle = "#5a544a";
      bctx.strokeRect(sliderX + 0.5, sliderY + 0.5, sliderW - 1, 7);
    }
  });

  const dy = y + 64 + entries.length * 24 + 8;
  bctx.strokeStyle = "#3a352d";
  bctx.beginPath();
  bctx.moveTo(x + 16, dy);
  bctx.lineTo(x + MENU_WIDTH - 16, dy);
  bctx.stroke();

  if (showHelp) {
    HELP_LINES.forEach(([k, v], i) => {
      drawPixelText(bctx, k, x + 24, dy + 20 + i * 24, "#e8e4da", 2);
      drawPixelText(bctx, v, x + 300, dy + 20 + i * 24, "#9a958c", 2);
    });
  } else {
    detailLines.forEach((line, i) => {
      drawPixelText(bctx, line, x + 24, dy + 20 + i * 24, "#9a958c", 2);
    });
  }
}
