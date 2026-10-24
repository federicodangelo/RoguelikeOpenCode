/**
 * A log line as it is written to a save. Older saves store the bare text; a bare string reads
 * back as uncolored, so the color field stays optional instead of forcing a format change.
 */
export type SavedMessage = { text: string; color?: string };

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

  snapshot(): SavedMessage[] {
    return this.lines.map((l) => (l.color === undefined ? { text: l.text } : { text: l.text, color: l.color }));
  }

  restore(lines: (string | SavedMessage)[]): void {
    this.lines = lines.map((line) =>
      typeof line === "string" ? { text: line } : { text: line.text, color: line.color },
    );
    if (this.lines.length > this.max) this.lines = this.lines.slice(-this.max);
  }
}
