const DIGITS = "0123456789".split("");
const PUNCTUATION = [" ", "!", '"', "(", ")", ",", "-", ".", "/", ":", ">", "*", "+", "?", "%"];
const UPPERCASE = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const LOWERCASE = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));

export const FONT_CELL_W = 5;
export const FONT_CELL_H = 7;
export const FONT_COLS = 10;
export const FONT_ORDER = [...DIGITS, ...PUNCTUATION, ...UPPERCASE, ...LOWERCASE];
export const FONT_ROWS = Math.ceil(FONT_ORDER.length / FONT_COLS);
export const FONT_SHEET_W = FONT_COLS * FONT_CELL_W;
export const FONT_SHEET_H = FONT_ROWS * FONT_CELL_H;

const FONT_INDEX = new Map(FONT_ORDER.map((ch, index) => [ch, index]));

export class Fontset {
  private readonly tintCache = new Map<string, CanvasImageSource>();

  private constructor(private readonly img: CanvasImageSource) {}

  static load(url: string): Promise<Fontset> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(new Fontset(img));
      img.onerror = () => reject(new Error(`Failed to load fontset: ${url}`));
      img.src = url;
    });
  }

  static fromImage(img: CanvasImageSource): Fontset {
    return new Fontset(img);
  }

  private tinted(ctx: CanvasRenderingContext2D, color: string): CanvasImageSource {
    const cached = this.tintCache.get(color);
    if (cached) return cached;

    const canvas = ctx.canvas.cloneNode(false) as HTMLCanvasElement;
    canvas.width = FONT_SHEET_W;
    canvas.height = FONT_SHEET_H;

    const tctx = canvas.getContext("2d")!;
    tctx.imageSmoothingEnabled = false;
    tctx.drawImage(this.img, 0, 0);
    tctx.globalCompositeOperation = "source-in";
    tctx.fillStyle = color;
    tctx.fillRect(0, 0, FONT_SHEET_W, FONT_SHEET_H);

    this.tintCache.set(color, canvas);
    return canvas;
  }

  drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 2): void {
    const atlas = this.tinted(ctx, color);
    let cx = x;

    for (const raw of text) {
      const ch = FONT_INDEX.has(raw) ? raw : FONT_INDEX.has(raw.toUpperCase()) ? raw.toUpperCase() : "?";
      const index = FONT_INDEX.get(ch) ?? FONT_INDEX.get("?")!;
      const sx = (index % FONT_COLS) * FONT_CELL_W;
      const sy = Math.floor(index / FONT_COLS) * FONT_CELL_H;
      ctx.drawImage(atlas, sx, sy, FONT_CELL_W, FONT_CELL_H, cx, y, FONT_CELL_W * scale, FONT_CELL_H * scale);
      cx += 6 * scale;
    }
  }
}

let activeFontset: Fontset | null = null;

export function setFontset(fontset: Fontset | null): void {
  activeFontset = fontset;
}

export function pixelTextWidth(text: string, scale: number): number {
  return Math.max(0, text.length * 6 * scale - scale);
}

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 2,
): void {
  if (!activeFontset) throw new Error("Fontset not loaded");
  activeFontset.drawText(ctx, text, x, y, color, scale);
}

export function drawPixelTextCenter(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  color: string,
  scale = 2,
): void {
  drawPixelText(ctx, text, Math.round(centerX - pixelTextWidth(text, scale) / 2), y, color, scale);
}

export function wrapPixelText(text: string, maxWidth: number, scale: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || pixelTextWidth(candidate, scale) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawPixelTextRight(
  ctx: CanvasRenderingContext2D,
  text: string,
  rightX: number,
  y: number,
  color: string,
  scale = 2,
): void {
  drawPixelText(ctx, text, rightX - pixelTextWidth(text, scale), y, color, scale);
}
