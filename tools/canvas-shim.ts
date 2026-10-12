import { Buffer } from "node:buffer";

type RGBA = [number, number, number, number];

export class ShimCanvas {
  readonly data: Buffer;

  constructor(
    public width: number,
    public height: number,
  ) {
    this.data = Buffer.alloc(width * height * 4);
  }

  cloneNode(_deep?: boolean): ShimCanvas {
    return new ShimCanvas(this.width, this.height);
  }

  getContext(_kind: "2d"): ShimContext {
    return new ShimContext(this);
  }
}

export class ShimImage {
  constructor(
    public readonly width: number,
    public readonly height: number,
    public readonly data: Buffer,
  ) {
    if (data.length !== width * height * 4) {
      throw new Error(`ShimImage data length ${data.length}, expected ${width * height * 4}`);
    }
  }
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseColor(value: string): RGBA {
  if (value.startsWith("#")) {
    let hex = value.slice(1);
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    if (hex.length === 6) {
      return [
        clampByte(parseInt(hex.slice(0, 2), 16)),
        clampByte(parseInt(hex.slice(2, 4), 16)),
        clampByte(parseInt(hex.slice(4, 6), 16)),
        255,
      ];
    }
    if (hex.length === 8) {
      return [
        clampByte(parseInt(hex.slice(0, 2), 16)),
        clampByte(parseInt(hex.slice(2, 4), 16)),
        clampByte(parseInt(hex.slice(4, 6), 16)),
        clampByte(parseInt(hex.slice(6, 8), 16)),
      ];
    }
  }

  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (match?.[1]) {
    const parts = match[1].split(",").map((part) => parseFloat(part.trim()));
    return [
      clampByte(parts[0] ?? 0),
      clampByte(parts[1] ?? 0),
      clampByte(parts[2] ?? 0),
      parts.length >= 4 ? clampByte((parts[3] ?? 1) * 255) : 255,
    ];
  }

  return [0, 0, 0, 255];
}

function isShimSource(value: unknown): value is ShimImage | ShimCanvas {
  return value instanceof ShimImage || value instanceof ShimCanvas;
}

export class ShimContext {
  fillStyle = "#000000";
  strokeStyle = "#000000";
  globalAlpha = 1;
  globalCompositeOperation = "source-over";
  lineWidth = 1;
  imageSmoothingEnabled = false;
  private path: { x: number; y: number }[] = [];

  constructor(public readonly canvas: ShimCanvas) {}

  private put(x: number, y: number, c: RGBA): void {
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return;

    const o = (y * this.canvas.width + x) * 4;
    const destAlpha = (this.canvas.data[o + 3] ?? 0) / 255;
    let alpha = (c[3] / 255) * this.globalAlpha;

    if (this.globalCompositeOperation === "source-in") alpha *= destAlpha;
    if (alpha <= 0) return;

    if (alpha >= 1) {
      this.canvas.data[o] = c[0];
      this.canvas.data[o + 1] = c[1];
      this.canvas.data[o + 2] = c[2];
      this.canvas.data[o + 3] = 255;
      return;
    }

    const inv = 1 - alpha;
    this.canvas.data[o] = clampByte(c[0] * alpha + (this.canvas.data[o] ?? 0) * inv);
    this.canvas.data[o + 1] = clampByte(c[1] * alpha + (this.canvas.data[o + 1] ?? 0) * inv);
    this.canvas.data[o + 2] = clampByte(c[2] * alpha + (this.canvas.data[o + 2] ?? 0) * inv);
    this.canvas.data[o + 3] = clampByte(c[3] * this.globalAlpha + (this.canvas.data[o + 3] ?? 0) * inv);
  }

