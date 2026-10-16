import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "/root/.claude/skills/anatomy/kit/iso-kit.mjs";
import * as G from "/root/.claude/skills/anatomy/kit/lathe.mjs";
import { glCamera } from "/root/.claude/skills/anatomy/kit/gl.mjs";
import { kitScript, glScript } from "/root/.claude/skills/anatomy/scripts/inline-kit.mjs";
import * as R from "./rig.mjs";
import * as WD from "./world.mjs";
import { leverSvg, needleD, gaugeAngle } from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const P = WD.P;
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const depth = (p) => k.depthOf(p, P);
const part = (name, html, extra = "") => `<g data-part="${name}"${extra}>${html}</g>`;
const sorted = (items) => [...items].sort((a, b) => depth(a.c) - depth(b.c)).map((i) => i.svg).join("");
const frameY = (x, y, z) => G.frameAlong([x, y, z], [0, 1, 0]);
const frameZ = (x, y, z) => G.frameAlong([x, y, z], [0, 0, 1]);
const frameX = (x, y, z) => G.frameAlong([x, y, z], [1, 0, 0]);
const bolts = (pts, z, size = 0.5) => D(pts.map(([x, y, zz]) => at([x, y, zz ?? z])), { size });

// a pipe: a polyline in the world, drawn as a tube with an outline, an inner body and a highlight
let pipeId = 0;
function pipe(points, r, { tone = "mid", flow = null, id = null } = {}) {
  const pts = points.map((p) => at(p));
  const d = k.pathOf(pts);
  const w = 2 * r * k.cameraOf(P).k;
  const out = [`<path class="es-pipe-o" data-tone="${tone}" style="stroke-width:${(w + 1.1).toFixed(2)}" d="${d}"/>`, `<path class="es-pipe-i" style="stroke-width:${(w - 0.1).toFixed(2)}" d="${d}"/>`];
  if (flow) out.push(`<path class="es-pipe-f" data-flow="${flow}" ${id ? `data-pipe="${id}"` : ""} style="stroke-width:${Math.max(0.9, w * 0.42).toFixed(2)}" d="${d}"/>`);
  return out.join("");
}
const fitting = (x, y, z, axis, r, len, tone = "mid") => {
  const F = axis === "x" ? frameX(x, y, z) : axis === "y" ? frameY(x, y, z) : frameZ(x, y, z);
  return S(G.disc(0, len, r, F, P, { steps: 24 }), { tone, crease: "faint" });
};

// ============================ the shell ============================
const { BODY, XC, ZC, BR, BY0, BY1, GROUP, FASCIA_Z, TOP_Z } = WD;

