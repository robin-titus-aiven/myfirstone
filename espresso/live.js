const D = __DATA__;
const FRAG_A = __FRAG_A__;
const FRAG_B = __FRAG_B__;
const stage = document.querySelector(".es-stage");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const shells = { right: stage.querySelector('[data-shell="right"]'), top: stage.querySelector('[data-shell="top"]'), fascia: stage.querySelector('[data-shell="fascia"]') };
const closedBoiler = stage.querySelector('[data-x="closed"]'), cutBoiler = stage.querySelector('[data-x="cut"]');
const leverG = stage.querySelector("[data-lever]");
const needles = { steam: stage.querySelector('[data-needle="steam"]'), pump: stage.querySelector('[data-needle="pump"]') };
const pipes = {};
stage.querySelectorAll("[data-pipe]").forEach((el) => { pipes[el.dataset.pipe] = el; });
const portaGhost = stage.querySelector('[data-ghost]');
const tankLevel = stage.querySelector(".es-water");
const P_ = D.P;
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------- parts the reader can pick ----------------
const PARTS = [
  ["tank", "Water tank", "Holds about 2 litres of cold water. The slot on its side shows how much is left."],
  ["pump", "Vibratory pump", "A coil pulls a piston in, a spring pushes it out, fifty times a second. It can push about 15 bar."],
  ["opv", "Over-pressure valve", "Opens above 9 bar and lets the extra water run back to the tank, so the coffee always sees 9."],
  ["boiler", "Boiler", "Holds about 1.5 litres of water at 1.1 bar, which is 121 °C, so steam is always on tap."],
  ["element", "Heating element", "A 1.4 kW coil in the water. It glows while it heats and boils the water at the tube's surface."],
  ["hx", "Heat-exchanger tube", "Fresh cold water takes a trip through a tube inside the hot boiler and comes out ready to brew."],
  ["thermo", "Thermosyphon loop", "Hot water rises up one pipe into the group and cooler water sinks back down the other. No pump needed."],
  ["group", "E61 group head", "A heavy brass block kept hot by the loop, so the first shot is as hot as the tenth."],
  ["valve", "Three-way valve", "Sends water down to the coffee, or opens the coffee to the drip tray to let the pressure go."],
  ["lever", "Brew lever", "Lifts a cam: it opens the valve and switches the pump on. Lift it, and the shot begins."],
  ["portafilter", "Portafilter", "Holds 18 g of ground coffee, tamped flat. Nine bar pushes water through it in about 28 seconds."],
  ["gauges", "Pressure gauges", "Left: the boiler, about 1.1 bar. Right: the pump, 9 bar while a shot runs."],
  ["steam", "Steam valve and wand", "Opens the boiler's steam to the wand, for heating and frothing milk."],
  ["pressurestat", "Pressurestat", "A bellows switch: it cuts the element at 1.2 bar and turns it back on at 0.9."],
  ["tray", "Drip tray", "Catches the spills, and the water the three-way valve lets out after each shot."],
];

// ---------------- state ----------------
const st = {
  xray: { x: 0, v: 0 }, xrayT: 0,
  shot: { on: false, t: 0, lever: { x: -40, v: 0 }, since: 0, pump: { x: 0, v: 0 } },
  steam: { x: 0, v: 0 }, steamT: 0,
  boiler: { p: 1.04, on: true }, heat: { x: 1, v: 0 }, boil: { x: 0.4, v: 0 },
  front: { x: 0, v: 0 }, stream: { x: 0, v: 0 }, yieldG: 0,
  focus: null, hover: null,
};
let clock = 0, last = 0, frame = 0, visible = false, touring = true, tourAt = 0, tourClock = 0, idleTimer = 0;
const SPEEDUP = 3; // the shot runs three times faster than life

// ---------------- WebGL ----------------
const layerA = glLayer({
  canvas: stage.querySelector(".es-gl"), fragment: FRAG_A, view: [D.W, D.H], camera: D.camera,
  uniforms: ["uX", "uHeat", "uFront", "uBoil", "uYield", "uStream", "uQ", "uG", "uF"],
  fixed: {
    uLit: D.light, uB: [D.XC, D.ZC, D.BR, D.WATER], uY: [D.BY0, D.BY1, D.cupRim, D.cupBase],
    uP: [0, D.cupY, 26.5, 191], uC: [D.cups[0], D.cups[1], D.cupY, D.cupRIn], uS: [D.spouts[0], D.spouts[1], D.spoutZ, 1.7],
  },
});
const layerB = glLayer({ canvas: stage.querySelector(".es-gl-top"), fragment: FRAG_B, view: [D.W, D.H], camera: D.camera, uniforms: ["uSteam"], fixed: { uLit: D.light, uTip: D.tip } });
if (layerA) stage.setAttribute("data-gl", "");

// ---------------- controls ----------------
const setXray = (v) => { st.xrayT = v; };
const pullShot = () => { if (st.shot.on) stopShot(); else { st.shot.on = true; st.shot.t = 0; } };
const stopShot = () => { st.shot.on = false; };
const toggleSteam = () => { st.steamT = st.steamT > 0 ? 0 : 1; };

