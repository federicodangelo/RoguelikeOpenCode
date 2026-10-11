export type IconName =
  | "heart"
  | "sword"
  | "shield"
  | "gold"
  | "torch"
  | "light"
  | "depth"
  | "sound"
  | "mute"
  | "skill"
  | "item"
  | "monster"
  | "door"
  | "trap"
  | "potion"
  | "stairs"
  | "stairsUp";

export function drawIcon(
  ctx: CanvasRenderingContext2D,
  name: IconName,
  x: number,
  y: number,
  color: string,
): void {
  ctx.fillStyle = color;

  switch (name) {
    case "heart":
      ctx.fillRect(x + 1, y + 1, 2, 2);
      ctx.fillRect(x + 5, y + 1, 2, 2);
      ctx.fillRect(x, y + 2, 8, 2);
      ctx.fillRect(x + 1, y + 4, 6, 1);
      ctx.fillRect(x + 2, y + 5, 4, 1);
      ctx.fillRect(x + 3, y + 6, 2, 1);
      break;
    case "sword":
      ctx.fillRect(x + 3, y, 2, 6);
      ctx.fillRect(x + 1, y + 6, 6, 1);
      ctx.fillRect(x + 3, y + 7, 2, 1);
      break;
    case "shield":
      ctx.fillRect(x + 1, y, 6, 1);
      ctx.fillRect(x, y + 1, 8, 4);
      ctx.fillRect(x + 1, y + 5, 6, 1);
      ctx.fillRect(x + 2, y + 6, 4, 1);
      ctx.fillRect(x + 3, y + 7, 2, 1);
      break;
    case "gold":
      ctx.fillRect(x + 2, y + 1, 4, 1);
      ctx.fillRect(x + 1, y + 2, 6, 4);
      ctx.fillRect(x + 2, y + 6, 4, 1);
      break;
    case "torch":
      ctx.fillRect(x + 3, y, 2, 1);
      ctx.fillRect(x + 2, y + 1, 4, 2);
      ctx.fillRect(x + 3, y + 3, 2, 1);
      ctx.fillRect(x + 3, y + 4, 2, 4);
      break;
    case "light":
      ctx.fillRect(x + 3, y + 1, 2, 1);
      ctx.fillRect(x + 2, y + 2, 4, 4);
      ctx.fillRect(x + 3, y + 6, 2, 1);
      ctx.fillRect(x, y + 3, 1, 2);
      ctx.fillRect(x + 7, y + 3, 1, 2);
      break;
    case "depth":
      ctx.fillRect(x, y + 1, 3, 1);
      ctx.fillRect(x + 2, y + 3, 3, 1);
      ctx.fillRect(x + 4, y + 5, 3, 1);
      ctx.fillRect(x + 6, y + 7, 2, 1);
      break;
    case "sound":
      ctx.fillRect(x + 1, y + 2, 2, 4);
      ctx.fillRect(x + 3, y + 1, 1, 6);
      ctx.fillRect(x + 4, y + 2, 1, 4);
      ctx.fillRect(x + 5, y + 3, 1, 2);
      break;
    case "mute":
      ctx.fillRect(x + 1, y + 2, 2, 4);
      ctx.fillRect(x + 3, y + 1, 1, 6);
      ctx.fillRect(x + 4, y + 2, 1, 4);
      ctx.fillRect(x + 5, y + 3, 1, 2);
      ctx.fillRect(x + 6, y, 1, 8);
      break;
    case "skill":
      ctx.fillRect(x + 3, y + 1, 2, 6);
      ctx.fillRect(x + 1, y + 3, 6, 2);
      break;
    case "item":
      ctx.fillRect(x + 1, y + 2, 6, 5);
      ctx.fillRect(x + 3, y, 2, 2);
      ctx.fillRect(x + 2, y + 4, 4, 1);
      break;
    case "monster":
      ctx.fillRect(x + 1, y + 2, 2, 2);
      ctx.fillRect(x + 5, y + 2, 2, 2);
      ctx.fillRect(x + 2, y + 5, 4, 1);
      break;
    case "door":
      ctx.fillRect(x + 1, y, 6, 8);
      ctx.fillStyle = "#17150f";
      ctx.fillRect(x + 2, y + 1, 4, 6);
      ctx.fillStyle = color;
      ctx.fillRect(x + 5, y + 3, 1, 2);
      break;
    case "trap":
      ctx.fillRect(x + 1, y + 1, 1, 1);
      ctx.fillRect(x + 2, y + 2, 1, 1);
      ctx.fillRect(x + 3, y + 3, 2, 2);
      ctx.fillRect(x + 5, y + 5, 1, 1);
      ctx.fillRect(x + 6, y + 6, 1, 1);
      ctx.fillRect(x + 6, y + 1, 1, 1);
      ctx.fillRect(x + 5, y + 2, 1, 1);
      ctx.fillRect(x + 2, y + 5, 1, 1);
      ctx.fillRect(x + 1, y + 6, 1, 1);
      break;
    case "potion":
      ctx.fillRect(x + 3, y, 2, 2);
      ctx.fillRect(x + 2, y + 2, 4, 1);
      ctx.fillRect(x + 1, y + 3, 6, 4);
      break;
    case "stairs":
      ctx.fillRect(x, y + 1, 3, 1);
      ctx.fillRect(x + 2, y + 3, 3, 1);
      ctx.fillRect(x + 4, y + 5, 3, 1);
      ctx.fillRect(x + 6, y + 7, 2, 1);
      break;
    case "stairsUp":
      ctx.fillRect(x + 6, y + 1, 2, 1);
      ctx.fillRect(x + 4, y + 3, 3, 1);
      ctx.fillRect(x + 2, y + 5, 3, 1);
      ctx.fillRect(x, y + 7, 3, 1);
      break;
  }
}
