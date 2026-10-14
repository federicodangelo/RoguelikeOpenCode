import type { Entity, StatusKind } from "./entities.ts";

export function addStatus(entity: Entity, kind: StatusKind, turns: number, power = 1): void {
  const existing = entity.statuses.find((s) => s.kind === kind);
  if (existing) {
    existing.turns = Math.max(existing.turns, turns);
    existing.power = Math.max(existing.power, power);
    return;
  }
  entity.statuses.push({ kind, turns, power });
}

export function hasStatus(entity: Entity, kind: StatusKind): boolean {
  return entity.statuses.some((s) => s.kind === kind);
}

export function effectiveSpeed(entity: Entity): number {
  return entity.speed + (hasStatus(entity, "haste") ? 1 : 0);
}

export function tickStatuses(entity: Entity): { damage: number; messages: string[] } {
  let damage = 0;
  const messages: string[] = [];

  for (const status of entity.statuses) {
    if (status.kind === "poison" || status.kind === "bleeding") {
      const dmg = status.power;
      entity.hp = Math.max(0, entity.hp - dmg);
      damage += dmg;
      messages.push(`${entity.name} suffers ${dmg} ${status.kind} damage.`);
      if (entity.hp === 0) entity.alive = false;
    }
    status.turns--;
  }

  entity.statuses = entity.statuses.filter((s) => s.turns > 0);
  return { damage, messages };
}
