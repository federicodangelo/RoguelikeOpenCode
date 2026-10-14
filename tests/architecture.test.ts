import { describe, expect, it } from "bun:test";
import { Glob } from "bun";

async function coreFiles(): Promise<string[]> {
  const files: string[] = [];
  for await (const path of new Glob("src/core/**/*.ts").scan()) {
    files.push(path);
  }
  return files.sort();
}

describe("architecture boundaries", () => {
  it("core does not import ui or platform modules", async () => {
    const offenders: string[] = [];
    for (const path of await coreFiles()) {
      const text = await Bun.file(path).text();
      if (/from\s+["']\.\.\/(ui|platform)\//.test(text)) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });

  it("core does not call performance.now", async () => {
    const offenders: string[] = [];
    for (const path of await coreFiles()) {
      const text = await Bun.file(path).text();
      if (/performance\.now\(/.test(text)) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });
});
