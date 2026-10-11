export type ScalingMode = "integer" | "fractional" | "smooth";

export const SCALING_MODES: ScalingMode[] = ["integer", "fractional", "smooth"];

export interface CanvasFit {
  cssW: number;
  cssH: number;
  backingW: number;
  backingH: number;
}

export function computeScaling(
  mode: ScalingMode,
  logicalW: number,
  logicalH: number,
  fit: number,
  dpr: number,
): CanvasFit {
  if (mode === "integer") {
    const factor = Math.max(1, Math.floor(fit * dpr));
    return {
      cssW: (logicalW * factor) / dpr,
      cssH: (logicalH * factor) / dpr,
      backingW: logicalW * factor,
      backingH: logicalH * factor,
    };
  }
  if (mode === "fractional") {
    const scale = Math.max(0.25, Math.floor(fit * 4) / 4);
    const cssW = logicalW * scale;
    const cssH = logicalH * scale;
    return {
      cssW,
      cssH,
      backingW: Math.round(cssW * dpr),
      backingH: Math.round(cssH * dpr),
    };
  }
  const cssW = Math.round(logicalW * fit);
  const cssH = Math.round(logicalH * fit);
  return {
    cssW,
    cssH,
    backingW: Math.round(cssW * dpr),
    backingH: Math.round(cssH * dpr),
  };
}

export class MessageLog {
  private lines: string[] = [];

  constructor(private readonly max = 4) {}

  push(msg: string): void {
    if (!msg) return;
    this.lines.push(msg);
    if (this.lines.length > this.max) this.lines.shift();
  }

  get length(): number {
    return this.lines.length;
  }

  at(i: number): string {
    return this.lines[i] ?? "";
  }

  clear(): void {
    this.lines.length = 0;
  }
}

export interface MenuEntry {
  label: string;
  submenu?: MenuEntry[] | (() => MenuEntry[]);
  action?: () => void;
}

export class MenuNav {
  path: number[] = [];
  index = 0;
  private memory = new Map<string, number>();

  constructor(private readonly root: () => MenuEntry[]) {}

  private key(): string {
    return this.path.join(",");
  }

  depth(): number {
    return this.path.length;
  }

  entries(): MenuEntry[] {
    let entries = this.root();
    for (const idx of this.path) {
      const entry = entries[idx];
      if (!entry?.submenu) break;
      entries = typeof entry.submenu === "function" ? entry.submenu() : entry.submenu;
    }
    return entries;
  }

  open(): void {
    if (this.path.length === 0) this.memory.set("", this.index);
    this.path = [];
    this.index = this.memory.get("") ?? 0;
  }

  up(): void {
    const n = this.entries().length;
    this.index = (this.index + n - 1) % n;
  }

  down(): void {
    const n = this.entries().length;
    this.index = (this.index + 1) % n;
  }

  enter(): "submenu" | "action" | "none" {
    const entry = this.entries()[this.index];
    if (!entry) return "none";
    if (entry.submenu) {
      this.memory.set(this.key(), this.index);
      this.path.push(this.index);
      this.index = this.memory.get(this.key()) ?? 0;
      return "submenu";
    }
    if (entry.action) {
      entry.action();
      return "action";
    }
    return "none";
  }

  back(): boolean {
    if (this.path.length === 0) return false;
    this.memory.set(this.key(), this.index);
    this.path.pop();
    this.index = this.memory.get(this.key()) ?? 0;
    return true;
  }

  reset(): void {
    this.memory.clear();
    this.path = [];
    this.index = 0;
  }
}
