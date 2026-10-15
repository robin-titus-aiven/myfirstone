import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "/root/.claude/skills/anatomy/kit/iso-kit.mjs";
import { glCamera } from "/root/.claude/skills/anatomy/kit/gl.mjs";
import { kitScript, glScript } from "/root/.claude/skills/anatomy/scripts/inline-kit.mjs";
import * as R from "./rig.mjs";
import { PLATTER, COILS, COIL_R, ARM_Z, armSvg, labelSvg, strobeSvg } from "./parts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const W = 720, H = 470;

const PLINTH = { x: -232, y: -180, w: 464, d: 394, r: 16 };
const PL_H = 40, FOOT_H = 10;
const [SX, SY] = R.SPINDLE;
const TAU = Math.PI * 2;

const P = k.fitProjection(
  [...k.boxCorners(PLINTH, -PL_H - FOOT_H, 0), [SX, SY, 74], [R.PIVOT[0], R.PIVOT[1], 84], [SX, SY, 54]],
  W, H, { pad: 26, azimuth: 40, elevation: 32 },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (items, pos) => [...items].sort((a, b) => k.depthOf([...pos(a), 0], P) - k.depthOf([...pos(b), 0], P));
const knob = (cx, cy, r, z, h, tone = "mid", n = 28) => S(k.cylinder(cx, cy, r, z, h, P, 32, 0.3), { tone }) + L(k.knurl(cx, cy, r, z, z + h, n, P), { tone: "lo" });

// ---------- back layer: everything the record's sheen lies on top of ----------
function plinth() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLINTH, -PL_H - FOOT_H, PL_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLINTH, 26), (c) => c)) {
    out.push(S(k.cylinder(x, y, 15, -PL_H - FOOT_H, FOOT_H, P, 28, 0.6), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 10, -PL_H - FOOT_H + 1.2, FOOT_H - 1.2, P, 24), { tone: "mid", crease: "none" }));
  }
  const seam = L(k.sideSeam(PLINTH, -PL_H + 9, P, 8), { tone: "faint" }) + L(k.sideSeam(PLINTH, -9, P, 8), { tone: "faint" });
  out.push(S(k.slabOf(PLINTH, -PL_H, PL_H, P, 8, 1.4), { tone: "mid", inner: seam }));
  out.push(L(k.planOutline(k.insetPlan(PLINTH, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLINTH, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // label plate with three rules, in the back strip
  const plate = { x: -150, y: -172, w: 96, d: 9, r: 1.5 };
  out.push(S(k.slabOf(plate, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  out.push(L([-10, -6.6, -3.4].map((o) => k.lineOnTop([plate.x + 8, -167.5 + o * 0 + (o + 6.6) * 0.5], [plate.x + 8 + 40 + o * 4, -167.5 + (o + 6.6) * 0.5], 0.7, P)).join(""), { tone: "faint", free: true }));
  return out.join("");
}

function jacks() {
  const plate = { x: 182, y: -176, w: 44, d: 26, r: 3 };
  const out = [S(k.slabOf(plate, 0, 4, P, 4, 0.5), { tone: "mid" })];
  for (const [x, y] of [[194, -163], [214, -163]]) {
    out.push(S(k.cylinder(x, y, 6, 4, 8, P, 28, 0.4), { tone: "hi" }));
    out.push(L(k.ring(x, y, 3.4, 12, P, 20) + k.ring(x, y, 1.6, 12, P, 14), { tone: "mid" }));
    out.push(L(k.knurl(x, y, 6, 4.6, 11.4, 20, P), { tone: "lo" }));
  }
  out.push(D([at([plate.x + 5, plate.y + 5, 4]), at([plate.x + plate.w - 5, plate.y + plate.d - 5, 4])], { size: 0.45 }));
  return out.join("");
}

const coilAngle = (i) => ((i + 0.5) / COILS) * TAU;
function stator() {
  const out = [S(k.cylinder(SX, SY, 152, 0, 3, P, 96, 0.4), { tone: "lo" })];
  out.push(L(k.ring(SX, SY, 144, 3, P, 96), { tone: "faint" }));
  const coils = [...Array(COILS).keys()].map((i) => ({ i, x: SX + Math.cos(coilAngle(i)) * COIL_R, y: SY + Math.sin(coilAngle(i)) * COIL_R }));
  for (const c of byDepth(coils, (c) => [c.x, c.y])) {
    const wind = k.ring(c.x, c.y, 6.4, 15, P, 18) + k.ring(c.x, c.y, 3.6, 15, P, 14);
    out.push(`<g class="tt-coil" data-coil="${c.i}">` + S(k.cylinder(c.x, c.y, 9, 3, 12, P, 24, 0.4), { tone: "mid" }) + L(k.knurl(c.x, c.y, 9, 3, 15, 16, P), { tone: "faint" }) + L(wind, { tone: "faint", className: "tt-wind" }) + `</g>`);
  }
  const screws = [...Array(COILS).keys()].map((i) => at([SX + Math.cos(coilAngle(i) + TAU / COILS / 2) * 147, SY + Math.sin(coilAngle(i) + TAU / COILS / 2) * 147, 3]));
  out.push(D(screws, { size: 0.45 }));
  return out.join("");
}

function platter() {
  const out = [];
  const seams = L(k.sideArc(SX, SY, PLATTER.r, PLATTER.z0 + 14, P, 80), { tone: "faint" }) + L(k.sideArc(SX, SY, PLATTER.r, PLATTER.z0 + 2.2, P, 80), { tone: "faint" });
  out.push(S(k.cylinder(SX, SY, PLATTER.r, PLATTER.z0, PLATTER.z1 - PLATTER.z0, P, 120, 0.9), { tone: "mid", inner: seams }));
  out.push(L(k.ring(SX, SY, 160, PLATTER.z1, P, 120) + k.ring(SX, SY, 156, PLATTER.z1, P, 120), { tone: "lo" }));
  out.push(S(k.cylinder(SX, SY, 150, PLATTER.z1, 2, P, 100), { tone: "lo", crease: "none" }));
  out.push(`<g data-part="strobe">${strobeSvg(P, [0, 0], [1, 1])}</g>`);
  // the record
  out.push(S(k.cylinder(SX, SY, R.R_OUT, 52, R.REC_TOP - 52, P, 120, 0.5), { tone: "lo", crease: "faint" }));
  out.push(S(k.cylinder(SX, SY, R.R_LABEL, R.REC_TOP, 0.4, P, 72), { tone: "mid", crease: "none" }));
  out.push(L(k.ring(SX, SY, R.R_LABEL - 3.5, R.REC_TOP + 0.4, P, 72), { tone: "lo" }));
  out.push(`<g data-part="label">${labelSvg(P, 0)}</g>`);
  return out.join("");
}

// ---------- front layer: what stands above, or in front of, the record ----------
function pedestal() {
  const [x, y] = R.PIVOT;
  const out = [];
  out.push(S(k.cylinder(x, y, 30, 0, 4, P, 40, 0.4), { tone: "lo" }));
  out.push(D([0, 1, 2, 3].map((i) => at([x + Math.cos(i * 1.57 + 0.78) * 25, y + Math.sin(i * 1.57 + 0.78) * 25, 4])), { size: 0.5 }));
  out.push(S(k.cylinder(x, y, 22, 4, 52, P, 44), { tone: "mid", crease: "none", inner: [14, 30, 46].map((z) => L(k.sideArc(x, y, 22, z, P, 24), { tone: "faint" })).join("") }));
  out.push(S(k.cylinder(x, y, 15, ARM_Z - 8, 8, P, 36, 0.4), { tone: "mid" }));
  out.push(L(k.ring(x, y, 11, ARM_Z, P, 28), { tone: "lo" }));
  return out.join("");
}

function antiSkate() {
  const [x, y] = [210, -58];
  const t = k.radialTicks(x, y, 7.4, 12, 3, 8, [1.2, 2.2], P);
  return S(k.cylinder(x, y, 9, 0, 8, P, 28, 0.4), { tone: "mid" }) + L(k.knurl(x, y, 9, 0, 6.6, 26, P), { tone: "lo" }) + L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }) + L(k.ring(x, y, 7.4, 8, P, 28), { tone: "faint" });
}

function cue() {
  const plate = { x: 198, y: -124, w: 18, d: 40, r: 3 };
  const out = [S(k.slabOf(plate, 0, 3, P, 4, 0.4), { tone: "mid" }), L(k.planOutline(k.insetPlan(plate, 3), 3, P, 3), { tone: "faint" })];
  out.push(S(k.cylinder(207, -116, 3, 3, 5, P, 16), { tone: "lo" }));
  const lever = S(k.slabOf({ x: 205, y: -116, w: 4, d: 32, r: 1.6 }, 8, 3, P, 3), { tone: "mid" }) + knob(207, -83, 4.6, 6, 6, "mid", 20);
  out.push(`<g data-part="cue" transform="${k.translateAlong(P, [0, 0, 0])}">${lever}</g>`);
  return out.join("");
}

function rest() {
  const [rx, ry] = [R.PIVOT[0] + Math.cos(R.PHI_REST) * 190, R.PIVOT[1] + Math.sin(R.PHI_REST) * 190];
  return S(k.cylinder(rx, ry, 5, 0, 3, P, 20), { tone: "lo" }) + S(k.cylinder(rx, ry, 3, 3, 53, P, 18), { tone: "mid", crease: "none" })
    + S(k.slabOf({ x: rx - 7, y: ry - 5.5, w: 14, d: 11, r: 2 }, 56, 8, P, 3, 0.4), { tone: "mid" }) + L(k.lineOnTop([rx - 5, ry], [rx + 5, ry], 64, P), { tone: "faint" });
}

const FADER = { x: 197, y: 12, w: 8, d: 116, r: 3 };
const FADER_ZERO = 70, FADER_SPAN = 52;
function fader() {
  const out = [S(k.slabOf(FADER, 0, 0.6, P, 4), { tone: "lo", crease: "none" })];
  out.push(L(k.lineOnTop([201, FADER.y], [201, FADER.y + FADER.d], 0.6, P), { tone: "faint" }));
  const strip = { x: 181, y: 14, w: 7, d: 112, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const minor = [], major = [];
  for (let p = -8; p <= 8; p++) {
    const yy = FADER_ZERO - (p * FADER_SPAN) / 8;
    const big = p % 4 === 0;
    (big ? major : minor).push(k.lineOnTop([188, yy], [188 + (big ? 7 : 4), yy], 0.6, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(D([at([184.5, 17, 0.6]), at([184.5, 123, 0.6])], { size: 0.4 }));
  const cap = { x: 191, y: FADER_ZERO - 6, w: 20, d: 12, r: 2.4 };
  const grips = [-3.6, 0, 3.6].map((o) => k.lineOnTop([cap.x + 3, FADER_ZERO + o], [cap.x + cap.w - 3, FADER_ZERO + o], 10.6, P)).join("");
  out.push(`<g data-part="fader">` + S(k.slabOf(cap, 0.6, 10, P, 4, 0.6), { tone: "hi" }) + L(grips, { tone: "mid" }) + D([at([cap.x + 3, FADER_ZERO, 10.6])], { size: 0.45, tone: "hi" }) + `</g>`);
  return out.join("");
}

const BTN = { x: -173, y: 176, w: 46, d: 30, r: 4 };
const SPEED = [{ x: -95, y: 190, r: 9, speed: 33 }, { x: -60, y: 190, r: 9, speed: 45 }];
function controls() {
  const out = [];
  out.push(S(k.slabOf(BTN, 0, 5, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BTN, 3.4), 5, P, 3), { tone: "faint" }));
  out.push(`<g data-led="power">${D([at([BTN.x + 8, BTN.y + 8, 5])], { size: 1.1, tone: "faint" })}</g>`);
  for (const b of SPEED) {
    out.push(S(k.cylinder(b.x, b.y, b.r, 0, 5, P, 28, 0.5), { tone: "mid" }));
    out.push(L(k.ring(b.x, b.y, b.r - 2.6, 5, P, 24), { tone: "faint" }));
    out.push(`<g data-led="${b.speed}">${D([at([b.x, b.y - 15, 0])], { size: 1.1, tone: "faint" })}</g>`);
  }
  const plate = { x: -114, y: 201, w: 68, d: 9, r: 1.5 };
  out.push(S(k.slabOf(plate, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  out.push(k.faceTextSvg(k.topMatrix([-95, 208.2], 0.7, P), "33", { size: 5, tone: "mid", anchor: "middle" }));
  out.push(k.faceTextSvg(k.topMatrix([-60, 208.2], 0.7, P), "45", { size: 5, tone: "mid", anchor: "middle" }));
  // strobe lamp
  const [lx, ly] = [-182, 150];
  out.push(S(k.cylinder(lx, ly, 9, 0, 5, P, 24, 0.4), { tone: "lo" }) + S(k.cylinder(lx, ly, 3.2, 5, 11, P, 16), { tone: "mid", crease: "none" }) + S(k.cylinder(lx, ly, 6.4, 16, 8, P, 24, 0.4), { tone: "hi" }));
  out.push(L(k.ring(lx, ly, 4, 24, P, 18), { tone: "lo" }) + D([at([lx, ly, 24])], { size: 1.3, tone: "hi", pulse: true }));
  return out.join("");
}

function spindle() {
  return S(k.cylinder(SX, SY, 3.6, R.REC_TOP + 0.4, 12, P, 16, 0.4), { tone: "hi" }) + L(k.ring(SX, SY, 1.6, R.REC_TOP + 12.4, P, 12), { tone: "lo" });
}

const phi0 = R.armAngle(R.R_FIRST);
const wires = k.wireSvg(at([R.PIVOT[0] - 10, R.PIVOT[1] - 24, 2]), at([194, -163, 8]), { via: [at([R.PIVOT[0] - 10, -148, 0.6]), at([194, -148, 0.6])], tone: "lo", flow: true, size: 1 });

const backBody = [plinth(), jacks(), wires, stator(), platter()];
const frontBody = [pedestal(), antiSkate(), cue(), rest(), fader(), controls(), spindle(), `<g data-part="arm">${armSvg(P, { phi: R.PHI_REST, lift: 12 })}</g>`];

const LABEL = "A direct-drive DJ turntable with its platter lifted to show the motor. Coils round the stator are energised in turn, so a magnetic field circles the platter at 33 and a third or 45 turns a minute. The tonearm lets a stylus ride the record's spiral groove while a strobe row of dots on the platter's rim stands still when the speed is exact.";
const back = k.figureSvg({ width: W, height: H, label: LABEL, body: backBody, className: "tt-back" });
const front = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg tt-layer tt-front" viewBox="0 0 ${W} ${H}" aria-hidden="true">${frontBody.join("")}</svg>`;
const stage = `<div class="tt-stage" tabindex="0" role="group" aria-label="Turntable: space starts and stops, 3 and 4 pick the speed, up and down arrows move the pitch fader, left and right arrows move the needle, C lowers or lifts it">${back}<canvas class="tt-layer tt-gl" aria-hidden="true"></canvas>${front}</div>`;

const DATA = {
  W, H, P, camera: glCamera(P), light: theme === "light" ? 1 : 0,
  S: R.SPINDLE, recZ: R.REC_TOP, rOut: R.R_OUT, rLabel: R.R_LABEL, gaps: R.GAPS, pivot: R.PIVOT,
  btn: BTN, speed: SPEED, fader: { ...FADER, zero: FADER_ZERO, span: FADER_SPAN }, platterTop: PLATTER.z1,
};

const CSS = `
.tt-stage{position:relative;touch-action:pan-y;outline:none;cursor:default}
.tt-stage>svg,.tt-stage>canvas{display:block;width:100%;height:auto}
.tt-stage>.tt-layer{position:absolute;inset:0;height:100%!important;pointer-events:none}
.iso:not([data-theme="light"]) .tt-gl{mix-blend-mode:screen}
.tt-stage:focus-visible{box-shadow:0 0 0 1px var(--anatomy-mid) inset}
.tt-coil[data-on]>.iso-solid>.iso-top{fill:var(--anatomy-lit-top)}.tt-coil[data-on]>.iso-solid>.iso-shade{fill:var(--anatomy-lit-shade)}
.tt-wire{animation:tt-flow 1.4s linear infinite}
@keyframes tt-flow{to{stroke-dashoffset:-8}}
@media (prefers-reduced-motion:reduce){.tt-wire{animation:none}}
`;

const LIVE = readFileSync(join(HERE, "live.js"), "utf8");
const strip = (file) => readFileSync(file, "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "");
const inlined = ["const { disc, frameAlong } = (() => {\n" + strip("/root/.claude/skills/anatomy/kit/lathe.mjs") + "\nreturn { disc, frameAlong };\n})();", strip(join(HERE, "rig.mjs")), strip(join(HERE, "parts.mjs"))].join("\n");

const card = {
  fig: "Fig 1",
  title: "DJ turntable",
  hint: "Click the record · drag the fader",
  readout: "33⅓ rpm +0.0% · stopped",
  keys: [
    { mark: "lit", label: "Stylus: reads the groove" },
    { mark: "raised", label: "Stator coils: the field that turns the platter" },
    { mark: "dotted", label: "Strobe dots: still when the speed is exact" },
  ],
  caption: "The platter is lifted to show the motor. Coils round the stator are driven in turn, so a magnetic field circles the platter at its speed, and the pitch fader trims that speed by up to 8%. A stylus rides the spiral groove; its wiggles move a magnet among tiny coils in the cartridge, and that is the signal. The strobe dots only stand still at exactly 33⅓ or 45.",
  body: stage,
};
const out = theme === "light" ? "turntable-light.html" : "turntable.html";
writeFileSync(join(HERE, out), k.pageHtml({ title: "DJ turntable", theme, body: `<style>${CSS}</style>${k.plateHtml(card)}`, script: kitScript() + "\n" + glScript() + "\n" + inlined + "\n" + LIVE.replace("__DATA__", JSON.stringify(DATA)) }));
console.log("wrote", out);
