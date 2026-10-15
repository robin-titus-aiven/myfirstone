const D = __DATA__;
const stage = document.querySelector(".tt-stage");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const $part = (name) => stage.querySelector(`[data-part="${name}"]`);
const armG = $part("arm"), labelG = $part("label"), strobeG = $part("strobe"), faderG = $part("fader"), cueG = $part("cue");
const coils = [...stage.querySelectorAll("[data-coil]")].map((g) => ({ g, i: +g.dataset.coil, edge: g.querySelector(".iso-edge"), wind: g.querySelector(".tt-wind"), tone: "" }));
const led = (key) => stage.querySelector(`[data-led="${key}"] .iso-dots`);
const LEDS = { power: led("power"), 33: led("33"), 45: led("45") };
const WTAU = Math.PI * 2;
const PIV = D.pivot;
const HEIGHT_OVER = 3.2 + (ARM_Z - REC_TOP); // arm axis above the record plane

// ---------------- the shader: fixed sheen, turning dust, the arm's shadow ----------------
const FRAGMENT = `
uniform float uRev;uniform vec2 uPiv;uniform vec2 uTip;uniform float uH;uniform float uLit;
uniform vec2 uC;uniform vec3 uRad;uniform vec3 uGap;
const float TAU=6.2831853;
float lobe(vec3 T,vec3 Lv,vec3 V,float shin){vec3 H=normalize(Lv+V);float t=dot(T,H);return pow(sqrt(max(0.,1.-t*t)),shin);}
float gapOf(float r){
  float g=0.;
  for(int i=0;i<3;i++){g=max(g,1.-smoothstep(.9,2.7,abs(r-uGap[i])));}
  g=max(g,smoothstep(uRad.y-6.2,uRad.y-4.4,r));
  g=max(g,1.-smoothstep(uRad.x+4.,uRad.x+9.,r));
  return g;
}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  float px=pixelOf()/uCam.z;
  vec3 p=onFloor(vb,uRad.z);
  vec2 q=p.xy-uC;
  float r=length(q);
  float m=smoothstep(uRad.x+.4,uRad.x+.4+1.2*px,r)*(1.-smoothstep(uRad.y-.4-1.2*px,uRad.y-.4,r));
  if(m<=0.){gl_FragColor=vec4(0.);return;}
  vec2 d=q/max(r,1e-3);
  vec3 T=vec3(-d.y,d.x,0.);
  vec3 V=towardViewer();
  float gap=gapOf(r);
  float wob=fbm2(vec2(r*.35,3.1));
  float grv=1.-.7*gap;
  vec3 L1=lightDir();
  vec3 L2=normalize(vec3(.62,-.55,.5));
  float a1=lobe(T,L1,V,130.)*smoothstep(0.,.3,L1.z);
  float a2=lobe(T,L2,V,90.)*smoothstep(0.,.3,L2.z);
  float broad=lobe(T,L1,V,16.)*.07+lobe(T,L2,V,14.)*.04;
  float period=2.6;
  float fine=sin(r*TAU/period+wob*6.);
  float amp=.2*smoothstep(1.2,3.2,period/px)*(1.-gap);
  float ring=1.+amp*fine;
  float th=-uRev*TAU;
  vec2 rf=vec2(q.x*cos(th)-q.y*sin(th),q.x*sin(th)+q.y*cos(th));
  vec2 cell=floor(rf/6.);vec2 f=fract(rf/6.);
  vec2 cp=.2+.6*vec2(hash12(cell+7.3),hash12(cell+3.7));
  float speck=step(.955,hash12(cell))*(1.-smoothstep(.15,1.,length((f-cp)*6.)));
  vec2 sh=-L1.xy/L1.z;
  vec2 A=uPiv+sh*uH;vec2 B=uTip+sh*uH;vec2 ba=B-A;
  float t=clamp(dot(q+uC-A,ba)/dot(ba,ba),0.,1.);
  float dist=length(q+uC-A-ba*t);
  float hw=mix(3.4,9.5,smoothstep(.84,.98,t));
  float pen=1.4+.32*uH;
  float shadow=1.-smoothstep(hw-pen*.3,hw+pen,dist);
  float lit=a1+a2;
  float refl=.035+.025*wob+(a1*.85+a2*.45)*grv*ring+broad*grv;
  refl+=speck*(.2+1.8*lit)*(1.-gap);
  vec4 outc;
  if(uLit<.5){
    float vis=1.-.85*shadow;
    vec3 col=tonemap(refl*vis*vec3(.92,.95,1.),1.5);
    float a=max(col.r,max(col.g,col.b));
    a+=(hash12(gl_FragCoord.xy+uTime)-.5)/255.*step(.004,a);
    outc=vec4(col*m/max(a,1e-3)*a,a*m);
  }else{
    float ink=clamp(.82-.9*refl,0.,.82);
    ink=mix(ink,.9,shadow*.5);
    outc=vec4(vec3(.09,.10,.13)*ink*m,ink*m);
  }
  gl_FragColor=outc;
}`;
const layer = glLayer({
  canvas: stage.querySelector(".tt-gl"), fragment: FRAGMENT, view: [D.W, D.H], camera: D.camera,
  uniforms: ["uRev", "uPiv", "uTip", "uH"],
  fixed: { uLit: D.light, uC: D.S, uRad: [D.rLabel, D.rOut, D.recZ], uGap: D.gaps },
});
if (layer) stage.setAttribute("data-gl", "");

