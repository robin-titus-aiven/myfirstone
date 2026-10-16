// The truth of an E61 heat-exchanger espresso machine. Pure numbers, millimetres and bar.
export const DOSE = 18; // g of ground coffee in the basket
export const YIELD = 36; // g in the cup (1:2)
export const SHOT = 28; // s, whole shot
export const FIRST_DROP = 8; // s, until the puck lets water through
export const PUMP_BAR = 9; // the over-pressure valve opens here
export const BREW_C = 93; // water temperature at the puck
export const BOILER_LOW = 0.9, BOILER_HIGH = 1.2; // bar, the pressurestat's band
export const PUMP_HZ = 50;
export const PRE_INFUSION = 4; // s of low pressure before 9 bar

// saturated steam temperature (deg C) at a gauge pressure in bar (Antoine, over 1 bar abs)
export function satC(gauge) {
  const mmHg = (gauge + 1.01325) * 750.062;
  return 1730.63 / (8.07131 - Math.log10(mmHg)) - 233.426;
}
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// pump pressure over the shot (bar): a ramp over the pre-infusion, then held at 9 by the OPV, then falls when the lever drops
export const pressureAt = (t) => (t < 0 ? 0 : PUMP_BAR * (0.28 + 0.72 * sm(PRE_INFUSION, PRE_INFUSION + 3, t)) * sm(0, 0.8, t));
// grams in the cup: nothing until the first drop, then close to steady flow
export function yieldAt(t) {
  if (t <= FIRST_DROP) return 0;
  const s = Math.min(1, (t - FIRST_DROP) / (SHOT - FIRST_DROP));
  return YIELD * (s * (1.1 - 0.1 * s));
}
export const fmt = (x, n = 1) => x.toFixed(n);
