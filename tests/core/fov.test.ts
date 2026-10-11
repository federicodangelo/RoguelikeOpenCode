import { describe, expect, it } from "bun:test";
import { computeFOV, FOV_RADIUS } from "../../src/core/fov.ts";
import { MAP_W } from "../../src/core/mapgen/common.ts";
import { mkMap, openInterior } from "./helpers.ts";

const k = (x: number, y: number) => y * MAP_W + x;

describe("computeFOV", () => {
  it("has radius 8", () => {
    expect(FOV_RADIUS).toBe(8);
  });

  it("always includes the origin", () => {
    const vis = computeFOV(mkMap(openInterior()), 20, 15);
    expect(vis.has(k(20, 15))).toBe(true);
  });

  it("reveals a circle of radius 8 in an open room", () => {
    const vis = computeFOV(mkMap(openInterior()), 20, 15);
    expect(vis.size).toBe(197);
    expect(vis.has(k(28, 15))).toBe(true);
    expect(vis.has(k(29, 15))).toBe(false);
  });

  it("walls hide what is behind them", () => {
    const cells = openInterior();
    for (let y = 10; y <= 20; y++) cells[y]![22] = "wall";
    const vis = computeFOV(mkMap(cells), 20, 15);
    expect(vis.has(k(21, 15))).toBe(true);
    expect(vis.has(k(24, 15))).toBe(false);
    expect(vis.has(k(25, 15))).toBe(false);
  });

  it("light leaks past the end of a wall", () => {
    const cells = openInterior();
    for (let y = 10; y <= 14; y++) cells[y]![22] = "wall";
    const vis = computeFOV(mkMap(cells), 20, 15);
    expect(vis.has(k(25, 15))).toBe(true);
  });

  it("closed doors are opaque, open doors are not", () => {
    const closed = openInterior();
    closed[15]![22] = "doorClosed";
    expect(computeFOV(mkMap(closed), 20, 15).has(k(24, 15))).toBe(false);

    const open = openInterior();
    open[15]![22] = "doorOpen";
    expect(computeFOV(mkMap(open), 20, 15).has(k(24, 15))).toBe(true);
  });

  it("respects a custom radius", () => {
    const vis = computeFOV(mkMap(openInterior()), 20, 15, 2);
    expect(vis.has(k(22, 15))).toBe(true);
    expect(vis.has(k(23, 15))).toBe(false);
  });
});
