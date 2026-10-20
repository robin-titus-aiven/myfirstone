import * as THREE from "three";

const GREEN = "#6dff8a";
const PITCH = 3;          // purple grid pitch
const PURPLE_L = 9.9;     // purple slab side
const TOP_L = 9.1;        // top slab side
const TOP_Y = 3.0;        // top slab surface height
const DROP_Y = -2.9;      // cloud tiles height
const ELEV = 23 * Math.PI / 180;

// ---------- renderer / camera ----------
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x050505);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

scene.add(new THREE.AmbientLight(0xffffff, 1.55));
const sun = new THREE.DirectionalLight(0xffffff, 1.3);
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

function slab(pts, r, y, h, topCol, sideCol, bevel = 0.05) {
  const shape = roundedPoly(pts, r);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y - h + bevel, 0);
  const m = new THREE.Mesh(g, [
    new THREE.MeshBasicMaterial({ color: topCol }),
    new THREE.MeshLambertMaterial({ color: sideCol }),
  ]);
  return m;
}

const rect = (cx, cz, w, d) => [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]];

function outline(pts, y, color, opacity = 1) {
  const v = pts.concat([pts[0]]).map(([x, z]) => new THREE.Vector3(x, y, z));
  const g = new THREE.BufferGeometry().setFromPoints(v);
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
}

function tile(cx, cz, size, y, color, h = 0.04, r = 0.12) {
  const m = slab(rect(cx, cz, size, size), r, y + h, h, color, color, 0.01);
  return m;
}

function textSprite(lines, { color = GREEN, size = 76, w = 4.4, weight = 700, alpha = 1 } = {}) {
  const cw = 1024, ch = 256;
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  const g = c.getContext("2d");
  g.fillStyle = color; g.globalAlpha = alpha;
  g.font = `${weight} ${size}px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`;
  g.textAlign = "center"; g.textBaseline = "middle";
  const lh = size * 1.18;
  lines.forEach((t, i) => g.fillText(t, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * lh));
  return spriteFrom(c, w, w * ch / cw);
}

const sprites = [];
function anchor(s, x, y, z, lift = 1.0) {
  s.userData = { p: new THREE.Vector3(x, y, z), lift };
  sprites.push(s);
  return s;
}

function spriteFrom(c, w, h) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(w, h, 1);
  return s;
}

// brand marks drawn on a canvas (simplified, text based)
function logoSprite(kind) {
  const cw = 1024, ch = 256;
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  const g = c.getContext("2d");
  g.fillStyle = "#d9d9d9"; g.strokeStyle = "#d9d9d9";
  g.textBaseline = "middle"; g.textAlign = "center";
  const sans = (px, wt = 500) => `${wt} ${px}px "Helvetica Neue", Arial, sans-serif`;
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
    g.fillStyle = "#bdbdbd";
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) g.fillRect(x0 + i * (q + gap), y0 + j * (q + gap), q, q);
    g.fillRect(x0 + 0, y0 + 0, 0, 0);
    g.fillStyle = "#d9d9d9"; g.textAlign = "left";
    g.font = sans(84, 400); g.fillText("Microsoft", x0 + 150, cy - 34); g.fillText("Azure", x0 + 150, cy + 50);
  } else if (kind === "oracle") {
    g.font = `500 98px "Helvetica Neue", Arial, sans-serif`;
    g.fillText("ORACLE", cx, cy - 22);
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

// cloud tiles
const cloud = new THREE.Group();
world.add(cloud);
const CLOUDS = [[0, 0, "aws"], [1, 0, "google"], [2, 0, "azure"], [2, 1, "oracle"], [2, 2, "do"]];
for (const [i, j, k] of CLOUDS) {
  const [x, z] = cell(i, j);
  const t = slab(rect(x, z, 2.7, 2.7), 0.12, DROP_Y, 0.1, 0x161616, 0x0d0d0d, 0.015);
  cloud.add(t);
  const l = logoSprite(k);
  anchor(l, x, DROP_Y + 0.1, z, 0.6);
  cloud.add(l);
}

// purple data layer
const data = new THREE.Group();
world.add(data);
const h = PURPLE_L / 2;
data.add(slab(rect(0, 0, PURPLE_L, PURPLE_L), 0.45, 0, 0.42, 0x6d63ff, 0x7e74ff, 0.06));
const SERVICES = [[0, 0, "OPENSEARCH"], [1, 0, "KAFKA"], [2, 0, "PG"], [1, 1, "DATAHUB"], [2, 1, "VALKEY"], [2, 2, "CLICKHOUSE"], [0, 1, ""], [0, 2, ""], [1, 2, ""]];
for (const [i, j, name] of SERVICES) {
  const [x, z] = cell(i, j);
  data.add(tile(x, z, 2.7, 0.0, 0x7469ff, 0.04, 0.15));
  if (name) {
    const t = textSprite([name], { color: "#a9a2ff", size: name.length > 8 ? 70 : 82, w: 4.4, alpha: 0.95 });
    anchor(t, x, 0.06, z, 0.6);
    data.add(t);
  }
}

// green runtime layer
const top = new THREE.Group();
world.add(top);
const T = TOP_L / 2;
const L = [[-T, -T], [T, -T], [T, 0], [0, 0], [0, T], [-T, T]];       // missing front (+x,+z) quadrant
top.add(slab(L, 0.2, TOP_Y, 0.78, 0x264532, 0x1a3324, 0.04));
const q = T / 2, ts = T - 0.55;
const TOPTILES = [[-q, -q, ["MCP", "SERVER"]], [-q, q, ["AIVEN", "RUNTIME"]], [q, -q, ["OBSERVABILITY"]]];
for (const [x, z, lines] of TOPTILES) {
  top.add(slab(rect(x, z, ts, ts), 0.1, TOP_Y + 0.05, 0.05, 0x2e5a3b, 0x2e5a3b, 0.01));
  top.add(outline(rect(x, z, ts, ts), TOP_Y + 0.06, 0x5dff7a));
  const t = textSprite(lines, { size: lines[0].length > 9 ? 62 : 80, w: 4.4 });
  anchor(t, x, TOP_Y + 0.1, z, 0.6);
  top.add(t);
}
top.add(outline(L.map(([x, z]) => [x * 0.985, z * 0.985]), TOP_Y + 0.0, 0x2fa04a, 0.7));

// ---------- view ----------
let az = Math.PI / 4, azTarget = az, baseAz = az, userT = 0, drag = null;
const camDist = 30;

function place() {
  const sway = userT > 0 ? 0 : Math.sin(performance.now() / 2600) * 0.07;
  const a = az + sway;
  camera.position.set(Math.sin(a) * Math.cos(ELEV) * camDist, Math.sin(ELEV) * camDist, Math.cos(a) * Math.cos(ELEV) * camDist);
  camera.lookAt(0, -0.1, 0);
}

function resize() {
  const w = innerWidth, hgt = innerHeight;
  renderer.setSize(w, hgt, false);
  const viewH = 14.2, viewW = 18.0;
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
  top.position.y = Math.sin(s * 1.1) * 0.08;
  cloud.position.y = Math.sin(s * 1.1 + 2) * 0.06;
  place();
  const dir = camera.position.clone().normalize();
  for (const sp of sprites) {
    sp.position.copy(sp.userData.p).addScaledVector(dir, sp.userData.lift);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