  private fillRectColor(x: number, y: number, w: number, h: number, c: RGBA): void {
    if (w < 0) {
      x += w;
      w = -w;
    }
    if (h < 0) {
      y += h;
      h = -h;
    }

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.round(x0 + w);
    const y1 = Math.round(y0 + h);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        this.put(xx, yy, c);
      }
    }
  }

  private drawLine(x0: number, y0: number, x1: number, y1: number, c: RGBA): void {
    const lw = Math.max(1, Math.round(this.lineWidth));
    let x = Math.round(x0);
    let y = Math.round(y0);
    const endX = Math.round(x1);
    const endY = Math.round(y1);
    const dx = Math.abs(endX - x);
    const dy = Math.abs(endY - y);
    const stepX = x < endX ? 1 : -1;
    const stepY = y < endY ? 1 : -1;
    let err = dx - dy;

    while (true) {
      this.fillRectColor(x, y, lw, lw, c);
      if (x === endX && y === endY) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += stepX;
      }
      if (e2 < dx) {
        err += dx;
        y += stepY;
      }
    }
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.fillRectColor(x, y, w, h, parseColor(this.fillStyle));
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    const saved = this.fillStyle;
    this.fillStyle = "rgba(0,0,0,0)";
    this.fillRect(x, y, w, h);
    this.fillStyle = saved;
  }

  strokeRect(x: number, y: number, w: number, h: number): void {
    const c = parseColor(this.strokeStyle);
    const lw = Math.max(1, Math.round(this.lineWidth));
    if (w < 0) {
      x += w;
      w = -w;
    }
    if (h < 0) {
      y += h;
      h = -h;
    }

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const width = Math.round(w);
    const height = Math.round(h);
    if (width <= 0 || height <= 0) return;

    this.fillRectColor(x0, y0, width, lw, c);
    this.fillRectColor(x0, y0 + height - lw, width, lw, c);
    this.fillRectColor(x0, y0, lw, height, c);
    this.fillRectColor(x0 + width - lw, y0, lw, height, c);
  }

  beginPath(): void {
    this.path = [];
  }

  moveTo(x: number, y: number): void {
    this.path = [{ x, y }];
  }

  lineTo(x: number, y: number): void {
    if (this.path.length === 0) {
      this.path = [{ x, y }];
      return;
    }
    this.path.push({ x, y });
  }

  stroke(): void {
    const c = parseColor(this.strokeStyle);
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1]!;
      const b = this.path[i]!;
      this.drawLine(a.x, a.y, b.x, b.y, c);
    }
  }

  drawImage(source: unknown, ...args: number[]): void {
    if (!isShimSource(source)) return;

    let sx = 0;
    let sy = 0;
    let sw = source.width;
    let sh = source.height;
    let dx = 0;
    let dy = 0;
    let dw = source.width;
    let dh = source.height;

    if (args.length === 2) {
      dx = args[0]!;
      dy = args[1]!;
    } else if (args.length === 4) {
      dx = args[0]!;
      dy = args[1]!;
      dw = args[2]!;
      dh = args[3]!;
    } else if (args.length === 8) {
      sx = args[0]!;
      sy = args[1]!;
      sw = args[2]!;
      sh = args[3]!;
      dx = args[4]!;
      dy = args[5]!;
      dw = args[6]!;
      dh = args[7]!;
    } else {
      return;
    }

    if (dw < 0) {
      dx += dw;
      dw = -dw;
    }
    if (dh < 0) {
      dy += dh;
      dh = -dh;
    }

    const x0 = Math.floor(dx);
    const y0 = Math.floor(dy);
    const x1 = Math.round(x0 + dw);
    const y1 = Math.round(y0 + dh);

    for (let y = y0; y < y1; y++) {
      const srcY = sy + Math.floor(((y - y0) * sh) / dh);
      for (let x = x0; x < x1; x++) {
        const srcX = sx + Math.floor(((x - x0) * sw) / dw);
        const o = (srcY * source.width + srcX) * 4;
        this.put(x, y, [
          source.data[o] ?? 0,
          source.data[o + 1] ?? 0,
          source.data[o + 2] ?? 0,
          source.data[o + 3] ?? 0,
        ]);
      }
    }
  }

  save(): void {}
  restore(): void {}
  closePath(): void {}
  fill(): void {}
  fillText(): void {}
  translate(): void {}
  scale(): void {}
  rotate(): void {}
  setTransform(): void {}
}

export function createCanvas(
  width: number,
  height: number,
): {
  canvas: ShimCanvas;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = new ShimCanvas(width, height);
  return {
    canvas,
    ctx: new ShimContext(canvas) as unknown as CanvasRenderingContext2D,
  };
}
