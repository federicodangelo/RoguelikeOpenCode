import { T, TILE_SIZE } from "./tiles.ts";
import { Tileset, drawScene, type CellView } from "./render.ts";
import { generateMap, MAP_H, MAP_W, type GameMap } from "./map.ts";
import { RNG } from "./rng.ts";

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

const BASE_SEED = 1337;
let depth = 1;
let map: GameMap = generateMap(new RNG(BASE_SEED), depth);
let player = { x: map.spawn.x, y: map.spawn.y };
let dirty = true;

const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  Home: [-1, -1],
  PageUp: [1, -1],
  End: [-1, 1],
  PageDown: [1, 1],
};

function tryMove(dx: number, dy: number): void {
  const nx = player.x + dx;
  const ny = player.y + dy;
  const cell = map.cells[ny]?.[nx];
  if (!cell || cell === "wall") return;
  if (cell === "doorClosed") {
    map.cells[ny]![nx] = "doorOpen";
    dirty = true;
    return;
  }
  player.x = nx;
  player.y = ny;
  dirty = true;
}

function descend(): void {
  if (map.cells[player.y]![player.x] !== "stairs") return;
  depth++;
  map = generateMap(new RNG(BASE_SEED + depth * 7919), depth);
  player = { x: map.spawn.x, y: map.spawn.y };
  dirty = true;
}

window.addEventListener("keydown", (e) => {
  const move = MOVE_KEYS[e.key];
  if (move) {
    e.preventDefault();
    tryMove(move[0], move[1]);
    return;
  }
  if (e.key === "." || e.key === "Enter") {
    e.preventDefault();
    descend();
  }
});

function camera(): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(player.x - ((VIEW_COLS - 1) >> 1), MAP_W - VIEW_COLS)),
    y: Math.max(0, Math.min(player.y - ((VIEW_ROWS - 1) >> 1), MAP_H - VIEW_ROWS)),
  };
}

function buildScene(): CellView[][] {
  const cam = camera();
  const scene: CellView[][] = [];
  for (let vy = 0; vy < VIEW_ROWS; vy++) {
    const row: CellView[] = [];
    for (let vx = 0; vx < VIEW_COLS; vx++) {
      const mx = cam.x + vx;
      const my = cam.y + vy;
      const cell = map.cells[my]![mx]!;
      const view: CellView = { floor: T.Floor };
      if (cell === "wall") view.feature = T.Wall;
      else if (cell === "stairs") view.feature = T.Stairs;
      else if (cell === "doorClosed") view.feature = T.DoorClosed;
      else if (cell === "doorOpen") view.feature = T.DoorOpen;
      const item = map.items.find((i) => i.x === mx && i.y === my);
      if (item) view.feature = item.tile;
      row.push(view);
    }
    scene.push(row);
  }
  const px = player.x - cam.x;
  const py = player.y - cam.y;
  if (px >= 0 && px < VIEW_COLS && py >= 0 && py < VIEW_ROWS) {
    scene[py]![px]!.entity = T.Player;
  }
  return scene;
}

async function main(): Promise<void> {
  const tiles = await Tileset.load("assets/tiles.png");

  function draw(): void {
    drawScene(ctx, tiles, buildScene());
    drawHUD();
    dirty = false;
  }

  function drawHUD(): void {
    const text = `Depth ${depth}   arrows move   . descend stairs`;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, canvas.height - 24, canvas.width, 24);
    ctx.fillStyle = "#e8e4da";
    ctx.font = "14px monospace";
    ctx.fillText(text, 8, canvas.height - 7);
  }

  function frame(): void {
    if (dirty) draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
