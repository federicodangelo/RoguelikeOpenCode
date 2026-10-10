import { T, TILE_SIZE } from "./tiles.ts";
import { Tileset } from "./render.ts";

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

const CHAR_TO_TILE: Record<string, number> = {
  "#": T.Wall,
  ".": T.Floor,
  "<": T.Stairs,
  "+": T.DoorClosed,
  "@": T.Player,
  r: T.Rat,
  g: T.Goblin,
  s: T.Skeleton,
  "!": T.Potion,
  "/": T.Sword,
  "[": T.Shield,
  "$": T.Gold,
  "%": T.Corpse,
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

let dirty = true;

async function main(): Promise<void> {
  const tiles = await Tileset.load("assets/tiles.png");

  function draw(): void {
    for (let y = 0; y < VIEW_ROWS; y++) {
      for (let x = 0; x < VIEW_COLS; x++) {
        const tile = CHAR_TO_TILE[testMap[y]![x]!];
        if (tile !== undefined) tiles.drawTile(ctx, tile, x, y);
      }
    }
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