function floor() {
  const out = [`<path class="iso-halo" d="${k.haloOf(WD.PAN, -12, 12, P)}"/>`];
  for (const [x, y] of [[-118, -156], [118, -156], [118, 136], [-118, 136]].sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]))) {
    out.push(S(k.cylinder(x, y, 13, -12, 12, P, 24, 0.5), { tone: "lo" }), S(k.cylinder(x, y, 9, -10.8, 10.8, P, 20), { tone: "mid", crease: "none" }));
  }
  out.push(S(k.slabOf(WD.PAN, 0, 12, P, 8, 1), { tone: "mid", inner: L(k.sideSeam(WD.PAN, 6, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(WD.PAN, 7), 12, P), { tone: "lo" }));
  out.push(bolts(k.corners(WD.PAN, 14), 12));
  return out.join("");
}

function wallsBack() {
  const out = [];
  out.push(S(k.slabOf({ x: -136, y: -172, w: 272, d: 5, r: 2 }, 12, TOP_Z - 12, P, 3, 0.4), { tone: "mid", crease: "faint" }));
  out.push(S(k.slabOf({ x: -136, y: -172, w: 5, d: 322, r: 2 }, 12, TOP_Z - 12, P, 3, 0.4), { tone: "mid", crease: "faint" }));
  // back panel details: an inlet, a fuse holder, a vent grille
  const inlet = { x: 62, y: -167, w: 44, d: 3, r: 2 };
  out.push(S(k.slabOf({ x: 60, y: -167, w: 48, d: 4, r: 2 }, 40, 36, P, 3), { tone: "lo", crease: "none" }));
  out.push(D([at([68, -163, 68]), at([100, -163, 68]), at([68, -163, 48]), at([100, -163, 48])], { size: 0.5 }));
  // a vent grille on the back panel: a frame, and bars that run from its top edge to its bottom edge
  const vy = -166.9;
  out.push(L(k.segment([-112, vy, 250], [-28, vy, 250], P) + k.segment([-28, vy, 250], [-28, vy, 292], P) + k.segment([-28, vy, 292], [-112, vy, 292], P) + k.segment([-112, vy, 292], [-112, vy, 250], P), { tone: "lo" }));
  out.push(L(Array.from({ length: 8 }, (_, i) => k.segment([-103 + i * 10.5, vy, 250], [-103 + i * 10.5, vy, 292], P)).join(""), { tone: "faint" }));
  return out.join("");
}

// ============================ interior ============================
function frame() {
  const out = [];
  for (const [x, y] of [[-124, -164], [124, -164], [-124, 142], [124, 142]]) out.push({ c: [x, y, 180], svg: S(k.slabOf({ x: x - 4, y: y - 4, w: 8, d: 8, r: 1 }, 12, FASCIA_Z - 12 + 130, P, 2, 0.3), { tone: "lo", crease: "none" }) });
  for (const x of [-124, 124]) out.push({ c: [x, -10, 190], svg: S(k.slabOf({ x: x - 4, y: -164, w: 8, d: 310, r: 1 }, 186, 8, P, 2, 0.3), { tone: "lo" }) });
  for (const y of [-72, 98]) out.push({ c: [0, y, 190], svg: S(k.slabOf({ x: -124, y: y - 5, w: 248, d: 10, r: 1 }, 186, 8, P, 2, 0.3), { tone: "mid" }) });
  return out;
}

function tank() {
  const box = { x: -120, y: -158, w: 70, d: 112, r: 4 };
  const top = 168;
  const out = [];
  out.push(S(k.slabOf(box, 12, top - 12, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(box, 40, P, 4), { tone: "faint" }) }));
  // level gauge: a vertical slot in the +x face, water in it, a float mark
  const gx = box.x + box.w;
  out.push(S(k.slabOf({ x: gx - 0.6, y: box.y + 10, w: 1.2, d: 10, r: 0.5 }, 30, 120, P, 2), { tone: "lo", crease: "none" }));
  out.push(`<g data-part="tank-level"><path class="es-water" d="${k.segment([gx + 0.7, box.y + 15, 32], [gx + 0.7, box.y + 15, 90], P)}"/></g>`);
  out.push(L(Array.from({ length: 13 }, (_, i) => k.segment([gx + 0.7, box.y + 21, 32 + i * 9.5], [gx + 0.7, box.y + 21 + (i % 4 === 0 ? 5 : 3), 32 + i * 9.5], P)).join(""), { tone: "lo" }));
  // lid, handle and a filter at the outlet
  out.push(S(k.slabOf(k.insetPlan(box, -1.5), top, 6, P, 4, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf({ x: box.x + 24, y: box.y + 34, w: 22, d: 8, r: 3 }, top + 6, 7, P, 3), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(box, 6), top + 6, P, 3), { tone: "faint" }));
  out.push(bolts(k.corners(box, 7), top + 6));
  // outlet barb and its hose clamp
  const F = frameX(gx, box.y + 100, 34);
  out.push(S(G.disc(0, 14, 5, F, P, { steps: 20 }), { tone: "mid" }), S(G.disc(2, 4, 6.4, F, P, { steps: 20 }), { tone: "lo" }));
  return { c: [-85, -100, 90], svg: part("tank", out.join("")) };
}

function pump() {
  const x = 78, y0 = -158, z = 40;
  const F = frameY(x, y0, z);
  const out = [];
  out.push(S(k.slabOf({ x: x - 22, y: y0 + 8, w: 44, d: 82, r: 4 }, 12, 6, P, 3, 0.4), { tone: "lo" }));
  out.push(S(G.disc(8, 70, 23, F, P, { steps: 36 }), { tone: "mid" }));
  out.push(L(G.arcOf(F, 22, 23, P) + G.arcOf(F, 56, 23, P), { tone: "faint" }));
  out.push(S(G.disc(70, 96, 14, F, P, { steps: 28 }), { tone: "hi" }));
  out.push(L(G.arcOf(F, 82, 14, P), { tone: "faint" }));
  out.push(S(G.disc(0, 8, 8, F, P, { steps: 24 }), { tone: "lo" }));
  out.push(S(G.disc(96, 106, 5, F, P, { steps: 20 }), { tone: "mid" }));
  out.push(L(G.ribsOf(F, 10, 68, 23, 24, P, { seams: true }), { tone: "faint" }));
  out.push(D(G.dotsOf(F, 70, 11, 6, P), { size: 0.45 }));
  // wires out of the coil
  return { c: [x, y0 + 50, z], svg: part("pump", out.join("")) };
}

