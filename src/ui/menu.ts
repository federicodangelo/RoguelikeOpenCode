export { MessageLog } from "../core/messages.ts";

export interface MenuSlider {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(value: number): void;
}

export interface MenuEntry {
  id?: string;
  label: string;
  submenu?: MenuEntry[] | (() => MenuEntry[]);
  action?: () => void;
  hint?: string | string[];
  slider?: MenuSlider;
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

  selectedEntry(): MenuEntry | undefined {
    return this.entries()[this.index];
  }

  labels(): string[] {
    const labels: string[] = [];
    let entries = this.root();
    for (const idx of this.path) {
      const entry = entries[idx];
      if (!entry) break;
      labels.push(entry.label);
      if (!entry.submenu) break;
      entries = typeof entry.submenu === "function" ? entry.submenu() : entry.submenu;
    }
    return labels;
  }

  ids(): string[] {
    const ids: string[] = [];
    let entries = this.root();
    for (const idx of this.path) {
      const entry = entries[idx];
      if (!entry) break;
      ids.push(entry.id ?? entry.label);
      if (!entry.submenu) break;
      entries = typeof entry.submenu === "function" ? entry.submenu() : entry.submenu;
    }
    return ids;
  }

  indexOfId(id: string): number {
    return this.entries().findIndex((entry) => (entry.id ?? entry.label) === id);
  }

  open(): void {
    if (this.path.length === 0) this.memory.set("", this.index);
    this.path = [];
    this.index = this.memory.get("") ?? 0;
  }

  up(): void {
    const n = this.entries().length;
    if (n === 0) {
      this.index = 0;
      return;
    }
    this.index = (this.index + n - 1) % n;
  }

  down(): void {
    const n = this.entries().length;
    if (n === 0) {
      this.index = 0;
      return;
    }
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

  adjustSlider(delta: number): boolean {
    const entry = this.entries()[this.index];
    const slider = entry?.slider;
    if (!slider) return false;
    const next = Math.max(slider.min, Math.min(slider.max, slider.value + slider.step * delta));
    if (next === slider.value) return true;
    slider.onChange(next);
    return true;
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