// ---------------- state ----------------
const st = {
  on: false, speed: 33, pitchT: 0, pitch: { x: 0, v: 0 }, rev: 0, w: { x: 0, v: 0 },
  phi: { x: PHI_REST, v: 0 }, phiT: PHI_REST, lift: { x: 12, v: 0 }, down: false,
  strobe: [0, 0], armKey: "", drawnStrobe: "", leds: {}, coilTones: [],
};
let clock = 0, last = 0, frame = 0, visible = false, touring = true, tourAt = 0, tourClock = 0, idleTimer = 0;
const rpmNow = () => st.w.x * 60;
const radiusNow = () => radiusOf(st.phi.x);
const onRecord = (r) => r >= R_INNER - 1 && r <= R_FIRST + 4;

// ---------------- controls (shared by the tour, the pointer and the keys) ----------------
const power = (on) => { st.on = on; };
const setSpeed = (s) => { st.speed = s; };
const setPitch = (p) => { st.pitchT = clampTo(Math.abs(p) < 0.2 ? 0 : p, -PITCH, PITCH); };
const dropAt = (r) => { st.phiT = armAngle(clampTo(r, R_INNER, R_FIRST + 1)); st.down = true; };
const toRest = () => { st.phiT = PHI_REST; st.down = false; };
const cue = () => { if (st.down) st.down = false; else if (onRecord(radiusOf(st.phiT))) st.down = true; };

const TOUR = [
  [0.4, () => power(true)],
  [1.8, () => dropAt(145)],
  [5.2, () => setPitch(4)],
  [8.0, () => setPitch(-5)],
  [10.0, () => { setPitch(0); setSpeed(45); }],
  [12.4, () => dropAt(110)],
  [16.4, () => setPitch(2.5)],
  [18.6, () => toRest()],
  [20.4, () => { setSpeed(33); setPitch(0); power(false); }],
  [23.5, () => {}],
];

// ---------------- drawing ----------------
function floorAt(vx, vy, z) {
  const c = cameraOf(P_);
  const u = (vx - P_.origin[0]) / c.k;
  const b = ((vy - P_.origin[1]) / c.k + z * c.cosE) / c.sinE;
  return [u * c.sinA + b * c.cosA, -u * c.cosA + b * c.sinA];
}
const P_ = D.P;
const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };
const setTone = (el, tone) => { if (el && el.getAttribute("data-tone") !== tone) el.setAttribute("data-tone", tone); };