function opv() {
  const x = 80, y = -42;
  const F = frameZ(x, y, 12);
  const out = [];
  out.push(S(G.disc(0, 10, 9, F, P, { steps: 6 }), { tone: "mid" }));
  out.push(S(G.disc(10, 36, 5.4, F, P, { steps: 20 }), { tone: "mid", crease: "none" }));
  out.push(S(G.disc(36, 40, 8, F, P, { steps: 6 }), { tone: "lo" }));
  out.push(L(G.arcOf(F, 22, 5.4, P), { tone: "faint" }));
  out.push(D(G.dotsOf(F, 40, 5, 6, P, { all: true }), { size: 0.4 }));
  return { c: [x, y, 30], svg: part("opv", out.join("")) };
}

// the boiler, closed (under the panels) and cut open along its axis (the x-ray)
function boilerClosed() {
  const F = frameY(XC, BY0, ZC);
  const len = BY1 - BY0;
  const out = [];
  const prof = [[0, BR - 10], [4, BR - 3], [8, BR], [len - 8, BR], [len - 4, BR - 3], [len, BR - 10]];
  out.push(S(G.solidOf(prof, F, P, { steps: 56 }), { tone: "mid", inner: L([30, 100, 190].map((s) => G.arcOf(F, s, BR, P)).join(""), { tone: "faint" }) }));
  out.push(D(G.dotsOf(F, 8, BR - 6, 14, P, { all: true }), { size: 0.5 }));
  return out.join("");
}
function boilerCut() {
  const len = BY1 - BY0;
  const out = [];
  // the far half of the shell, seen from outside above the cut; the canvas covers its flat cut face
  const Fh = G.frameOf([XC, BY0, ZC], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const half = Array.from({ length: 33 }, (_, i) => { const a = Math.PI / 2 + (i / 32) * Math.PI; return [BR * Math.cos(a), BR * Math.sin(a)]; });
  out.push(S(G.prismOf(Fh, half, 0, len - 6, P), { tone: "mid", inner: "" }));
  // the sectioned wall: two thin strips on the cut plane, top and bottom
  out.push(S(k.slabOf({ x: XC - 0.8, y: BY0, w: 1.6, d: len, r: 0.5 }, ZC + BR - 4, 4, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: XC - 0.8, y: BY0, w: 1.6, d: len, r: 0.5 }, ZC - BR, 4, P, 2), { tone: "mid", crease: "none" }));
  // without WebGL: a plain section, with the water line and the two tubes drawn flat on the cut plane
  const Ri = BR - 4, y0 = BY0 + 4, y1 = BY1 - 6;
  const fb = [at([XC, y0, ZC - Ri]), at([XC, y1, ZC - Ri]), at([XC, y1, ZC + Ri]), at([XC, y0, ZC + Ri])];
  out.push(`<g class="es-fallback"><path class="es-sect" d="${k.pathOf(fb, true)}"/>${L(k.pathOf(fb, true), { tone: "faint" })}${L(k.segment([XC, y0, ZC + 6], [XC, y1, ZC + 6], P), { tone: "mid" })}${L(k.segment([XC, y0, ZC + 14], [XC, y1, ZC + 14], P), { tone: "faint" })}${L(k.segment([XC, y0, ZC - 36], [XC, y1, ZC - 36], P), { tone: "hi" })}</g>`);
  const arc = Array.from({ length: 33 }, (_, i) => { const a = Math.PI / 2 + (i / 32) * Math.PI; return at([XC + BR * Math.cos(a), BY0, ZC + BR * Math.sin(a)]); });
  out.push(L(k.pathOf(arc), { tone: "mid" }));
  out.push(L(k.pathOf(arc.map((_, i) => { const a = Math.PI / 2 + (i / 32) * Math.PI; return at([XC + (BR - 4) * Math.cos(a), BY0 + 4, ZC + (BR - 4) * Math.sin(a)]); })), { tone: "faint" }));
  return out.join("");
}
function boilerFront() {
  // the near end cap, a half disc (the far half of the boiler), drawn after the effect so it covers it
  const Fp = G.frameOf([XC, BY1 - 6, ZC], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const poly = Array.from({ length: 25 }, (_, i) => { const a = Math.PI / 2 + (i / 24) * Math.PI; return [BR * Math.cos(a), BR * Math.sin(a)]; });
  return S(G.prismOf(Fp, poly, 0, 6, P), { tone: "mid" });
}

function boilerFittings() {
  const out = [];
  // fill cap, safety valve and steam take-off on top (on the far half)
  const top = (dx) => ZC + Math.sqrt(BR * BR - dx * dx);
  const fill = [XC - 30, 70];
  out.push(S(k.cylinder(fill[0], fill[1], 9, top(30), 6, P, 24, 0.4), { tone: "mid" }), L(k.knurl(fill[0], fill[1], 9, top(30), top(30) + 6, 20, P), { tone: "lo" }));
  const safety = [XC - 30, -40];
  out.push(S(k.cylinder(safety[0], safety[1], 6, top(30), 10, P, 20, 0.3), { tone: "hi" }), S(k.cylinder(safety[0], safety[1], 3.4, top(30) + 10, 8, P, 16), { tone: "mid" }));
  return out.join("");
}

function groupHead() {
  const [gx, gy] = GROUP;
  const out = [];
  const z0 = WD.G_Z0;
  const F = frameZ(gx, gy, z0);
  const prof = [[0, 24], [4, 29], [12, 33, 1], [30, 39, 1], [52, 38, 1], [66, 31, 1], [76, 20, 1]];
  out.push(S(G.solidOf(prof, F, P, { steps: 56 }), { tone: "hi", inner: L(G.arcOf(F, 6, 30, P) + G.arcOf(F, 26, 38.4, P), { tone: "faint" }) }));
  // rear boss through the panel and the lever bearing
  const Fy = frameY(gx, FASCIA_Y - 6, 268);
  out.push(S(G.disc(0, 34, 21, Fy, P, { steps: 36 }), { tone: "mid" }));
  const Fx = frameX(gx + 36, gy, 268);
  out.push(S(G.disc(0, 8, 13, Fx, P, { steps: 28 }), { tone: "hi" }), S(G.disc(8, 12, 7, Fx, P, { steps: 20 }), { tone: "mid" }));
  out.push(D(G.dotsOf(Fx, 12, 4, 4, P, { all: true }), { size: 0.4 }));
  // cap on top: the 3-way valve body sits on it
  const Ft = frameZ(gx, gy, z0 + 76);
  out.push(S(G.disc(0, 8, 14, Ft, P, { steps: 28 }), { tone: "mid" }), S(G.disc(8, 18, 8, Ft, P, { steps: 24 }), { tone: "hi" }));
  return part("group", out.join(""));
}
const FASCIA_Y = 150;


// ---------- things that sit in front of the front panel ----------
function manifold() {
  const out = [];
  const blk = { x: -30, y: 146, w: 60, d: 22, r: 3 };
  out.push(S(k.slabOf(blk, 212, 94, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(blk, 232, P, 4) + k.sideSeam(blk, 290, P, 4), { tone: "faint" }) }));
  out.push(bolts(k.corners(blk, 4), 306));
  return part("group", out.join(""));
}

