import { describe, expect, it } from "bun:test";
import { LOGICAL_H, LOGICAL_W } from "../../src/core/constants.ts";
import { Game } from "../../src/core/game.ts";
import { SAVE_KEY, saveRun } from "../../src/platform/save.ts";
import { createCanvas } from "../../tools/canvas-shim.ts";

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

function fakeCanvas(): HTMLCanvasElement {
  const { canvas } = createCanvas(LOGICAL_W, LOGICAL_H);
  return Object.assign(canvas, { style: { width: "", height: "" } }) as unknown as HTMLCanvasElement;
}

class FakeImage {
  onload?: () => void;
  onerror?: () => void;
  width = 1;
  height = 1;

  set src(_url: string) {
    this.onload?.();
  }
}

describe("main startup wiring", () => {
  it("resumes a saved run and autosaves when Enter is pressed on the title screen", async () => {
    const storage = fakeStorage();
    const seed = 12345;
    const saved = new Game(() => 0, seed);
    saved.reset(seed);
    saveRun(storage, saved);

    const listeners = new Map<string, ((event: unknown) => void)[]>();
    const canvas = fakeCanvas();
    const buffer = fakeCanvas();
    let rafCount = 0;
    let frameStarted: (() => void) | undefined;
    const framePromise = new Promise<void>((resolve) => {
      frameStarted = resolve;
    });

    const fakeWindow = {
      addEventListener(type: string, handler: (event: unknown) => void) {
        const list = listeners.get(type) ?? [];
        list.push(handler);
        listeners.set(type, list);
      },
      devicePixelRatio: 1,
      innerWidth: LOGICAL_W,
      innerHeight: LOGICAL_H,
    };

    const fakeDocument = {
      getElementById: () => canvas,
      createElement: () => buffer,
    };

    const g = globalThis as unknown as Record<string, unknown>;
    const original = {
      document: g.document,
      window: g.window,
      localStorage: g.localStorage,
      Image: g.Image,
      requestAnimationFrame: g.requestAnimationFrame,
    };

    g.document = fakeDocument;
    g.window = fakeWindow;
    g.localStorage = storage;
    g.Image = FakeImage;
    g.requestAnimationFrame = (cb: () => void) => {
      if (rafCount++ === 0) {
        cb();
        frameStarted?.();
      }
      return rafCount;
    };

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await import("../../src/platform/main.ts");
      await Promise.race([
        framePromise,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("main frame did not start")), 1000);
        }),
      ]);

      const keydown = listeners.get("keydown")?.[0];
      expect(keydown).toBeDefined();
      keydown?.({ key: "Enter", repeat: false, preventDefault() {} });

      const raw = storage.getItem(SAVE_KEY);
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!).seed).toBe(seed);
    } finally {
      if (timeout) clearTimeout(timeout);
      g.document = original.document;
      g.window = original.window;
      g.localStorage = original.localStorage;
      g.Image = original.Image;
      g.requestAnimationFrame = original.requestAnimationFrame;
    }
  });
});
