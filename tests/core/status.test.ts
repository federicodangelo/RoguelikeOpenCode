import { describe, expect, it } from "bun:test";
import { makePlayer } from "../../src/core/entities.ts";
import { addStatus, effectiveSpeed, hasStatus, tickStatuses } from "../../src/core/status.ts";

describe("status effects", () => {
  it("adds and refreshes statuses", () => {
    const p = makePlayer(0, 0);
    addStatus(p, "poison", 2, 1);
    expect(hasStatus(p, "poison")).toBe(true);
    addStatus(p, "poison", 3, 2);
    expect(p.statuses[0]!.turns).toBe(3);
    expect(p.statuses[0]!.power).toBe(2);
  });

  it("ticks damage and expires statuses", () => {
    const p = makePlayer(0, 0);
    addStatus(p, "bleeding", 2, 2);
    const first = tickStatuses(p);
    expect(first.damage).toBe(2);
    expect(p.hp).toBe(10);
    expect(p.statuses[0]!.turns).toBe(1);
    const second = tickStatuses(p);
    expect(second.damage).toBe(2);
    expect(p.hp).toBe(8);
    expect(p.statuses).toHaveLength(0);
  });

  it("haste increases effective speed", () => {
    const p = makePlayer(0, 0);
    expect(effectiveSpeed(p)).toBe(1);
    addStatus(p, "haste", 2, 1);
    expect(effectiveSpeed(p)).toBe(2);
  });
});
