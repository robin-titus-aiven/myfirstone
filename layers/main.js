import * as THREE from "three";

await document.fonts.load('400 40px "Geist Mono"').catch(() => {});

// Aiven brand tokens (aiven-brandos / colors_and_type.css)
const C = {
  bg: 0x05080f, elev: 0x0b0f1a, card: 0x11151f, border: 0x1f2430, borderStrong: 0x2b3242,
  muted: "#9aa1af",
  green: 0x5ffa74, kafka: 0xdf56f2, pg: 0x6f64ff, opensearch: 0x59d2f4,
  clickhouse: 0xfdcd12, datahub: 0x0ab060, valkey: 0x8a8aff,
};
const hex = (n) => "#" + n.toString(16).padStart(6, "0");
const MONO = '"Geist Mono", ui-monospace, Menlo, monospace';

const LABEL = 64;         // one label size for every layer
const PITCH = 3;          // data grid pitch
const DATA_L = 9.9;       // data slab side
const TOP_L = DATA_L;   // runtime slab side, same footprint as the other layers
const TOP_Y = 3.0;        // runtime slab surface height
const DROP_Y = -3.7;      // cloud tiles height
const ELEV = 23 * Math.PI / 180;

// ---------- renderer / camera ----------
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(C.bg);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 0.22);
sun.position.set(-4, 10, 6);
scene.add(sun);

// ---------- helpers ----------
// plan-space (x, z) polygon -> shape; shape y = -z so that rotateX(-90deg) lands it on the ground plane
function roundedPoly(pts, r) {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const a = new THREE.Vector2(p0[0] - p1[0], p0[1] - p1[1]).normalize();
    const b = new THREE.Vector2(p2[0] - p1[0], p2[1] - p1[1]).normalize();
    const ang = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
    const rr = Math.min(r, 0.49 * Math.min(Math.hypot(p0[0] - p1[0], p0[1] - p1[1]), Math.hypot(p2[0] - p1[0], p2[1] - p1[1])));
    const k = rr / Math.tan(ang / 2);
    const s1 = [p1[0] + a.x * k, p1[1] + a.y * k], s2 = [p1[0] + b.x * k, p1[1] + b.y * k];
    if (i === 0) s.moveTo(s1[0], -s1[1]); else s.lineTo(s1[0], -s1[1]);
    s.quadraticCurveTo(p1[0], -p1[1], s2[0], -s2[1]);
  }
  s.closePath();
  return s;
}

function slab(pts, r, y, h, topCol, sideCol, bevel = 0.03) {
  const g = new THREE.ExtrudeGeometry(roundedPoly(pts, r), { depth: h - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y - h + bevel, 0);
  return new THREE.Mesh(g, [new THREE.MeshBasicMaterial({ color: topCol }), new THREE.MeshLambertMaterial({ color: sideCol })]);
}

// flat outline of constant on-screen weight (a ring mesh), full-strength colour
function ring(outer, inner, r, y, color) {
  const sh = roundedPoly(outer, r);
  sh.holes.push(roundedPoly(inner, Math.max(r - 0.05, 0.02)));
  const g = new THREE.ShapeGeometry(sh, 10);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.position.y = y;
  return m;
}
function flat(pts, r, y, color) {
  const g = new THREE.ShapeGeometry(roundedPoly(pts, r), 10);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  m.position.y = y;
  return m;
}
const rect = (cx, cz, w, d) => [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]];

// dark card tile with a hairline outline in `color`
function outlinedTile(parent, cx, cz, size, y, fill, line, w = 0.05) {
  parent.add(slab(rect(cx, cz, size, size), 0.12, y + 0.04, 0.04, fill, fill, 0.008));
  parent.add(ring(rect(cx, cz, size, size), rect(cx, cz, size - 2 * w, size - 2 * w), 0.12, y + 0.052, line));
}

const sprites = [];
function anchor(s, x, y, z, lift = 0.6) {
  s.userData = { p: new THREE.Vector3(x, y, z), lift };
  sprites.push(s);
  return s;
}
function spriteFrom(c, w, h) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(w, h, 1);
  return s;
}
function textSprite(lines, color, { size = 62, w = 4.4, spacing = 3 } = {}) {
  const cw = 1024, ch = 256;
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  const g = c.getContext("2d");
  g.fillStyle = color;
  g.font = `400 ${size}px ${MONO}`;
  g.letterSpacing = spacing + "px";
  g.textAlign = "center"; g.textBaseline = "middle";
  const lh = size * 1.3;
  lines.forEach((t, i) => g.fillText(t, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * lh));
  return spriteFrom(c, w, w * ch / cw);
}

