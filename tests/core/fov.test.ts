import { describe, expect, it } from "bun:test";
import { computeFOV, hasLineOfSight, FOV_RADIUS } from "../../src/core/fov.ts";
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

describe("hasLineOfSight", () => {
  it("sees along an open corridor and the shared origin always sees itself", () => {
    const map = mkMap(openInterior());
    expect(hasLineOfSight(map, 2, 2, 30, 2)).toBe(true);
    expect(hasLineOfSight(map, 5, 5, 5, 5)).toBe(true);
  });

  it("sees along an open diagonal", () => {
    const map = mkMap(openInterior());
    expect(hasLineOfSight(map, 4, 4, 14, 14)).toBe(true);
    expect(hasLineOfSight(map, 14, 4, 4, 14)).toBe(true);
  });

  it("walks the shallow diagonal steps of a steep line", () => {
    const map = mkMap(openInterior());
    expect(hasLineOfSight(map, 10, 10, 13, 19)).toBe(true);
    expect(hasLineOfSight(map, 10, 10, 19, 13)).toBe(true);
  });

  it("walls and closed doors block the ray, open doors do not", () => {
    const walled = openInterior();
    walled[10]![12] = "wall";
    expect(hasLineOfSight(mkMap(walled), 10, 10, 14, 10)).toBe(false);

    const closed = openInterior();
    closed[10]![12] = "doorClosed";
    expect(hasLineOfSight(mkMap(closed), 10, 10, 14, 10)).toBe(false);

    const open = openInterior();
    open[10]![12] = "doorOpen";
    expect(hasLineOfSight(mkMap(open), 10, 10, 14, 10)).toBe(true);
  });

  it("blocks everything behind a blocking cell", () => {
    const cells = openInterior();
    for (let y = 5; y <= 20; y++) cells[y]![12] = "wall";
    const map = mkMap(cells);
    expect(hasLineOfSight(map, 10, 8, 14, 12)).toBe(false);
  });

  it("does not see through the gap between two diagonally touching walls", () => {
    const pinched = openInterior();
    pinched[10]![12] = "wall";
    pinched[11]![11] = "wall";
    expect(hasLineOfSight(mkMap(pinched), 11, 10, 12, 11)).toBe(false);

    const single = openInterior();
    single[10]![12] = "wall";
    expect(hasLineOfSight(mkMap(single), 11, 10, 12, 11)).toBe(true);
  });
});