function draw(calm) {
  const rpm = rpmNow();
  const r = radiusNow();
  const touching = st.lift.x < 1.2 && onRecord(r);
  // arm and cue lever
  const key = st.phi.x.toFixed(4) + "|" + st.lift.x.toFixed(2);
  if (key !== st.armKey) { st.armKey = key; armG.innerHTML = armSvg(P_, { phi: st.phi.x, lift: st.lift.x }); }
  cueG.setAttribute("transform", translateAlong(P_, [0, 0, (st.lift.x / 12) * 4]));
  // label turning with the record
  labelG.innerHTML = labelSvg(P_, st.rev % 1);
  // pitch fader
  faderG.setAttribute("transform", translateAlong(P_, [0, -(st.pitch.x * D.fader.span) / PITCH, 0]));
  // strobe: the dots only show how far the speed is from exact
  const alphas = ROWS.map((row) => (st.w.x > 0.02 ? 0.3 + 0.7 * (1 - smooth(4, 16, Math.abs(drift(row, rpm)))) : 0.35));
  const sk = st.strobe.map((p) => p.toFixed(2)).join() + alphas.map((a) => a.toFixed(2)).join();
  if (sk !== st.drawnStrobe) { st.drawnStrobe = sk; strobeG.innerHTML = strobeSvg(P_, st.strobe, alphas); }
  // stator coils: the field circles with the platter
  coils.forEach((c) => {
    const wgt = st.w.x > 0.02 ? 0.5 + 0.5 * Math.cos(WTAU * ((c.i + 0.5) / COILS - st.rev)) : 0;
    const tone = wgt > 0.85 ? "hi" : wgt > 0.5 ? "mid" : "faint";
    if (tone !== c.tone) { c.tone = tone; if (tone === "hi") c.g.setAttribute("data-on", ""); else c.g.removeAttribute("data-on"); setTone(c.edge, tone === "faint" ? "lo" : tone); setTone(c.wind, tone); }
  });
  const lampOn = st.w.x > 0.02;
  setTone(LEDS.power, st.on ? "hi" : "faint");
  setTone(LEDS[33], st.speed === 33 ? "hi" : "faint");
  setTone(LEDS[45], st.speed === 45 ? "hi" : "faint");
  // shader
  if (layer) {
    const tip = tipOf(st.phi.x);
    layer.draw({ uRev: st.rev % 1, uPiv: PIV, uTip: tip, uH: HEIGHT_OVER + st.lift.x }, calm ? 0.8 : clock);
  }
  // card readout
  const nom = st.speed === 45 ? "45" : "33\u2153";
  let said;
  if (st.w.x < 0.004) said = "stopped \u00b7 " + nom + " " + fmtPitch(st.pitch.x);
  else if (touching) said = rpm.toFixed(1) + " rpm " + fmtPitch(st.pitch.x) + " \u00b7 " + r.toFixed(0) + " mm \u00b7 " + grooveSpeed(r, rpm).toFixed(0) + " cm/s";
  else said = rpm.toFixed(1) + " rpm " + fmtPitch(st.pitch.x) + (st.down ? " \u00b7 moving" : " \u00b7 needle up");
  text(readout, said);
  stage.setAttribute("aria-description", said);
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
  // motor and fader
  settle(st.pitch, st.pitchT, dt, 0.18, calm);
  const target = st.on ? rpmOf(st.speed, st.pitch.x) / 60 : 0;
  settle(st.w, target, dt, st.on ? 0.4 : 1.6, calm);
  if (!calm) st.rev += st.w.x * dt;
  // strobe drift, in dots per second, from the real speed
  ROWS.forEach((row, index) => { if (!calm) st.strobe[index] = (((st.strobe[index] + drift(row, rpmNow()) * dt) % row.n) + row.n) % row.n; });
  // arm: lift to travel, lower to play, creep inward as the groove advances
  const r = radiusNow();
  const settled = Math.abs(st.phi.x - st.phiT) < 0.006;
  const inReach = onRecord(radiusOf(st.phiT));
  const liftTarget = st.down && settled && inReach ? 0 : 12;
  settle(st.lift, liftTarget, dt, 0.22, calm);
  settle(st.phi, st.phiT, dt, 0.55, calm);
  if (st.lift.x < 1.2 && st.down && onRecord(r) && st.w.x > 0.02 && !calm) {
    const next = r - PER_REV * st.w.x * dt;
    st.phi.x = armAngle(next); st.phiT = st.phi.x;
    if (next <= R_INNER) toRest();
  }
  draw(calm);
  const busy = touring || st.w.x > 0.004 || Math.abs(st.phi.x - st.phiT) > 0.001 || Math.abs(st.lift.x - liftTarget) > 0.01 || Math.abs(st.pitch.x - st.pitchT) > 0.005;
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const handOver = () => { touring = false; clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; tourAt = 0; tourClock = 0; run(); }, 12000); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;

