import { watch } from "node:fs";

const LIVE_SNIPPET = `
<script>
  const ws = new WebSocket("ws://" + location.host + "/livereload");
  ws.onmessage = () => location.reload();
  ws.onerror = () => {};
</script>
`;

let timer: ReturnType<typeof setTimeout> | null = null;
function notify(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    server.publish("reload", "reload");
    console.log("live reload");
  }, 100);
}

const server = Bun.serve({
  port: 3000,
  async fetch(req, srv) {
    const url = new URL(req.url);
    if (url.pathname === "/livereload") {
      if (srv.upgrade(req)) return;
      return new Response("upgrade failed", { status: 400 });
    }
    if (url.pathname === "/main.js") {
      const result = await Bun.build({
        entrypoints: ["src/main.ts"],
        target: "browser",
      });
      if (!result.success) {
        return new Response(result.logs.join("\n"), { status: 500 });
      }
      const out = result.outputs[0];
      if (!out) return new Response("No output", { status: 500 });
      return new Response(await out.text(), {
        headers: { "content-type": "application/javascript" },
      });
    }
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(`public${path}`);
    if (await file.exists()) {
      if (path === "/index.html") {
        const html = await file.text();
        return new Response(html.replace("</body>", `${LIVE_SNIPPET}</body>`), {
          headers: { "content-type": "text/html" },
        });
      }
      return new Response(file);
    }
    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      ws.subscribe("reload");
    },
    message() {},
    close(ws) {
      ws.unsubscribe("reload");
    },
  },
});

watch("src", { recursive: true }, (_event, filename) => {
  if (filename && /\.(ts|tsx|js|css|html)$/.test(filename)) notify();
});
watch("public", { recursive: true }, () => notify());

console.log(`Dev server: http://localhost:${server.port} (live reload)`);
