// Geometry that is rebuilt while the page runs (and once, at rest, by the build).
import { iso, depthOf, extrude, cylinder, solidSvg, lineSvg, dotsSvg, onTop, faceTextSvg, circleRing, sideArc, segment } from "/root/.claude/skills/anatomy/kit/iso-kit.mjs";
import { disc, frameAlong } from "/root/.claude/skills/anatomy/kit/lathe.mjs";
import { PIVOT, SPINDLE, ARM_L, REC_TOP, ROWS, R_LABEL } from "./rig.mjs";

const SOLID = (paths, style) => solidSvg(paths, style);
const TWO_PI = Math.PI * 2;

export const PLATTER = { r: 166, z0: 34, z1: 50 };
export const ARM_Z = 64; // underside of the arm tube

// ---- tonearm -------------------------------------------------------------
export function armSvg(P, { phi, lift }) {
  const ux = Math.cos(phi), uy = Math.sin(phi);
  const at = (s, w = 0) => [PIVOT[0] + ux * s - uy * w, PIVOT[1] + uy * s + ux * w];
  const quad = (s0, s1, w0, w1) => [at(s0, -w0), at(s1, -w1), at(s1, w1), at(s0, w0)];
  const Z = ARM_Z + lift;
  const L = ARM_L;
  const rank = (s) => depthOf([...at(s), Z], P);
  const groups = [];

  // rear: stub and counterweight
  const rear = [];
  rear.push(SOLID(extrude(quad(-36, -12, 2.2, 2.6), Z, 6, P, { bevel: 0.3 }), { tone: "mid" }));
  const F = frameAlong([...at(-36), Z + 3], [ux, uy, 0]);
  rear.push(SOLID(disc(-34, -6, 13, F, P, { steps: 44 }), { tone: "mid" }));
  rear.push(SOLID(disc(-6, -2, 11, F, P, { steps: 36 }), { tone: "lo" }));
  groups.push({ at: -34, html: rear.join("") });

  // tube and the signal wire running along it
  const tube = [];
  tube.push(SOLID(extrude(quad(-12, L - 32, 3.4, 2.4), Z, 6, P, { bevel: 0.3 }), { tone: "mid" }));
  const wire = [at(-4), at(L - 36)].map(([x, y]) => iso([x, y, Z + 6.05], P));
  tube.push(lineSvg(`M${wire[0].join(" ")}L${wire[1].join(" ")}`, { tone: "lo", flow: true, className: "tt-wire" }));
  tube.push(dotsSvg(wire, { size: 0.55, tone: "hi" }));
  groups.push({ at: L * 0.4, html: tube.join("") });

  // head: cartridge under the headshell, finger lift beside it
  const head = [];
  head.push(SOLID(extrude(quad(L - 24, L - 4, 7.4, 7.4), Z - 9.8, 9.8, P, { bevel: 0.3 }), { tone: "mid" }));
  head.push(SOLID(extrude(quad(L - 35, L - 3, 3.4, 9), Z, 4, P, { bevel: 0.4 }), { tone: "mid" }));
  head.push(SOLID(extrude(quad(L - 30, L - 24, 9, 16), Z, 2, P), { tone: "mid", crease: "none" }));
  const screws = [at(L - 12, -5.6), at(L - 12, 5.6)].map(([x, y]) => iso([x, y, Z + 4], P));
  head.push(dotsSvg(screws, { size: 0.55, tone: "hi" }));
  head.push(lineSvg(onTop([at(L - 18, -5), at(L - 6, -5), at(L - 6, 5), at(L - 18, 5)], Z + 4, P, true), { tone: "faint" }));
  // cantilever and stylus: the one lit part
  const tip = [...at(L), REC_TOP + lift];
  const root = [...at(L - 5), Z - 9.8];
  head.push(lineSvg(segment(root, tip, P), { tone: "lit", free: "start" }));
  head.push(dotsSvg([iso(tip, P)], { size: 0.9, tone: "hi" }));
  groups.push({ at: L - 10, html: head.join("") });

  groups.sort((a, b) => rank(a.at) - rank(b.at));
  const cap = SOLID(cylinder(PIVOT[0], PIVOT[1], 5.5, ARM_Z + lift + 6, 3, P, 24, 0.3), { tone: "mid" });
  return groups.map((g) => g.html).join("") + cap;
}

// ---- the record label, turning -------------------------------------------
export function labelSvg(P, rev) {
  const [cx, cy] = SPINDLE;
  const z = REC_TOP + 0.4;
  const th = rev * TWO_PI;
  const R = (x, y) => [cx + x * Math.cos(th) - y * Math.sin(th), cy + x * Math.sin(th) + y * Math.cos(th)];
  const out = [];
  // three printed rules (stand for text), an arrow pip and two cut marks
  for (const [a, b, y] of [[-20, 20, 21], [-14, 14, 27], [-17, 17, 33]]) out.push(lineSvg(onTop([R(a, y), R(b, y)], z, P), { tone: "faint", free: true }));
  const ticks = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TWO_PI + th;
    const r0 = i % 6 === 0 ? 40 : 43;
    ticks.push(onTop([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * 46.5, cy + Math.sin(a) * 46.5]], z, P));
  }
  out.push(lineSvg(ticks.join(""), { tone: "lo", free: "start" }));
  const O = iso([cx, cy, z], P);
  const ex = iso([cx + Math.cos(th), cy + Math.sin(th), z], P);
  const ey = iso([cx - Math.sin(th), cy + Math.cos(th), z], P);
  const at = R(0, -29);
  const o = iso([at[0], at[1], z], P);
  const ux = [ex[0] - O[0], ex[1] - O[1]], uy = [ey[0] - O[0], ey[1] - O[1]];
  out.push(faceTextSvg(`matrix(${ux[0].toFixed(3)} ${ux[1].toFixed(3)} ${uy[0].toFixed(3)} ${uy[1].toFixed(3)} ${o[0].toFixed(2)} ${o[1].toFixed(2)})`, "A", { size: 15, tone: "hi", anchor: "middle" }));
  const pip = R(0, 12);
  out.push(dotsSvg([iso([pip[0], pip[1], z], P)], { size: 0.8, tone: "hi" }));
  return out.join("");
}

// ---- strobe dots on the platter's rim --------------------------------------
export function strobeSvg(P, phases, alphas) {
  const [cx, cy] = SPINDLE;
  const dir = [Math.cos((P.azimuth * Math.PI) / 180), Math.sin((P.azimuth * Math.PI) / 180)];
  const zs = [PLATTER.z0 + 11, PLATTER.z0 + 5];
  return ROWS.map((row, index) => {
    const pts = [];
    for (let i = 0; i < row.n; i++) {
      const a = ((i + phases[index]) / row.n) * TWO_PI;
      const nx = Math.cos(a), ny = Math.sin(a);
      if (nx * dir[0] + ny * dir[1] < 0.04) continue;
      const [sx, sy] = iso([cx + nx * PLATTER.r, cy + ny * PLATTER.r, zs[index]], P);
      pts.push([sx, sy, alphas[index]]);
    }
    return dotsSvg(pts, { size: 0.5, tone: index ? "mid" : "hi" });
  }).join("");
}

// ---- coils round the stator -----------------------------------------------
export const COILS = 12;
export const COIL_R = 138;