function solenoid() {
  const out = [];
  const F = frameX(30, 160, 238);
  out.push(S(G.disc(0, 14, 9, F, P, { steps: 24 }), { tone: "mid" }), S(G.disc(14, 40, 13, F, P, { steps: 32 }), { tone: "lo" }));
  out.push(L(G.ribsOf(F, 16, 38, 13, 20, P, { seams: true }), { tone: "faint" }));
  out.push(S(G.disc(40, 44, 6, F, P, { steps: 20 }), { tone: "mid" }));
  return part("valve", out.join(""));
}

function portafilter() {
  const [gx, gy] = GROUP;
  const out = [];
  const F = frameZ(gx, gy, 205);
  const ghost = [];
  ghost.push(S(G.disc(0, 17, 35, F, P, { steps: 56 }), { tone: "mid", inner: L(G.arcOf(F, 8, 35, P), { tone: "faint" }) }));
  ghost.push(L(G.ribsOf(F, 1, 16, 35, 36, P, { seams: true }), { tone: "faint" }));
  const Fb = frameZ(gx, gy, 186);
  ghost.push(S(G.disc(0, 19, 29, Fb, P, { steps: 48 }), { tone: "hi", inner: L(G.arcOf(Fb, 12, 29, P), { tone: "faint" }) }));
  out.push(`<g data-ghost>${ghost.join("")}</g>`);
  // spouts
  for (const sx of [-16, 16]) {
    const Fs = frameZ(gx + sx, gy, 168);
    out.push(S(G.disc(0, 19, 5, Fs, P, { steps: 18 }), { tone: "mid" }));
  }
  // handle along +y
  const Fh = frameY(gx, gy + 28, 196);
  out.push(S(G.disc(0, 30, 9, Fh, P, { steps: 28 }), { tone: "mid" }));
  out.push(S(G.disc(30, 118, 15, Fh, P, { steps: 40 }), { tone: "lo", inner: L(G.arcOf(Fh, 64, 15, P) + G.arcOf(Fh, 90, 15, P), { tone: "faint" }) }));
  out.push(S(G.sphereOf([gx, gy + 28 + 126, 196], 12, P), { tone: "lo" }));
  return part("portafilter", out.join(""));
}

