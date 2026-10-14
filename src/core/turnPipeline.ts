import { chaseDistances, monsterStep } from "./ai.ts";
import type { GameEvents } from "./events.ts";
import type { Entity } from "./entities.ts";
import { addStatus, tickStatuses } from "./status.ts";
import type { GameMap } from "./map.ts";
import type { RNG } from "./rng.ts";

export interface TurnContext {
  map: GameMap;
  player: Entity;
  monsters(): Entity[];
  aiRng: RNG;
  battleRng: RNG;
  lightTurns: number;
  gameOver: boolean;
  events: GameEvents;
  mapVersion: number;
  playerFlashUntil: number;
  clock(): number;
  spawnEffect(x: number, y: number, text: string, color: string): void;
  logMessage(msg: string): void;
  handleMonsterDeath(m: Entity): void;
  protectPlayer(): void;
}

export function runMonsterTurn(ctx: TurnContext): void {
  if (ctx.lightTurns > 0) ctx.lightTurns--;

  for (const m of ctx.monsters()) {
    if (!m.alive) continue;
    if (m.hp * 3 < m.maxHp && !m.panicked) {
      m.panicked = true;
      addStatus(m, "fear", 3, 1);
    }
    const tick = tickStatuses(m);
    if (tick.damage > 0) {
      ctx.spawnEffect(m.x, m.y, `-${tick.damage}`, "#9be56f");
      for (const msg of tick.messages) ctx.logMessage(msg);
      if (!m.alive) {
        ctx.logMessage(`The ${m.name} dies from status effects.`);
        ctx.handleMonsterDeath(m);
      }
    }
  }

  const dist = chaseDistances(ctx.map, ctx.player);
  for (const m of ctx.monsters()) {
    if (!m.alive) continue;
    const before = ctx.player.hp;
    monsterStep(m, {
      player: ctx.player,
      map: ctx.map,
      rng: ctx.aiRng,
      dist,
      monsters: ctx.monsters(),
    });
    ctx.protectPlayer();
    if (ctx.player.hp < before) {
      const verb = m.archetype === "ranged" ? "shoots" : "hits";
      ctx.logMessage(`The ${m.name} ${verb} you for ${before - ctx.player.hp}.`);
      ctx.spawnEffect(ctx.player.x, ctx.player.y, `-${before - ctx.player.hp}`, "#ff6a6a");
      ctx.playerFlashUntil = ctx.clock() + 250;
      ctx.events.hurt?.();

      if (m.archetype === "summoner") {
        addStatus(ctx.player, "poison", 3, 1);
        ctx.logMessage("You are poisoned.");
      } else if (m.archetype === "boss") {
        addStatus(ctx.player, "bleeding", 3, 1);
        ctx.logMessage("You are bleeding.");
      } else if (m.archetype === "tank" && ctx.battleRng.next() < 0.35) {
        addStatus(ctx.player, "stun", 1, 1);
        ctx.logMessage("You are stunned.");
      }
    }

    const monsterCell = ctx.map.cells[m.y]?.[m.x];
    if (monsterCell === "trap") {
      const dmg = ctx.battleRng.int(1, 3);
      m.hp = Math.max(0, m.hp - dmg);
      if (m.hp === 0) m.alive = false;
      ctx.map.cells[m.y]![m.x] = "floor";
      ctx.mapVersion++;
      ctx.spawnEffect(m.x, m.y, `-${dmg}`, "#ff9a4a");
      if (m.alive) {
        ctx.logMessage(`The ${m.name} triggers a trap.`);
      } else {
        ctx.logMessage(`The ${m.name} triggers a trap and dies.`);
        ctx.handleMonsterDeath(m);
      }
    }

    if (!ctx.player.alive) {
      ctx.gameOver = true;
      ctx.events.death?.();
      break;
    }
  }

  if (ctx.player.alive) {
    const playerTick = tickStatuses(ctx.player);
    ctx.protectPlayer();
    if (playerTick.damage > 0) {
      ctx.spawnEffect(ctx.player.x, ctx.player.y, `-${playerTick.damage}`, "#9be56f");
      for (const msg of playerTick.messages) ctx.logMessage(msg);
      ctx.playerFlashUntil = ctx.clock() + 250;
      ctx.events.hurt?.();
      if (!ctx.player.alive) {
        ctx.gameOver = true;
        ctx.events.death?.();
      }
    }
  }
}
