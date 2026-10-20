// Bundles main.js (+ three) into a single self-contained layers.html.
// Usage: node build.mjs   (needs `three` and `esbuild` resolvable from NODE_PATH or ./node_modules)
import { createRequire } from "node:module";
const req = createRequire((process.env.NODE_PATH || ".").split(":")[0] + "/");
const { build } = req("esbuild");
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const out = await build({
  entryPoints: [join(HERE, "main.js")],
  bundle: true, minify: true, format: "esm", target: "es2022", write: false,
  nodePaths: (process.env.NODE_PATH || "").split(":").filter(Boolean),
});
const js = out.outputFiles[0].text.replace(/<\/script/g, "<\\/script");

const font = readFileSync(join(HERE, "GeistMono-Regular.ttf")).toString("base64");

writeFileSync(join(HERE, "layers.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aiven Layers</title>
<style>
  @font-face{font-family:"Geist Mono";font-weight:400;src:url(data:font/ttf;base64,${font}) format("truetype")}
  html,body{margin:0;height:100%;background:#05080F;overflow:hidden}
  canvas{display:block;width:100vw;height:100vh;cursor:grab;touch-action:none}
  canvas:active{cursor:grabbing}
  .hint{position:fixed;left:16px;bottom:12px;font:12px ui-monospace,Menlo,monospace;color:#9AA1AF}
</style></head>
<body><canvas id="c"></canvas><div class="hint">drag to rotate · double-click to reset</div>
<script type="module">${js}</script></body></html>
`);
console.log("wrote layers.html");