// simplified brand marks in neutral grey
function logoSprite(kind) {
  const cw = 1024, ch = 256;
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  const g = c.getContext("2d");
  g.fillStyle = C.muted; g.strokeStyle = C.muted;
  g.textBaseline = "middle"; g.textAlign = "center";
  const sans = (px, wt = 500) => `${wt} ${px}px "Inter", "Helvetica Neue", Arial, sans-serif`;
  const cx = cw / 2, cy = ch / 2;
  if (kind === "aws") {
    g.font = sans(120, 600); g.fillText("aws", cx, cy - 18);
    g.lineWidth = 9; g.lineCap = "round";
    g.beginPath(); g.moveTo(cx - 95, cy + 44); g.quadraticCurveTo(cx, cy + 92, cx + 90, cy + 40); g.stroke();
    g.beginPath(); g.moveTo(cx + 90, cy + 40); g.lineTo(cx + 68, cy + 36); g.moveTo(cx + 90, cy + 40); g.lineTo(cx + 84, cy + 62); g.stroke();
  } else if (kind === "google") {
    g.font = sans(92, 400); g.fillText("Google Cloud", cx, cy);
  } else if (kind === "azure") {
    const x0 = cx - 250, y0 = cy - 62, q = 50, gap = 6;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) g.fillRect(x0 + i * (q + gap), y0 + j * (q + gap), q, q);
    g.textAlign = "left"; g.font = sans(84, 400);
    g.fillText("Microsoft", x0 + 150, cy - 34); g.fillText("Azure", x0 + 150, cy + 50);
  } else if (kind === "oracle") {
    g.font = sans(98, 500); g.fillText("ORACLE", cx, cy - 22);
    g.font = sans(62, 400); g.textAlign = "left"; g.fillText("Cloud", cx - 215, cy + 62);
  } else if (kind === "do") {
    g.lineWidth = 14; g.beginPath(); g.arc(cx - 238, cy, 38, -Math.PI * 0.2, Math.PI * 1.55); g.stroke();
    g.fillRect(cx - 276, cy + 20, 26, 26); g.fillRect(cx - 276, cy + 52, 18, 18);
    g.beginPath(); g.arc(cx - 238, cy, 18, 0, 7); g.fill();
    g.textAlign = "left"; g.font = sans(92, 500); g.fillText("DigitalOcean", cx - 170, cy);
  }
  return spriteFrom(c, 3.5, 3.5 * ch / cw);
}

// ---------- layers ----------
const world = new THREE.Group();
scene.add(world);
const cell = (i, j) => [(i - 1) * PITCH, -(j - 1) * PITCH];  // +x = down-right on screen, -z = up-right

// cloud layer: a big slab of the same thickness, carrying neutral provider tiles
const cloud = new THREE.Group();
world.add(cloud);
cloud.add(slab(rect(0, 0, DATA_L, DATA_L), 0.45, DROP_Y, 0.42, C.elev, 0x1e2536, 0.04));
cloud.add(ring(rect(0, 0, DATA_L, DATA_L), rect(0, 0, DATA_L - 0.09, DATA_L - 0.09), 0.45, DROP_Y + 0.002, C.borderStrong));
for (const [i, j, k] of [[0, 0, "aws"], [1, 0, "google"], [2, 0, "azure"], [2, 1, "oracle"], [2, 2, "do"]]) {
  const [x, z] = cell(i, j);
  outlinedTile(cloud, x, z, 2.7, DROP_Y, C.card, C.borderStrong, 0.03);
  cloud.add(anchor(logoSprite(k), x, DROP_Y + 0.06, z));
}

// data layer: each service takes its assigned product colour
const data = new THREE.Group();
world.add(data);
const Dh = DATA_L / 2;
data.add(slab(rect(0, 0, DATA_L, DATA_L), 0.45, 0, 0.42, C.elev, 0x1e2536, 0.04));
data.add(ring(rect(0, 0, DATA_L, DATA_L), rect(0, 0, DATA_L - 0.09, DATA_L - 0.09), 0.45, 0.002, C.borderStrong));
const SERVICES = [
  [0, 0, "OPENSEARCH", C.opensearch], [1, 0, "KAFKA", C.kafka], [2, 0, "PG", C.pg],
  [1, 1, "DATAHUB", C.datahub], [2, 1, "VALKEY", C.valkey], [2, 2, "CLICKHOUSE", C.clickhouse],
  [0, 1], [0, 2], [1, 2],
];
for (const [i, j, name, col] of SERVICES) {
  const [x, z] = cell(i, j);
  if (!name) { outlinedTile(data, x, z, 2.7, 0, C.elev, C.border, 0.03); continue; }
  outlinedTile(data, x, z, 2.7, 0, C.card, col);
  data.add(anchor(textSprite([name], hex(col), { size: LABEL }), x, 0.06, z));
}