function gauge(x, z, needleAngle, id, ticks) {
  const F = frameY(x, FASCIA_Y, z);
  const out = [];
  out.push(S(G.disc(0, 7, 27, F, P, { steps: 40 }), { tone: "hi" }));
  out.push(S(G.disc(7, 8, 23, F, P, { steps: 40 }), { tone: "lo", crease: "none" }));
  const yf = FASCIA_Y + 8.1;
  const pt = (a, r) => at([x + r * Math.cos(a), yf, z + r * Math.sin(a)]);
  const arc = [];
  for (let i = 0; i <= 24; i++) { const a = (gaugeAngle(i / 24) * Math.PI) / 180; arc.push(pt(a, 20)); }
  out.push(L(k.pathOf(arc), { tone: "lo" }));
  const minor = [], major = [];
  for (let i = 0; i <= ticks; i++) { const a = (gaugeAngle(i / ticks) * Math.PI) / 180; (i % 5 === 0 ? major : minor).push(k.pathOf([pt(a, 20), pt(a, i % 5 === 0 ? 15.5 : 17.5)])); }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(`<path data-needle="${id}" class="iso-line" data-tone="hi" data-free="start" style="stroke-width:1.05" d="${needleD(P, x, z, needleAngle)}"/>`);
  out.push(D([at([x, yf, z])], { size: 1.3, tone: "hi" }));
  return out.join("");
}

// the steam valve, its knob outside the right panel, and the wand
function steamWand() {
  const out = [];
  const F = frameX(124, 112, 262);
  out.push(S(G.disc(0, 8, 12, F, P, { steps: 28 }), { tone: "mid" }), S(G.disc(8, 22, 6, F, P, { steps: 20 }), { tone: "mid", crease: "none" }));
  const K = frameX(144, 112, 262);
  out.push(S(G.disc(0, 5, 14, K, P, { steps: 36 }), { tone: "hi" }), S(G.disc(5, 17, 11, K, P, { steps: 36 }), { tone: "mid" }));
  out.push(L(G.ribsOf(K, 5.4, 16.6, 11, 18, P, { seams: true }), { tone: "lo" }));
  out.push(D(G.dotsOf(K, 17, 5, 1, P, { all: true }), { size: 0.5, tone: "hi" }));
  out.push(pipe([[150, 112, 235], [170, 112, 235], [172, 112, 150], [168, 126, 112], [166, 138, 100]], 3.6, { tone: "mid" }));
  out.push(S(k.cylinder(166, 139, 2.4, 96, 6, P, 12), { tone: "lo" }));
  return part("steam", out.join(""));
}

function dripTray() {
  const tray = { x: -104, y: 158, w: 208, d: 128, r: 6 };
  const out = [];
  out.push(S(k.slabOf(tray, 12, 20, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(tray, 20, P, 6), { tone: "faint" }) }));
  const grate = k.insetPlan(tray, 4);
  out.push(S(k.slabOf(grate, 32, 3, P, 4, 0.4), { tone: "lo" }));
  out.push(L(Array.from({ length: 13 }, (_, i) => k.lineOnTop([grate.x, grate.y + 6 + i * 8.7], [grate.x + grate.w, grate.y + 6 + i * 8.7], 35, P)).join(""), { tone: "faint" }));
  out.push(S(k.slabOf({ x: tray.x + 70, y: tray.y + tray.d - 5, w: 68, d: 6, r: 2 }, 22, 6, P, 3), { tone: "hi" }));
  return part("tray", out.join(""));
}

