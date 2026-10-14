export class MessageLog {
  private lines: { text: string; color?: string }[] = [];

  constructor(private readonly max = 4) {}

  push(msg: string, color?: string): void {
    if (!msg) return;
    this.lines.push({ text: msg, color });
    if (this.lines.length > this.max) this.lines.shift();
  }

  get length(): number {
    return this.lines.length;
  }

  at(i: number): string {
    return this.lines[i]?.text ?? "";
  }

  colorAt(i: number): string | undefined {
    return this.lines[i]?.color;
  }

  clear(): void {
    this.lines.length = 0;
  }

  snapshot(): string[] {
    return this.lines.map((l) => l.text);
  }

  restore(lines: string[]): void {
    this.lines = lines.map((text) => ({ text }));
    if (this.lines.length > this.max) this.lines = this.lines.slice(-this.max);
  }
}
