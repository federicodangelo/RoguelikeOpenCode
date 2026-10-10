const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
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
    const file = Bun.file(`public${url.pathname === "/" ? "/index.html" : url.pathname}`);
    if (await file.exists()) return new Response(file);
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Dev server: http://localhost:${server.port}`);
