import { T, TILE_SIZE } from "./tiles.ts";
import { Tileset, drawScene, type CellView } from "./render.ts";
import { generateMap, MAP_H, MAP_W, type GameMap } from "./map.ts";
import { RNG } from "./rng.ts";
import { makePlayer, spawnMonsters, type Entity } from "./entities.ts";

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
const floors = new Map<number, GameMap>();
const monstersByFloor = new Map<number, Entity[]>();

function getFloor(d: number, upAt?: { x: number; y: number }): GameMap {
  let m = floors.get(d);
  if (!m) {
    m = generateMap(new RNG(BASE_SEED + d * 7919), d, { upAt });
    floors.set(d, m);
    monstersByFloor.set(d, spawnMonsters(m, new RNG(BASE_SEED + d * 7919 + 17), d));
  }
  return m;
}

let depth = 1;
let map: GameMap = getFloor(1);
let player: Entity = makePlayer(map.spawn.x, map.spawn.y);
let dirty = true;

function monsters(): Entity[] {
  return monstersByFloor.get(depth)!;
}

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

const AI_RNG = new RNG(BASE_SEED + 999);
const DIRS4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function monsterStep(m: Entity): void {
  const dx = player.x - m.x;
  const dy = player.y - m.y;
  const dist = Math.abs(dx) + Math.abs(dy);
  const steps: [number, number][] = [];

  if (dist <= 6) {
    const ax: [number, number] = [Math.sign(dx), 0];
    const ay: [number, number] = [0, Math.sign(dy)];
    if (Math.abs(dx) >= Math.abs(dy)) steps.push(ax, ay);
    else steps.push(ay, ax);
  } else if (AI_RNG.next() < 0.5) {
    steps.push(AI_RNG.pick(DIRS4));
  }

  for (const [sx, sy] of steps) {
    if (sx === 0 && sy === 0) continue;
    const nx = m.x + sx;
    const ny = m.y + sy;
    const cell = map.cells[ny]?.[nx];
    if (!cell || cell === "wall" || cell === "doorClosed") continue;
    if (nx === player.x && ny === player.y) continue;
    if (monsters().some((o) => o !== m && o.alive && o.x === nx && o.y === ny)) continue;
    m.x = nx;
    m.y = ny;
    return;
  }
}

function monstersAct(): void {
  for (const m of monsters()) {
    if (m.alive) monsterStep(m);
  }
}

function tryMove(dx: number, dy: number): boolean {
  const nx = player.x + dx;
  const ny = player.y + dy;
  const cell = map.cells[ny]?.[nx];
  if (!cell || cell === "wall") return false;
  if (cell === "doorClosed") {
    map.cells[ny]![nx] = "doorOpen";
    return true;
  }
  if (monsters().some((m) => m.alive && m.x === nx && m.y === ny)) return false;
  player.x = nx;
  player.y = ny;
  return true;
}

function descend(): boolean {
  if (map.cells[player.y]![player.x] !== "stairs") return false;
  const from = map.stairs;
  depth++;
  map = getFloor(depth, from);
  const target = map.upStairs ?? map.spawn;
  player.x = target.x;
  player.y = target.y;
  return true;
}

function ascend(): boolean {
  if (map.cells[player.y]![player.x] !== "stairsUp" || depth <= 1) return false;
  depth--;
  map = getFloor(depth);
  player.x = map.stairs.x;
  player.y = map.stairs.y;
  return true;
}

window.addEventListener("keydown", (e) => {
  let acted = false;
  const move = MOVE_KEYS[e.key];
  if (move) {
    e.preventDefault();
    acted = tryMove(move[0], move[1]);
  } else if (e.key === "." || e.key === "Enter") {
    e.preventDefault();
    acted = descend() || true;
  } else if (e.key === ",") {
    e.preventDefault();
    acted = ascend();
  }
  if (acted) {
    monstersAct();
    dirty = true;
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
      else if (cell === "stairsUp") view.feature = T.StairsUp;
      else if (cell === "doorClosed") view.feature = T.DoorClosed;
      else if (cell === "doorOpen") view.feature = T.DoorOpen;
      const item = map.items.find((i) => i.x === mx && i.y === my);
      if (item) view.feature = item.tile;
      const monster = monsters().find((m) => m.alive && m.x === mx && m.y === my);
      if (monster) view.entity = monster.sprite;
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
    const text = `Depth ${depth} (${map.algorithm})   HP ${player.hp}/${player.maxHp}   arrows move   . stairs down   , stairs up`;
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
