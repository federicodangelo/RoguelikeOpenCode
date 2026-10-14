export interface Effect {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
}

export function spawnEffect(effects: Effect[], x: number, y: number, text: string, color: string, now: number): void {
  effects.push({ x, y, text, color, born: now });
}