// runtime layer: Aiven Green
const top = new THREE.Group();
world.add(top);
const T = TOP_L / 2, w0 = 0.09;
const LSHAPE = (t) => [[-t, -t], [t, -t], [t, 0], [0, 0], [0, t], [-t, t]];
const LINSET = (t, w) => [[-t + w, -t + w], [t - w, -t + w], [t - w, w], [w, w], [w, t - w], [-t + w, t - w]];
top.add(slab(LSHAPE(T), 0.45, TOP_Y, 0.42, C.borderStrong, 0x1e2536, 0.04));
top.add(flat(LINSET(T, w0), 0.4, TOP_Y + 0.002, C.elev));
// same edge padding and tile gap as the data layer (tile 2.7 on pitch 3)
const GAP = PITCH - 2.7, PAD = T - (PITCH + 1.35);
const ts = T - PAD - GAP / 2, q = GAP / 2 + ts / 2;
for (const [x, z, lines] of [[-q, -q, ["MCP", "SERVER"]], [-q, q, ["AIVEN", "RUNTIME"]], [q, -q, ["OBSERVABILITY"]]]) {
  outlinedTile(top, x, z, ts, TOP_Y, C.card, C.green, 0.045);
  top.add(anchor(textSprite(lines, hex(C.green), { size: LABEL }), x, TOP_Y + 0.1, z));
}

// ---------- controls: distance between layers ----------
let gapTop = TOP_Y, gapBottom = -DROP_Y;   // layer 1 -> 2, layer 2 -> 3
const sliders = [
  ["gap-top", (v) => (gapTop = v), TOP_Y],
  ["gap-bottom", (v) => (gapBottom = v), -DROP_Y],
];
for (const [id, set, def] of sliders) {
  const el = document.getElementById(id), out = document.getElementById(id + "-v");
  const apply = () => { set(+el.value); out.textContent = (+el.value).toFixed(1); resize(); };
  el.addEventListener("input", apply);
  document.getElementById("reset").addEventListener("click", () => { el.value = def; apply(); });
}

// ---------- view ----------
let az = Math.PI / 4, azTarget = az, baseAz = az, userT = 0, drag = null;
const camDist = 30;

function place() {
  const sway = userT > 0 ? 0 : Math.sin(performance.now() / 2600) * 0.07;
  const a = az + sway;
  camera.position.set(Math.sin(a) * Math.cos(ELEV) * camDist, Math.sin(ELEV) * camDist, Math.cos(a) * Math.cos(ELEV) * camDist);
  camera.lookAt(0, -0.45 + ((gapTop - TOP_Y) + (-gapBottom - DROP_Y)) / 2, 0);
}

function resize() {
  const w = innerWidth, hgt = innerHeight;
  renderer.setSize(w, hgt, false);
  const spread = Math.max(0, gapTop - TOP_Y) + Math.max(0, gapBottom + DROP_Y);
  const viewH = 15.6 + spread * 0.95, viewW = 19.0 + spread * 0.2;
  const asp = w / hgt;
  let vh = viewH, vw = viewH * asp;
  if (vw < viewW) { vw = viewW; vh = viewW / asp; }
  camera.left = -vw / 2; camera.right = vw / 2; camera.top = vh / 2; camera.bottom = -vh / 2;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, az }; userT = 1; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointermove", (e) => { if (drag) az = drag.az - (e.clientX - drag.x) * 0.006; });
canvas.addEventListener("pointerup", () => { drag = null; });
canvas.addEventListener("dblclick", () => { az = baseAz; userT = 0; });

// layers breathe apart a little
function tick(t) {
  const s = t / 1000;
  top.position.y = gapTop - TOP_Y;
  cloud.position.y = -gapBottom - DROP_Y;
  place();
  const dir = camera.position.clone().normalize();
  for (const sp of sprites) {
    sp.position.copy(sp.userData.p).addScaledVector(dir, sp.userData.lift);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
