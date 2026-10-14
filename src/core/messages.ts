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

  snapshot(): string[] {
    return [...this.lines];
  }

  restore(lines: string[]): void {
    this.lines = [...lines];
    if (this.lines.length > this.max) this.lines = this.lines.slice(-this.max);
  }
}
