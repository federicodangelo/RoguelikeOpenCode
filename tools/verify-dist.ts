import { join } from "node:path";

const required = ["index.html", "main.js", "assets/tiles.png", "assets/icons.png"];
for (const file of required) {
  if (!(await Bun.file(join("dist", file)).exists())) {
    console.error(`Missing dist/${file}`);
    process.exit(1);
  }
}

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(join("dist", path));
    if (await file.exists()) return new Response(file);
    return new Response("Not found", { status: 404 });
  },
});

let failed = false;
try {
  for (const path of ["/", "/main.js", "/assets/tiles.png", "/assets/icons.png"]) {
    const res = await fetch(`http://127.0.0.1:${server.port}${path}`);
    if (!res.ok) {
      console.error(`Failed to serve dist${path}: ${res.status}`);
      failed = true;
      break;
    }
  }
} finally {
  server.stop();
}

if (failed) process.exit(1);
console.log("dist/ verified: index.html, main.js, assets/tiles.png, and assets/icons.png are served");