// ---------------- pointer ----------------
const inRect = (p, x, y, w, d) => p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + d;
const rest = [PIV[0] + Math.cos(PHI_REST) * 190, PIV[1] + Math.sin(PHI_REST) * 190];
function whatAt(event) {
  const box = stage.getBoundingClientRect();
  const vx = ((event.clientX - box.left) / box.width) * D.W, vy = ((event.clientY - box.top) / box.height) * D.H;
  const F = D.fader;
  if (inRect(floorAt(vx, vy, 6), F.x - 14, F.y - 8, F.w + 28, F.d + 16)) return { kind: "fader", at: floorAt(vx, vy, 6) };
  if (inRect(floorAt(vx, vy, 5), D.btn.x, D.btn.y, D.btn.w, D.btn.d)) return { kind: "power" };
  for (const b of D.speed) { const p = floorAt(vx, vy, 5); if (Math.hypot(p[0] - b.x, p[1] - b.y) < b.r + 2) return { kind: "speed", speed: b.speed }; }
  const lever = floorAt(vx, vy, 9);
  if (inRect(lever, 198, -122, 18, 42)) return { kind: "cue" };
  const rp = floorAt(vx, vy, 60);
  if (Math.hypot(rp[0] - rest[0], rp[1] - rest[1]) < 14) return { kind: "rest" };
  const p = floorAt(vx, vy, D.recZ);
  const r = Math.hypot(p[0] - D.S[0], p[1] - D.S[1]);
  if (r >= R_INNER - 4 && r <= D.rOut) return { kind: "record", r };
  return null;
}
let drag = null;
const faderTo = (at) => setPitch(((D.fader.zero - at[1]) / D.fader.span) * PITCH);
stage.addEventListener("pointerdown", (event) => {
  const hit = whatAt(event);
  if (!hit) return;
  stage.focus({ preventScroll: true });
  handOver();
  if (hit.kind === "fader") { drag = "fader"; faderTo(hit.at); }
  else if (hit.kind === "power") power(!st.on);
  else if (hit.kind === "speed") setSpeed(hit.speed);
  else if (hit.kind === "cue") cue();
  else if (hit.kind === "rest") toRest();
  else if (hit.kind === "record") { drag = "record"; dropAt(hit.r); }
  if (drag) stage.setPointerCapture(event.pointerId);
  event.preventDefault();
  run();
});
stage.addEventListener("pointermove", (event) => {
  if (drag) {
    const box = stage.getBoundingClientRect();
    const vx = ((event.clientX - box.left) / box.width) * D.W, vy = ((event.clientY - box.top) / box.height) * D.H;
    if (drag === "fader") faderTo(floorAt(vx, vy, 6));
    else { const p = floorAt(vx, vy, D.recZ); dropAt(Math.hypot(p[0] - D.S[0], p[1] - D.S[1])); }
    handOver();
    return;
  }
  stage.style.cursor = whatAt(event) ? "pointer" : "default";
});
const release = () => { drag = null; };
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);

// ---------------- keys ----------------
stage.addEventListener("keydown", (event) => {
  const k = event.key;
  const r = radiusOf(st.phiT);
  if (k === " " || k === "Enter") power(!st.on);
  else if (k === "3") setSpeed(33);
  else if (k === "4") setSpeed(45);
  else if (k === "ArrowUp") setPitch(st.pitchT + 0.5);
  else if (k === "ArrowDown") setPitch(st.pitchT - 0.5);
  else if (k === "0") setPitch(0);
  else if (k === "ArrowLeft") dropAt(onRecord(r) ? r + 6 : R_FIRST);
  else if (k === "ArrowRight") dropAt(onRecord(r) ? r - 6 : R_FIRST);
  else if (k === "c" || k === "C") cue();
  else if (k === "r" || k === "R") toRest();
  else return;
  event.preventDefault();
  handOver();
});

armG.innerHTML = armSvg(P_, { phi: st.phi.x, lift: st.lift.x });
draw(true);
run();
window.__tt = { st, frac: (x, y, z) => { const [sx, sy] = iso([x, y, z], P_); return [sx / D.W, sy / D.H]; } };