const TOUR = [
  [1.6, () => setXray(1)],
  [4.2, () => pullShot()],
  [13.8, () => { if (st.shot.on) stopShot(); }],
  [15.6, () => toggleSteam()],
  [20.4, () => toggleSteam()],
  [22.6, () => setXray(0)],
  [26.0, () => {}],
];

// ---------------- the world, once per frame ----------------
function stepModel(dt, calm) {
  settle(st.xray, st.xrayT, dt, 0.7, calm);
  // shot
  const sh = st.shot;
  if (sh.on) {
    sh.t += dt * SPEEDUP;
    if (sh.t >= SHOT) stopShot();
  }
  settle(sh.lever, sh.on ? 28 : -40, dt, sh.on ? 0.18 : 0.35, calm);
  const wantPump = sh.on ? pressureAt(sh.t) : 0;
  settle(sh.pump, wantPump, dt, sh.on ? 0.25 : 0.35, calm);
  const flowing = sh.on && sh.t > 0.4;
  st.yieldG = sh.on || sh.t > 0 ? yieldAt(Math.min(sh.t, SHOT)) : 0;
  if (!sh.on && sh.pump.x < 0.02 && sh.t >= SHOT) { /* keep the cup full until the next shot */ }
  const vol = sh.t < FIRST_DROP ? 14 * (sh.t / FIRST_DROP) : 14 + yieldAt(sh.t);
  settle(st.front, sh.on ? clampN(vol / 62, 0, 1) : 0, dt, sh.on ? 0.3 : 6, calm);
  settle(st.stream, sh.on && sh.t > FIRST_DROP ? 1 : 0, dt, sh.on ? 0.25 : 1.4, calm);
  // steam
  settle(st.steam, st.steamT, dt, st.steamT ? 0.8 : 1.2, calm);
  // boiler: pressure and the pressurestat
  const b = st.boiler;
  b.p += dt * (b.on ? 0.0125 : -0.005) - dt * st.steam.x * 0.03 - dt * (sh.on ? 0.002 : 0);
  b.p = clampN(b.p, 0.5, 1.4);
  if (b.on && b.p >= BOILER_HIGH) b.on = false;
  else if (!b.on && b.p <= BOILER_LOW) b.on = true;
  settle(st.heat, b.on ? 1 : 0, dt, 1.1, calm);
  settle(st.boil, b.on ? 1 : 0.18 + 0.4 * st.steam.x, dt, 1.4, calm);
  return flowing;
}

// ---------------- drawing ----------------
let drawn = { lever: null };
function draw(calm, flowing) {
  const x = st.xray.x;
  const ghost = 1 - 0.93 * x;
  shells.right.style.opacity = ghost; shells.right.setAttribute("transform", translateAlong(P_, [30 * x, 0, 0]));
  shells.top.style.opacity = ghost; shells.top.setAttribute("transform", translateAlong(P_, [0, 0, 46 * x]));
  shells.fascia.style.opacity = ghost;
  const pe = x > 0.5 ? "none" : "auto";
  shells.right.style.pointerEvents = pe; shells.top.style.pointerEvents = pe; shells.fascia.style.pointerEvents = pe;
  closedBoiler.style.opacity = 1 - clampN(x * 3, 0, 1); cutBoiler.style.opacity = clampN(x * 2 - 0.3, 0, 1);
  // lever and gauges
  const la = Math.round(st.shot.lever.x * 10) / 10;
  if (la !== drawn.lever) { drawn.lever = la; leverG.innerHTML = leverSvg(P_, la); }
  needles.steam.setAttribute("d", needleD(P_, D.gauges.steam[0], D.gauges.steam[1], gaugeAngle(st.boiler.p / 2)));
  needles.pump.setAttribute("d", needleD(P_, D.gauges.pump[0], D.gauges.pump[1], gaugeAngle(st.shot.pump.x / 16)));
  // water in the pipes
  const set = (id, o) => { if (pipes[id]) pipes[id].style.opacity = o.toFixed(2); };
  const pumpOn = clampN(st.shot.pump.x / 2, 0, 1) * (x > 0.1 ? 1 : 0.0) + 0;
  set("p1", clampN(st.shot.pump.x, 0, 1) * clampN(x * 2, 0, 1));
  set("p2", clampN(st.shot.pump.x, 0, 1) * clampN(x * 2, 0, 1));
  set("p3", clampN((st.shot.pump.x - 8.2) * 4, 0, 1) * clampN(x * 2, 0, 1));
  set("h1", clampN(st.shot.pump.x, 0, 1) * clampN(x * 2, 0, 1));
  set("t1", 0.8 * clampN(x * 2, 0, 1)); set("t2", 0.7 * clampN(x * 2, 0, 1));
  set("s1", clampN(st.steam.x * 1.5, 0, 1) * clampN(x * 2, 0, 1)); set("s2", 0.0);
  tankLevel.setAttribute("opacity", "1");
  // shaders
  const wet = st.shot.on ? clampN(st.shot.t / FIRST_DROP, 0, 1) : (st.shot.t >= SHOT ? 1 : 0);
  portaGhost.style.opacity = 1 - 0.88 * x;
  const onCanvas = !st.focus || ["boiler", "hx", "element", "portafilter", "tray"].includes(st.focus);
  stage.querySelector(".es-gl").style.opacity = onCanvas ? 1 : 0.18;
  if (layerA) layerA.draw({ uX: x, uHeat: st.heat.x, uFront: st.front.x, uBoil: st.boil.x * (x > 0.01 ? 1 : 0), uYield: clampN(st.yieldG / YIELD, 0, 1), uStream: st.stream.x, uQ: [201, 219, wet, clampN(st.shot.pump.x / 9, 0, 1)], uG: x * (st.focus && st.focus !== "portafilter" ? 0.2 : 1), uF: st.focus === "boiler" ? 1 : st.focus === "hx" ? 2 : st.focus === "element" ? 3 : 0 }, calm ? 0.8 : clock);
  if (layerB) layerB.draw({ uSteam: st.steam.x }, calm ? 0.8 : clock);
  // readout
  const sh = st.shot;
  let said;
  if (sh.on) said = "shot " + sh.t.toFixed(0) + " s · " + sh.pump.x.toFixed(1) + " bar · " + BREW_C + " °C · " + st.yieldG.toFixed(0) + " g";
  else if (st.steam.x > 0.15) said = "steam · boiler " + st.boiler.p.toFixed(2) + " bar · " + satC(st.boiler.p).toFixed(0) + " °C";
  else said = "boiler " + st.boiler.p.toFixed(2) + " bar · " + satC(st.boiler.p).toFixed(0) + " °C · element " + (st.boiler.on ? "on" : "off");
  if (st.hover) said = st.hover;
  if (readout.textContent !== said) readout.textContent = said;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  clock += dt;
  if (touring) {
    tourClock += dt;
    while (tourAt < TOUR.length && tourClock >= TOUR[tourAt][0]) TOUR[tourAt++][1]();
    if (tourAt >= TOUR.length) { tourAt = 0; tourClock = 0; }
  }
  const flowing = stepModel(dt, calm);
  draw(calm, flowing);
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const handOver = () => { touring = false; clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; tourAt = 0; tourClock = 0; run(); }, 14000); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;

