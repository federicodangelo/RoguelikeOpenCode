import { describe, expect, it } from "bun:test";
import { MenuNav, MessageLog, type MenuEntry } from "../../src/ui/menu.ts";
import { menuDetail } from "../../src/ui/screens.ts";
import { computeScaling } from "../../src/ui/scaling.ts";

describe("MessageLog", () => {
  it("skips empty messages", () => {
    const log = new MessageLog(4);
    log.push("");
    expect(log.length).toBe(0);
  });

  it("keeps messages oldest to newest", () => {
    const log = new MessageLog(4);
    log.push("a");
    log.push("b");
    expect(log.at(0)).toBe("a");
    expect(log.at(1)).toBe("b");
  });

  it("caps at max, dropping oldest", () => {
    const log = new MessageLog(4);
    for (const m of ["1", "2", "3", "4", "5", "6"]) log.push(m);
    expect(log.length).toBe(4);
    expect(log.at(0)).toBe("3");
    expect(log.at(3)).toBe("6");
  });

  it("clear empties the log", () => {
    const log = new MessageLog(4);
    log.push("x");
    log.clear();
    expect(log.length).toBe(0);
    expect(log.at(0)).toBe("");
  });
});

describe("computeScaling", () => {
  const W = 960;
  const H = 640;

  it("integer mode uses floor(fit*dpr) factor with css = backing/dpr", () => {
    const s = computeScaling("integer", W, H, 2.3, 1);
    expect(s.backingW).toBe(1920);
    expect(s.backingH).toBe(1280);
    expect(s.cssW).toBe(1920);
    expect(s.cssH).toBe(1280);
  });

  it("integer mode keeps backing = css*dpr at fractional dpr", () => {
    const s = computeScaling("integer", W, H, 1.25, 1.25);
    expect(s.backingW).toBe(960);
    expect(s.cssW * 1.25).toBe(960);
    expect(s.backingH).toBe(640);
    expect(s.cssH * 1.25).toBe(640);
  });

  it("integer mode factor is at least 1", () => {
    const s = computeScaling("integer", W, H, 0.5, 1);
    expect(s.backingW).toBe(960);
    expect(s.cssW).toBe(960);
  });

  it("fractional mode snaps scale down to 0.25 steps", () => {
    const s = computeScaling("fractional", W, H, 1.9, 1);
    expect(s.cssW).toBe(960 * 1.75);
    expect(s.cssH).toBe(640 * 1.75);
    expect(s.backingW).toBe(1680);
  });

  it("fractional mode snaps 1.3 down to 1.25", () => {
    const s = computeScaling("fractional", W, H, 1.3, 1);
    expect(s.cssW).toBe(1200);
    expect(s.cssH).toBe(800);
  });

  it("fractional mode minimum scale is 0.25", () => {
    const s = computeScaling("fractional", W, H, 0.1, 1);
    expect(s.cssW).toBe(240);
    expect(s.cssH).toBe(160);
  });

  it("fractional mode backing = round(css*dpr)", () => {
    const s = computeScaling("fractional", W, H, 1.25, 1.25);
    expect(s.cssW).toBe(1200);
    expect(s.backingW).toBe(1500);
    expect(s.backingH).toBe(1000);
  });

  it("smooth mode rounds css to fit and backing to css*dpr", () => {
    const s = computeScaling("smooth", W, H, 1.37, 1);
    expect(s.cssW).toBe(1315);
    expect(s.backingW).toBe(1315);
    const s2 = computeScaling("smooth", W, H, 1.37, 1.25);
    expect(s2.cssW).toBe(1315);
    expect(s2.backingW).toBe(1644);
  });
});

function testTree(): { entries: MenuEntry[]; actions: string[] } {
  const actions: string[] = [];
  const entries: MenuEntry[] = [
    { label: "Help", submenu: [{ label: "Back" }] },
    {
      label: "Settings",
      submenu: [
        { label: "Scaling", action: () => actions.push("cycle") },
        { label: "Back" },
      ],
    },
    { label: "Restart", action: () => actions.push("restart") },
  ];
  return { entries, actions };
}

