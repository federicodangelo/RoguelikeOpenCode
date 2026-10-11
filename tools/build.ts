import { cpSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["src/platform/main.ts"],
  outdir: "dist",
  target: "browser",
  minify: true,
});

if (!result.success) {
  console.error(result.logs.join("\n"));
  process.exit(1);
}

cpSync("public", "dist", { recursive: true });
console.log("Built to dist/");
