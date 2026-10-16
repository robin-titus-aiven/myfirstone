// Geometry rebuilt while the page runs (and once, at rest, by the build).
import { iso, solidSvg, pathOf } from "/root/.claude/skills/anatomy/kit/iso-kit.mjs";
import { frameOf, prismOf, stadium, sphereOf } from "/root/.claude/skills/anatomy/kit/lathe.mjs";

export const GX = 0, GY = 185, FASCIA_Y = 150;
export const gaugeAngle = (frac) => 225 - 270 * Math.max(0, Math.min(1, frac)); // degrees, from the lower left clockwise

// the brew lever pivots about x on the cam shaft; angle 0 points straight at the viewer along +y
export function leverSvg(P, angle) {
  const F = frameOf([GX + 44, GY, 268], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const a = (angle * Math.PI) / 180, len = 74;
  const poly = stadium(6, 4, len, 20).map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
  return solidSvg(prismOf(F, poly, 0, 8, P), { tone: "hi", lit: true }) + solidSvg(sphereOf([GX + 49, GY + (len + 6) * Math.cos(a), 268 + (len + 6) * Math.sin(a)], 8, P), { tone: "hi" });
}

export function needleD(P, x, z, deg) {
  const a = (deg * Math.PI) / 180;
  return pathOf([iso([x - 4 * Math.cos(a), FASCIA_Y + 8.2, z - 4 * Math.sin(a)], P), iso([x + 17 * Math.cos(a), FASCIA_Y + 8.2, z + 17 * Math.sin(a)], P)]);
}
