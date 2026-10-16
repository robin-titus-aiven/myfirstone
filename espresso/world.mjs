import * as k from "/root/.claude/skills/anatomy/kit/iso-kit.mjs";
export const W = 640, H = 600;
export const BODY = { x: -136, y: -172, w: 272, d: 325 };
export const PAN = { x: -140, y: -176, w: 280, d: 332, r: 10 };
export const XC = -10, ZC = 250, BR = 54, BY0 = -100, BY1 = 120;
export const GROUP = [0, 185];
export const G_Z0 = 222;
export const FASCIA_Z = 210, TOP_Z = 346;
export const P = k.fitProjection(
  [...k.boxCorners(PAN, -12, 0), [0, 335, 190], [160, 150, 300], [-136, -172, 410], [136, -172, 410], [-136, 150, 410], [166, 150, 410], [190, 140, 110], [170, 140, 260]],
  W, H, { pad: 14, azimuth: 40, elevation: 38 },
);