// ---------------- the UI below the card ----------------
const ui = document.querySelector(".es-ui");
const note = ui.querySelector(".es-note");
const list = ui.querySelector(".es-parts");
const slider = ui.querySelector("input[type=range]");
PARTS.forEach(([id, name]) => {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = name; b.dataset.id = id;
  list.appendChild(b);
});
function focusPart(id, sticky) {
  st.focus = id;
  stage.toggleAttribute("data-focus", !!id);
  stage.querySelectorAll("[data-part]").forEach((el) => el.toggleAttribute("data-on", el.dataset.part === id));
  list.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
  const info = PARTS.find((p) => p[0] === id);
  note.textContent = info ? info[1] + ". " + info[2] : "Pick a part to light it up, or pull the lever to watch them all work.";
  if (id && id !== "lever" && id !== "gauges" && id !== "portafilter" && id !== "group" && id !== "valve" && id !== "steam" && id !== "tray") { if (sticky) { setXray(1); slider.value = "1"; } }
}
list.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; handOver(); focusPart(st.focus === b.dataset.id ? null : b.dataset.id, true); });
slider.addEventListener("input", () => { handOver(); setXray(+slider.value); });
ui.querySelector("[data-act=shot]").addEventListener("click", () => { handOver(); pullShot(); });
ui.querySelector("[data-act=steam]").addEventListener("click", () => { handOver(); toggleSteam(); });
focusPart(null);

// ---------------- pointer and keys ----------------
stage.addEventListener("pointerover", (e) => {
  const el = e.target.closest && e.target.closest("[data-part]");
  const id = el && el.dataset.part;
  const info = id && PARTS.find((p) => p[0] === id);
  st.hover = info ? info[1] : null;
  stage.style.cursor = info ? "pointer" : "default";
});
stage.addEventListener("pointerleave", () => { st.hover = null; });
stage.addEventListener("click", (e) => {
  handOver();
  const sh = e.target.closest && e.target.closest("[data-shell]");
  if (sh) { setXray(st.xrayT > 0.5 ? 0 : 1); slider.value = String(st.xrayT); return; }
  const el = e.target.closest && e.target.closest("[data-part]");
  const id = el && el.dataset.part;
  if (id === "lever") pullShot();
  else if (id === "steam") toggleSteam();
  else if (id) focusPart(st.focus === id ? null : id, false);
});
stage.addEventListener("keydown", (e) => {
  const k = e.key;
  if (k === " " || k === "Enter" || k === "b" || k === "B") pullShot();
  else if (k === "s" || k === "S") toggleSteam();
  else if (k === "x" || k === "X") { setXray(st.xrayT > 0.5 ? 0 : 1); slider.value = String(st.xrayT); }
  else if (k === "Escape") focusPart(null);
  else return;
  e.preventDefault();
  handOver();
});

window.__es = { st, setX: (v) => { st.xrayT = v; st.xray.x = v; } };
draw(true, false);
run();
