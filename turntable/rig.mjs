// The truth of the turntable: pure numbers, no drawing. Units are millimetres.
export const SPINDLE = [-50, 0];
export const PIVOT = [168, -100];
export const ARM_L = 250; // pivot to stylus (effective length)
export const R_OUT = 152.4; // 12 inch record
export const R_LABEL = 50;
export const R_INNER = 58; // last groove
export const R_FIRST = 146; // first groove
export const PER_REV = 0.115; // mm the groove advances per turn
export const GAPS = [128, 106, 84]; // smooth rings between tracks
export const FLASH = 100; // strobe lamp on 50 Hz mains flashes twice per cycle
export const ROWS = [
  { n: 180, rpm: 100 / 3 },
  { n: 133, rpm: 45 },
];
export const PITCH = 8; // fader range, percent
export const REC_TOP = 54.2;

const hypot = Math.hypot;
export const PIVOT_TO_SPINDLE = hypot(SPINDLE[0] - PIVOT[0], SPINDLE[1] - PIVOT[1]);
export const PHI_SPINDLE = Math.atan2(SPINDLE[1] - PIVOT[1], SPINDLE[0] - PIVOT[0]);
export const PHI_REST = (104 * Math.PI) / 180;

const clampTo = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// direction of the arm (from the pivot) when the stylus sits at radius r
export function armAngle(r) {
  const d = PIVOT_TO_SPINDLE;
  const c = (d * d + ARM_L * ARM_L - r * r) / (2 * d * ARM_L);
  return PHI_SPINDLE - Math.acos(clampTo(c, -1, 1));
}
export function radiusOf(phi) {
  const d = PIVOT_TO_SPINDLE;
  const b = PHI_SPINDLE - phi;
  return Math.sqrt(Math.max(0, d * d + ARM_L * ARM_L - 2 * d * ARM_L * Math.cos(b)));
}
export const tipOf = (phi) => [PIVOT[0] + Math.cos(phi) * ARM_L, PIVOT[1] + Math.sin(phi) * ARM_L];

export const rpmOf = (speed, pitch) => (speed === 45 ? 45 : 100 / 3) * (1 + pitch / 100);
export const grooveSpeed = (r, rpm) => 2 * Math.PI * (r / 1000) * (rpm / 60) * 100; // cm/s
export function trackOf(r) {
  if (r > GAPS[0]) return 1;
  if (r > GAPS[1]) return 2;
  if (r > GAPS[2]) return 3;
  return 4;
}
// how fast a strobe row seems to drift, in dots per second (folded into +-50)
export function drift(row, rpm) {
  const raw = row.n * (rpm / 60) - FLASH;
  return ((((raw + FLASH / 2) % FLASH) + FLASH) % FLASH) - FLASH / 2;
}
export const fmtPitch = (p) => (p >= 0 ? "+" : "−") + Math.abs(p).toFixed(1) + "%";
