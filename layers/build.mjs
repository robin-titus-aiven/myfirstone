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
  .panel{position:fixed;right:20px;bottom:20px;width:260px;padding:16px 18px;background:#0B0F1A;border:1px solid #1F2430;border-radius:4px;font:12px "Geist Mono",ui-monospace,monospace;color:#9AA1AF;text-transform:uppercase;letter-spacing:.06em}
  .panel h2{margin:0 0 14px;font:inherit;color:#fff}
  .row{display:flex;justify-content:space-between;margin:12px 0 6px}
  .row b{font-weight:400;color:#5FFA74}
  input[type=range]{width:100%;margin:0;accent-color:#5FFA74;cursor:pointer}
  button{margin-top:16px;width:100%;padding:8px;background:transparent;color:#5FFA74;border:1px solid #5FFA74;border-radius:4px;font:inherit;text-transform:inherit;letter-spacing:inherit;cursor:pointer}
  button:hover{background:#5FFA74;color:#05080F}
  .switch{display:flex;justify-content:space-between;align-items:center;margin:0 0 4px;cursor:pointer}
  .switch input{position:absolute;opacity:0}
  .switch i{width:34px;height:18px;border-radius:9px;background:#1F2430;position:relative;transition:background .15s}
  .switch i::after{content:"";position:absolute;top:3px;left:3px;width:12px;height:12px;border-radius:50%;background:#9AA1AF;transition:transform .15s,background .15s}
  .switch input:checked+i{background:#5FFA74}
  .switch input:checked+i::after{transform:translateX(16px);background:#05080F}
  .switch input:focus-visible+i{outline:2px solid #5FFA74;outline-offset:2px}
  .hint{position:fixed;left:16px;bottom:12px;font:12px ui-monospace,Menlo,monospace;color:#9AA1AF}
</style></head>
<body><canvas id="c"></canvas>
<div class="panel">
  <label class="switch"><span>Data flow <small>(F)</small></span><input id="flow" type="checkbox" checked><i></i></label>
  <h2 style="margin-top:18px">Layer spacing</h2>
  <div class="row"><span>Runtime ↔ Data</span><b id="gap-top-v">3.0</b></div>
  <input id="gap-top" type="range" min="0.6" max="7" step="0.1" value="3">
  <div class="row"><span>Data ↔ Cloud</span><b id="gap-bottom-v">3.7</b></div>
  <input id="gap-bottom" type="range" min="0.6" max="8" step="0.1" value="3.7">
  <button id="reset">Reset</button></div><div class="hint">drag to rotate · double-click to reset</div>
<script type="module">${js}</script></body></html>
`);
console.log("wrote layers.html");