function cup(cx) {
  const [, gy] = GROUP;
  const out = [];
  const z0 = 35;
  const F = frameZ(cx, gy, z0);
  out.push(S(G.disc(-3, 0, 30, F, P, { steps: 40 }), { tone: "lo" }));
  const prof = [[0, 12], [2.5, 14], [6, 18, 1], [22, 26, 1], [34, 28], [34.001, 28]];
  out.push(S(G.solidOf(prof, F, P, { steps: 40 }), { tone: "hi" }));
  out.push(`<path class="es-cupin" d="${G.circleOf(F, 34, 25.5, P, 44)}"/>`);
  out.push(L(G.arcOf(F, 32, 27.6, P), { tone: "faint" }));
  return out.join("");
}

function frontPanelLower() {
  const out = [];
  const bx = { x: -134, y: 148, w: 268, d: 5, r: 2 };
  out.push(S(k.slabOf(bx, 12, FASCIA_Z - 12, P, 3, 0.4), { tone: "mid" }));
  // power switch and lamp on the lower panel
  out.push(S(k.slabOf({ x: -116, y: 153, w: 26, d: 5, r: 2 }, 120, 18, P, 3, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf({ x: -110, y: 158, w: 14, d: 4, r: 1.5 }, 124, 10, P, 3), { tone: "hi" }));
  out.push(D([at([-70, 158, 130])], { size: 1.6, tone: "hi" }));
  out.push(L(k.ring(-70, 153.1, 0, 0, P, 4), { tone: "lo" }));
  return part("panel", out.join(""));
}

function wallRight() {
  const out = [];
  out.push(S(k.slabOf({ x: 131, y: -172, w: 5, d: 322, r: 2 }, 12, TOP_Z - 12, P, 3, 0.4), { tone: "mid" }));
  const px = 136.1;
  out.push(L(k.segment([px, -154, 38], [px, -78, 38], P) + k.segment([px, -78, 38], [px, -78, 86], P) + k.segment([px, -78, 86], [px, -154, 86], P) + k.segment([px, -154, 86], [px, -154, 38], P), { tone: "lo" }));
  out.push(L(Array.from({ length: 8 }, (_, i) => k.segment([px, -146 + i * 9.4, 38], [px, -146 + i * 9.4, 86], P)).join(""), { tone: "faint" }));
  // an inset panel with a badge, and a seam round it
  out.push(L(k.segment([px, -150, 150], [px, 120, 150], P) + k.segment([px, 120, 150], [px, 120, 300], P) + k.segment([px, -150, 150], [px, -150, 300], P) + k.segment([px, -150, 300], [px, 120, 300], P), { tone: "faint" }));
  out.push(S(k.slabOf({ x: px, y: -40, w: 0.8, d: 70, r: 0.1 }, 205, 24, P, 2), { tone: "lo", crease: "none" }));
  out.push(L(Array.from({ length: 3 }, (_, i) => k.segment([px + 0.8, -30, 214 + i * 6], [px + 0.8, 24 + (i === 1 ? 0 : -12), 214 + i * 6], P)).join(""), { tone: "lo", free: true }));
  out.push(bolts([[px, -160, 30], [px, 136, 30], [px, -160, 330], [px, 136, 330], [px, -140, 150], [px, 112, 150], [px, -140, 290], [px, 112, 290]], 0));
  return out.join("");
}
function fascia() {
  const out = [];
  out.push(S(k.slabOf({ x: -134, y: 148, w: 268, d: 5, r: 2 }, FASCIA_Z, TOP_Z - FASCIA_Z, P, 3, 0.4), { tone: "mid" }));
  out.push(L(k.lineOnTop([-110, 153.1], [110, 153.1], 215, P), { tone: "faint" }));
  return out.join("");
}
function topCover() {
  const out = [];
  out.push(S(k.slabOf({ x: -138, y: -174, w: 276, d: 328, r: 10 }, TOP_Z, 10, P, 8, 1), { tone: "mid", inner: L(k.sideSeam({ x: -138, y: -174, w: 276, d: 328, r: 10 }, TOP_Z + 5, P, 8), { tone: "faint" }) }));
  out.push(L(Array.from({ length: 9 }, (_, i) => k.lineOnTop([-138, -150 + i * 34], [138, -150 + i * 34], TOP_Z + 10, P)).join(""), { tone: "faint" }));
  const rail = { x: -120, y: -150, w: 240, d: 6, r: 3 };
  out.push(S(k.slabOf(rail, TOP_Z + 10, 12, P, 3, 0.4), { tone: "lo" }));
  return out.join("");
}

// ---------- pipes ----------
function plumbing() {
  const out = [];
  // tank -> pump (cold)
  out.push({ c: [20, -50, 36], svg: part("pump", pipe([[-36, -58, 34], [-36, -44, 34], [78, -44, 40], [78, -50, 40]], 3, { tone: "mid", flow: "cold", id: "p1" })) });
  // pump -> boiler's heat exchanger (cold)
  out.push({ c: [78, -160, 120], svg: part("hx", pipe([[78, -166, 40], [78, -166, 70], [78, -166, 232], [-20, -166, 232], [-20, -108, 232]], 3, { tone: "mid", flow: "cold", id: "p2" })) });
  // OPV return
  out.push({ c: [100, -160, 60], svg: part("opv", pipe([[78, -166, 62], [104, -156, 62], [104, -152, 50]], 2.4, { tone: "mid", flow: "cold", id: "p3" })) });
  // thermosyphon loop: hot up, cooler down
  out.push({ c: [-20, 134, 290], svg: part("thermo", pipe([[-20, 118, 292], [-20, 160, 292]], 3.2, { tone: "mid", flow: "hot", id: "t1" }) + pipe([[-20, 118, 214], [-20, 160, 214]], 3.2, { tone: "mid", flow: "warm", id: "t2" })) });
  // HX out to the group
  out.push({ c: [-20, 134, 252], svg: part("hx", pipe([[-20, 118, 252], [-20, 160, 252]], 3.2, { tone: "mid", flow: "hot", id: "h1" })) });
  // steam take-off
  out.push({ c: [30, 40, 330], svg: part("steam", pipe([[-45, 40, 292], [-45, 40, 330], [100, 40, 330], [100, 112, 330], [100, 112, 274]], 3, { tone: "mid", flow: "steam", id: "s1" })) });
  // valve to the wand
  out.push({ c: [110, 112, 250], svg: part("steam", pipe([[100, 112, 262], [124, 112, 262]], 3, { tone: "mid" })) });
  // pressurestat line
  out.push({ c: [-60, -70, 320], svg: part("pressurestat", pipe([[-30, -70, 296], [-30, -70, 328], [-85, -70, 328], [-85, -70, 318]], 2.4, { tone: "mid", flow: "steam", id: "s2" })) });
  return out;
}

function pressurestat() {
  const out = [];
  out.push(S(k.slabOf({ x: -131, y: -80, w: 56, d: 16, r: 2 }, 286, 4, P, 3), { tone: "lo" }));
  const F = frameZ(-85, -72, 290);
  out.push(S(G.disc(0, 26, 11, F, P, { steps: 28 }), { tone: "mid" }), S(G.disc(26, 30, 7, F, P, { steps: 20 }), { tone: "lo" }));
  out.push(S(k.slabOf({ x: -100, y: -80, w: 30, d: 16, r: 2 }, 262, 24, P, 3, 0.4), { tone: "hi" }));
  out.push(D([at([-96, -64, 286]), at([-74, -64, 286])], { size: 0.45 }));
  return { c: [-90, -72, 290], svg: part("pressurestat", out.join("")) };
}

function element() {
  // terminal block on the rear cap, below the boiler axis
  const out = [];
  out.push(S(k.slabOf({ x: XC - 40, y: BY0 - 12, w: 30, d: 12, r: 2 }, ZC - 40, 18, P, 3, 0.4), { tone: "lo" }));
  out.push(S(k.cylinder(XC - 32, BY0 - 4, 3.4, ZC - 22, 8, P, 14), { tone: "hi" }), S(k.cylinder(XC - 18, BY0 - 4, 3.4, ZC - 22, 8, P, 14), { tone: "hi" }));
  return { c: [XC - 25, BY0 - 6, ZC - 30], svg: part("element", out.join("")) };
}

// ============================ assemble ============================
const interior = [];
interior.push(...frame());
interior.push(tank(), pump(), opv(), pressurestat(), element());
interior.push({ c: [XC, 10, ZC], svg: `<g data-x="closed">${boilerClosed()}</g><g data-x="cut">${boilerCut()}</g>` });
interior.push({ c: [XC - 30, 20, ZC + 50], svg: part("boiler", boilerFittings()) });
interior.push(...plumbing());

const backBody = [floor(), wallsBack(), sorted(interior), frontPanelLower(), dripTray(), part("tray", cup(-30) + cup(30))];
const frontBody = [
  `<g data-shell="right">${wallRight()}</g>`,
  `<g data-shell="top">${topCover()}</g>`,
  `<g data-shell="fascia">${fascia()}</g>`,
  part("boiler", boilerFront()),
  manifold(),
  groupHead(),
  solenoid(),
  `<g data-part="lever"><g data-lever>${leverSvg(P, -40)}</g></g>`,
  part("gauges", gauge(-100, 300, gaugeAngle(0.55), "steam", 20) + gauge(100, 300, gaugeAngle(0), "pump", 30)),
  portafilter(),
  steamWand(),
];

const LABEL = "An Italian E61 heat-exchanger espresso machine, with its side panel and top cover that can be made see-through. Inside: a water tank, a vibratory pump with an over-pressure valve, a boiler with a heating element and a heat-exchanger tube, a thermosyphon loop to the E61 group head, a three-way valve, a brew lever, a portafilter, two pressure gauges, a steam valve and wand, and a drip tray.";
const back = k.figureSvg({ width: WD.W, height: WD.H, label: LABEL, body: backBody, className: "es-back" });
const front = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg es-layer es-front" viewBox="0 0 ${WD.W} ${WD.H}" aria-hidden="true">${frontBody.join("")}</svg>`;
const stage = `<div class="es-stage" tabindex="0" role="group" aria-label="Espresso machine">${back}<canvas class="es-layer es-gl" aria-hidden="true"></canvas>${front}<canvas class="es-layer es-gl-top" aria-hidden="true"></canvas></div>`;

const DATA = {
  W: WD.W, H: WD.H, P, camera: glCamera(P), light: theme === "light" ? 1 : 0,
  XC, ZC, BR, BY0, BY1, WATER: ZC + 6,
  cups: [-30, 30], cupY: GROUP[1], cupBase: 35, cupRim: 69, cupRIn: 25.5,
  spouts: [-16, 16], spoutZ: 168, tip: [166, 139, 96],
  gauges: { steam: [-100, 300], pump: [100, 300] },
};
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__FRAG_A__", () => JSON.stringify(readFileSync(join(HERE, "shader-a.glsl"), "utf8"))).replace("__FRAG_B__", () => JSON.stringify(readFileSync(join(HERE, "shader-b.glsl"), "utf8")));
const strip = (file) => readFileSync(file, "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const inlined = ["const { frameOf, prismOf, stadium, sphereOf } = (() => {\n" + strip("/root/.claude/skills/anatomy/kit/lathe.mjs") + "\nreturn { frameOf, prismOf, stadium, sphereOf };\n})();", strip(join(HERE, "rig.mjs")), strip(join(HERE, "parts.mjs"))].join("\n");
const UI = `<div class="es-ui"><div class="es-bar"><label class="es-look">Look inside<input type="range" min="0" max="1" step="0.01" value="0" aria-label="Look inside the machine"></label><button type="button" data-act="shot">Pull a shot</button><button type="button" data-act="steam">Steam</button></div><p class="es-note" aria-live="polite"></p><div class="es-parts" role="group" aria-label="Parts"></div></div>`;
const CSS = readFileSync(join(HERE, "es.css"), "utf8");
const outFile = theme === "light" ? "espresso-light.html" : "espresso.html";
const card = { fig: "Fig 1", title: "E61 espresso machine", hint: "Click the lever, or drag Look inside", readout: "idle", keys: [{ mark: "lit", label: "Brew lever" }], caption: "A heat-exchanger machine. The pump pushes cold water through a tube inside the hot boiler; it comes out at 93 \u00b0C and goes through 18 g of coffee at 9 bar for about 28 seconds. The shot here runs three times faster than life. The boiler is cut open along its axis: the tube is blue where fresh water has just arrived and red where it has sat in the heat.", body: stage };
writeFileSync(join(HERE, outFile), k.pageHtml({ title: "Espresso machine", theme, body: `<style>${CSS}</style>${k.plateHtml(card)}${UI}`, script: kitScript() + "\n" + glScript() + "\n" + inlined + "\n" + LIVE.replace("__DATA__", JSON.stringify(DATA)) }));
console.log("wrote", outFile);
