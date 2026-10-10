import { T, TILE_SIZE } from "./tiles.ts";
import { Tileset, drawScene, type CellView } from "./render.ts";

const VIEW_COLS = 30;
const VIEW_ROWS = 20;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
canvas.width = VIEW_COLS * TILE_SIZE;
canvas.height = VIEW_ROWS * TILE_SIZE;
ctx.imageSmoothingEnabled = false;

function fitCanvas(): void {
  const scale = Math.min(
    window.innerWidth / canvas.width,
    window.innerHeight / canvas.height,
  );
  canvas.style.width = `${Math.floor(canvas.width * scale)}px`;
  canvas.style.height = `${Math.floor(canvas.height * scale)}px`;
}
window.addEventListener("resize", fitCanvas);
fitCanvas();

const CHAR_TO_FEATURE: Record<string, number> = {
  "#": T.Wall,
  "<": T.Stairs,
  "+": T.DoorClosed,
  "!": T.Potion,
  "/": T.Sword,
  "[": T.Shield,
  "$": T.Gold,
  "%": T.Corpse,
};

const CHAR_TO_ENTITY: Record<string, number> = {
  "@": T.Player,
  r: T.Rat,
  g: T.Goblin,
  s: T.Skeleton,
};

const testMap = [
  "##############################",
  "#....#.........#.............#",
  "#....#.........#....!........#",
  "#....#....gg...#.............#",
  "#....#.........#....[........#",
  "#<...#.........#.............#",
  "#....#.........#.............#",
  "#....#.........#.............#",
  "#....+....r....+.....$.......#",
  "#....#.........#.............#",
  "#.@..#.........#.............#",
  "#....#.........#.............#",
  "#....#....s....#.............#",
  "#....#.........#.............#",
  "#....#.........#.............#",
  "#....#.........#.............#",
  "#....#.........#.............#",
  "#....#.........#.............#",
  "#....#.........#.............#",
  "##############################",
];

for (const row of testMap) {
  if (row.length !== VIEW_COLS) {
    throw new Error(`test map row has ${row.length} cols, expected ${VIEW_COLS}`);
  }
}

function buildTestScene(): CellView[][] {
  return testMap.map((row) =>
    [...row].map((ch): CellView => {
      const view: CellView = { floor: T.Floor };
      const feature = CHAR_TO_FEATURE[ch];
      if (feature !== undefined) view.feature = feature;
      const entity = CHAR_TO_ENTITY[ch];
      if (entity !== undefined) view.entity = entity;
      return view;
    }),
  );
}

let dirty = true;

async function main(): Promise<void> {
  const tiles = await Tileset.load("assets/tiles.png");

  function draw(): void {
    drawScene(ctx, tiles, buildTestScene());
    dirty = false;
  }

  function frame(): void {
    if (dirty) draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener("keydown", () => {
    dirty = true;
  });
}

main();
