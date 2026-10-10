import { describe, expect, it } from "bun:test";
import { RNG } from "../src/rng.ts";

describe("RNG", () => {
  it("is deterministic for the same seed", () => {
    const a = new RNG(42);
    const b = new RNG(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("produces different streams for different seeds", () => {
    const a = new RNG(1);
    const b = new RNG(2);
    const sa = Array.from({ length: 10 }, () => a.next());
    const sb = Array.from({ length: 10 }, () => b.next());
    expect(sa).not.toEqual(sb);
  });

  it("next() stays in [0, 1)", () => {
    const r = new RNG(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int() is inclusive and bounded", () => {
    const r = new RNG(9);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it("pick() returns an element of the array", () => {
    const r = new RNG(11);
    const arr = ["a", "b", "c"];
    for (let i = 0; i < 100; i++) expect(arr).toContain(r.pick(arr));
  });
});
