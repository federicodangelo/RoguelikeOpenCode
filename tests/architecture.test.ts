import { describe, expect, it } from "bun:test";
import { Glob } from "bun";

async function filesIn(dir: string): Promise<string[]> {
  const files: string[] = [];
  for await (const path of new Glob(`src/${dir}/**/*.ts`).scan()) {
    files.push(path);
  }
  return files.sort();
}

async function offenders(pattern: string, dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const path of await filesIn(dir)) {
    const text = await Bun.file(path).text();
    if (new RegExp(pattern).test(text)) found.push(path);
  }
  return found;
}

describe("architecture boundaries", () => {
  it("core does not import ui or platform modules", async () => {
    expect(await offenders("from\\s+[\"']\\.\\./(ui|platform)/", "core")).toEqual([]);
  });

  it("core does not import shared modules", async () => {
    expect(await offenders("from\\s+[\"']\\.\\./shared/", "core")).toEqual([]);
  });

  it("ui does not import platform modules", async () => {
    expect(await offenders("from\\s+[\"']\\.\\./platform/", "ui")).toEqual([]);
  });

  it("shared does not import core, ui, or platform modules", async () => {
    expect(await offenders("from\\s+[\"']\\.\\./(core|ui|platform)/", "shared")).toEqual([]);
  });

  it("core does not call performance.now", async () => {
    expect(await offenders("performance\\.now\\(", "core")).toEqual([]);
  });

  it("core does not reference browser globals", async () => {
    const pattern = "\\b(document|window|localStorage|sessionStorage|AudioContext|requestAnimationFrame|Image)\\b";
    expect(await offenders(pattern, "core")).toEqual([]);
  });
});
