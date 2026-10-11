import { T } from "../core/tiles.ts";
import { HELP_LINES, LOGICAL_H, LOGICAL_W, VIEW_COLS } from "../core/constants.ts";
import { drawPixelText, drawPixelTextCenter, wrapPixelText } from "./pixel-font.ts";
import type { Tileset } from "../platform/render.ts";
import type { MenuNav } from "./menu.ts";
import type { ScalingMode } from "./scaling.ts";

const MENU_WIDTH = 640;

export interface GameOverStats {
  depth: number;
  level: number;
  gold: number;
  kills: number;
}

export function drawTitle(bctx: CanvasRenderingContext2D, tiles: Tileset, hasSave: boolean): void {
  bctx.fillStyle = "#111";
  bctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  drawPixelTextCenter(bctx, "ROGUELIKE", LOGICAL_W / 2, 170, "#e8e4da", 6);
  drawPixelTextCenter(
    bctx,
    "ARROWS MOVE - BUMP ATTACK - . DESCEND - , ASCEND",
    LOGICAL_W / 2,
    260,
    "#9a958c",
    2,
  );
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
  icons.forEach((idx, i) => tiles.drawTile(bctx, idx, startTile + i, 12));
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
  drawPixelTextCenter(
    bctx,
    "Press Enter for the title screen",
    LOGICAL_W / 2,
    LOGICAL_H / 2 + 30,
    "#ffd97a",
    2,
  );
}

export function menuDetail(menu: MenuNav, scalingMode: ScalingMode): string[] {
  const entries = menu.entries();
  const labels = menu.labels();
  const showHelp = menu.depth() === 1 && labels[0] === "Help";
  if (showHelp) return [];

  const sel = entries[menu.index];
  if (sel?.hint) return Array.isArray(sel.hint) ? sel.hint : [sel.hint];

  if (menu.depth() === 0) {
    if (sel?.submenu) return [`Enter to open ${sel.label}`];
    if (sel?.label === "Restart") return ["Enter to restart the run from depth 1"];
    return [];
  }

  if (labels[0] === "Settings") {
    return [
      "Enter: cycle integer / fractional / smooth",
      "Fractional snaps to 0.25 steps (1.25, 1.5, 1.75)",
      `Current scaling: ${scalingMode}`,
    ];
  }

  return [];
}

export function drawMenu(
  bctx: CanvasRenderingContext2D,
  menu: MenuNav,
  scalingMode: ScalingMode,
): void {
  bctx.fillStyle = "rgba(0,0,0,0.72)";
  bctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const entries = menu.entries();
  const labels = menu.labels();
  const showHelp = menu.depth() === 1 && labels[0] === "Help";
  const detail = menuDetail(menu, scalingMode);
  const detailLines = showHelp ? [] : detail.flatMap((line) => wrapPixelText(line, MENU_WIDTH - 48, 2));
  const detailH = showHelp ? HELP_LINES.length * 24 : Math.max(1, detailLines.length) * 24;
  const h = 64 + entries.length * 24 + 16 + detailH + 24;
  const x = (LOGICAL_W - MENU_WIDTH) / 2;
  const y = (LOGICAL_H - h) / 2;

  bctx.fillStyle = "#17150f";
  bctx.fillRect(x, y, MENU_WIDTH, h);
  bctx.strokeStyle = "#5a544a";
  bctx.strokeRect(x, y, MENU_WIDTH, h);

  const title = menu.depth() === 0 ? "MENU" : `MENU > ${labels.join(" > ")}`;
  drawPixelText(bctx, title, x + 20, y + 20, "#e8e4da", 3);

  entries.forEach((it, i) => {
    const suffix = it.submenu ? "  >" : "";
    drawPixelText(
      bctx,
      `${i === menu.index ? ">" : " "} ${it.label}${suffix}`,
      x + 20,
      y + 60 + i * 24,
      i === menu.index ? "#ffd97a" : "#9a958c",
      2,
    );
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
    detailLines.forEach((line, i) =>
      drawPixelText(bctx, line, x + 24, dy + 20 + i * 24, "#9a958c", 2),
    );
  }
}
