export const TILE = 32;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

ctx.fillStyle = "#222";
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = "#eee";
ctx.font = "16px monospace";
ctx.fillText("Roguelike scaffold OK", 16, 32);