describe("MenuNav", () => {
  it("lists root entries and navigates with wrap-around", () => {
    const { entries } = testTree();
    const nav = new MenuNav(() => entries);
    nav.open();
    expect(nav.entries().map((e) => e.label)).toEqual(["Help", "Settings", "Restart"]);
    expect(nav.index).toBe(0);
    nav.up();
    expect(nav.index).toBe(2);
    nav.down();
    expect(nav.index).toBe(0);
  });

  it("enter opens submenu at depth 1", () => {
    const { entries } = testTree();
    const nav = new MenuNav(() => entries);
    nav.open();
    nav.down();
    expect(nav.enter()).toBe("submenu");
    expect(nav.depth()).toBe(1);
    expect(nav.index).toBe(0);
    expect(nav.entries().map((e) => e.label)).toEqual(["Scaling", "Back"]);
  });

  it("enter on leaf runs action", () => {
    const { entries, actions } = testTree();
    const nav = new MenuNav(() => entries);
    nav.open();
    nav.index = 2;
    expect(nav.enter()).toBe("action");
    expect(actions).toEqual(["restart"]);
  });

  it("enter on entry without submenu or action does nothing", () => {
    const nav = new MenuNav(() => [{ label: "Help" }]);
    nav.open();
    expect(nav.enter()).toBe("none");
  });

  it("back restores parent selection", () => {
    const { entries } = testTree();
    const nav = new MenuNav(() => entries);
    nav.open();
    nav.index = 1;
    nav.enter();
    nav.down();
    expect(nav.index).toBe(1);
    expect(nav.back()).toBe(true);
    expect(nav.depth()).toBe(0);
    expect(nav.index).toBe(1);
  });

  it("re-entering a submenu restores its previous selection", () => {
    const { entries } = testTree();
    const nav = new MenuNav(() => entries);
    nav.open();
    nav.index = 1;
    nav.enter();
    nav.down();
    nav.back();
    nav.index = 1;
    nav.enter();
    expect(nav.depth()).toBe(1);
    expect(nav.index).toBe(1);
  });

  it("back at root returns false", () => {
    const { entries } = testTree();
    const nav = new MenuNav(() => entries);
    nav.open();
    expect(nav.back()).toBe(false);
  });

  it("open restores last root selection", () => {
    const { entries } = testTree();
    const nav = new MenuNav(() => entries);
    nav.open();
    nav.index = 2;
    nav.open();
    expect(nav.index).toBe(2);
  });

  it("reset clears all memory", () => {
    const { entries } = testTree();
    const nav = new MenuNav(() => entries);
    nav.open();
    nav.index = 2;
    nav.reset();
    expect(nav.index).toBe(0);
    expect(nav.depth()).toBe(0);
    nav.open();
    expect(nav.index).toBe(0);
  });

  it("supports submenu as a function (dynamic labels)", () => {
    let mode = "fractional";
    const nav = new MenuNav(
      () =>
        [
          {
            label: "Settings",
            submenu: () => [{ label: `Scaling mode: ${mode}` }],
          },
        ] as MenuEntry[],
    );
    nav.open();
    nav.enter();
    expect(nav.entries()[0]!.label).toBe("Scaling mode: fractional");
    mode = "smooth";
    expect(nav.entries()[0]!.label).toBe("Scaling mode: smooth");
  });
});

describe("menuDetail", () => {
  it("uses hints from the selected root entry", () => {
    const nav = new MenuNav(
      () =>
        [
          { label: "Save", hint: "auto-save", action: () => {} },
          { label: "Load", hint: ["load latest", "auto-save"], action: () => {} },
        ] as MenuEntry[],
    );
    nav.open();
    expect(menuDetail(nav, "fractional")).toEqual(["auto-save"]);
    nav.down();
    expect(menuDetail(nav, "fractional")).toEqual(["load latest", "auto-save"]);
  });

  it("uses hints from submenu entries instead of parent fallbacks", () => {
    const nav = new MenuNav(
      () =>
        [
          { label: "Help", submenu: [{ label: "Back" }] },
          { label: "Skills", submenu: [{ label: "+1 ATK", hint: "spend skill point" }] },
          { label: "Settings", submenu: [{ label: "Scaling", hint: "cycle scaling" }] },
        ] as MenuEntry[],
    );
    nav.open();
    nav.index = 1;
    nav.enter();
    expect(menuDetail(nav, "fractional")).toEqual(["spend skill point"]);
    nav.back();
    nav.index = 2;
    nav.enter();
    expect(menuDetail(nav, "fractional")).toEqual(["cycle scaling"]);
  });

  it("does not treat the first submenu as Help by index", () => {
    const nav = new MenuNav(
      () =>
        [
          { label: "Skills", submenu: [{ label: "+1 ATK", hint: "spend skill point" }] },
        ] as MenuEntry[],
    );
    nav.open();
    nav.enter();
    expect(menuDetail(nav, "fractional")).toEqual(["spend skill point"]);
  });
});
