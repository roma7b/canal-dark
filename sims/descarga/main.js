import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutCubic, keyed, lerp, prog, smooth} from '../kit/util.js';
import TL from './timeline.json';

// "Lá Dentro" test #1: why the toilet tank never overflows.
// Low poly toilet, an x-ray scan turns the shell into glass, then:
// button -> flush gate opens -> water drains -> float drops -> fill valve opens
// -> refill pushes the float up -> valve shuts -> (what if it sticks?) the
// overflow tube carries the excess to the bowl. Scan back up at the end so the
// last frame matches the first (loops).

const DEFAULTS = {
  duration: TL.duration,
  fps: 30,
  hud: {enabled: false, title: 'descarga', subtitle: ''},
  director: {enabled: false},
  watermark: '',
};

const COL = {
  porcelain: '#eef2f7',
  ghost: '#5ee7ff',
  water: '#2f8cff',
  float: '#ff8a3d',
  gate: '#ff4d6d',
  overflow: '#ffd23f',
  valve: '#3ddc97',
  metal: '#c9d3dd',
};

// --- tank geometry (world units) --------------------------------------------
const TANK = {x: 0, z: -0.55, w: 1.6, d: 0.55, y0: 1.5, y1: 2.85, wall: 0.05};
const IN_BOTTOM = TANK.y0 + TANK.wall; // 1.55
const L_FULL = 2.45, L_LOW = 1.62, L_CAP = 2.55;
const PIVOT = new THREE.Vector3(-0.55, 2.62, TANK.z);
const ARM = 0.48;
const BALL_R = 0.12;
const GATE_X = 0.15, OVER_X = 0.47;

// water level as a pure function of time
const level = (t) => {
  if (t < TL.drainStart) return L_FULL;
  if (t < TL.drainEnd) return lerp(L_FULL, L_LOW, prog(t, TL.drainStart, TL.drainEnd, easeInOutCubic));
  if (t < TL.refillStart) return L_LOW;
  if (t < TL.refillEnd) return lerp(L_LOW, L_FULL, 1 - Math.pow(1 - clamp01((t - TL.refillStart) / (TL.refillEnd - TL.refillStart)), 1.7));
  if (t < TL.fail + 0.2) return L_FULL;
  if (t < TL.riseEnd) return lerp(L_FULL, L_CAP, prog(t, TL.fail + 0.2, TL.riseEnd, easeOutCubic));
  return L_CAP;
};
// float hangs on its arm: it rides the surface until the arm hits its stop
const BALL_MIN = PIVOT.y - ARM * Math.sin((55 * Math.PI) / 180);
const ballY = (t) => Math.max(BALL_MIN, Math.min(level(t), PIVOT.y - ARM * Math.sin((8 * Math.PI) / 180)));
const stuck = (t) => t >= TL.fail && t < TL.overflowEnd;
const valveOpen = (t) => (stuck(t) ? smooth((t - TL.fail) / 0.4) * (1 - smooth((t - TL.overflowEnd + 0.4) / 0.4)) : clamp01((L_FULL - ballY(t)) / 0.06));
const gateLift = (t) => prog(t, TL.drainStart - 0.25, TL.drainStart + 0.1, easeOutCubic) * (1 - prog(t, TL.gateClose, TL.gateClose + 0.5));
const scanY = (t) => {
  if (t < TL.scanBack) return lerp(3.1, -0.1, prog(t, TL.scanStart, TL.scanEnd, easeInOutCubic));
  return lerp(-0.1, 3.1, prog(t, TL.scanBack, TL.scanBackEnd, easeInOutCubic));
};

runSim(DEFAULTS, async ({canvas}) => {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, preserveDrawingBuffer: true});
  renderer.setClearColor(0x000000, 0);
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.1, 100);

  scene.add(new THREE.HemisphereLight('#cfe8ff', '#1a2c44', 1.5));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(3, 6, 5);
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#5ee7ff', 1.0);
  rim.position.set(-4, 3, -4);
  scene.add(rim);

  // clipping: solid keeps y < scan, ghost keeps y > scan
  const clipSolid = new THREE.Plane(new THREE.Vector3(0, -1, 0), 3);
  const clipGhost = new THREE.Plane(new THREE.Vector3(0, 1, 0), -3);

  const solidMat = new THREE.MeshStandardMaterial({color: COL.porcelain, roughness: 0.55, metalness: 0.0, flatShading: true, clippingPlanes: [clipSolid], side: THREE.DoubleSide});
  const ghostMat = new THREE.MeshBasicMaterial({color: COL.ghost, transparent: true, opacity: 0.07, depthWrite: false, clippingPlanes: [clipGhost], side: THREE.DoubleSide});
  const edgeMat = new THREE.LineBasicMaterial({color: COL.ghost, transparent: true, opacity: 0.85, clippingPlanes: [clipGhost]});

  const shell = new THREE.Group();
  scene.add(shell);
  const addShell = (geo, pos, rot, scale) => {
    for (const mat of [solidMat, ghostMat]) {
      const m = new THREE.Mesh(geo, mat);
      if (pos) m.position.copy(pos);
      if (rot) m.rotation.set(...rot);
      if (scale) m.scale.set(...scale);
      if (mat === ghostMat) m.renderOrder = 5;
      shell.add(m);
    }
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat);
    if (pos) e.position.copy(pos);
    if (rot) e.rotation.set(...rot);
    if (scale) e.scale.set(...scale);
    shell.add(e);
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // bowl + pedestal (low poly, oval)
  addShell(new THREE.CylinderGeometry(0.34, 0.46, 0.8, 8, 1), V(0, 0.4, 0.15), null, [1, 1, 1.25]);
  addShell(new THREE.CylinderGeometry(0.62, 0.38, 0.52, 10, 1, true), V(0, 1.06, 0.25), null, [1, 1, 1.25]);
  addShell(new THREE.CylinderGeometry(0.66, 0.66, 0.07, 10, 1), V(0, 1.36, 0.25), null, [1, 1, 1.25]); // closed lid
  addShell(new THREE.BoxGeometry(0.9, 0.2, 0.5), V(0, 1.4, TANK.z)); // neck between bowl and tank
  // tank walls
  const {w, d, y0, y1, wall} = TANK;
  const hy = y1 - y0;
  addShell(new THREE.BoxGeometry(w, wall, d), V(0, y0 + wall / 2, TANK.z));
  addShell(new THREE.BoxGeometry(w, hy, wall), V(0, y0 + hy / 2, TANK.z + d / 2 - wall / 2));
  addShell(new THREE.BoxGeometry(w, hy, wall), V(0, y0 + hy / 2, TANK.z - d / 2 + wall / 2));
  addShell(new THREE.BoxGeometry(wall, hy, d), V(-w / 2 + wall / 2, y0 + hy / 2, TANK.z));
  addShell(new THREE.BoxGeometry(wall, hy, d), V(w / 2 - wall / 2, y0 + hy / 2, TANK.z));
  addShell(new THREE.BoxGeometry(w + 0.06, 0.08, d + 0.06), V(0, y1 + 0.04, TANK.z)); // lid

  // floor grid
  const grid = new THREE.GridHelper(12, 24, '#5ee7ff', '#5ee7ff');
  grid.material.transparent = true;
  grid.material.opacity = 0.09;
  scene.add(grid);

  // --- interior parts ---------------------------------------------------------
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.5, metalness: 0.05, flatShading: true, emissive: color, emissiveIntensity: 0.18, ...o});
  const inner = new THREE.Group();
  scene.add(inner);

  // water box (scaled each frame) + surface
  const waterMat = new THREE.MeshStandardMaterial({color: COL.water, transparent: true, opacity: 0.5, roughness: 0.2, depthWrite: false, emissive: COL.water, emissiveIntensity: 0.25});
  const iw = w - 2 * wall - 0.01, id = d - 2 * wall - 0.01;
  const water = new THREE.Mesh(new THREE.BoxGeometry(iw, 1, id), waterMat);
  water.renderOrder = 2;
  inner.add(water);
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(iw, id, 8, 3), new THREE.MeshBasicMaterial({color: '#8fd0ff', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide}));
  surf.rotation.x = -Math.PI / 2;
  surf.renderOrder = 3;
  inner.add(surf);
  // bowl water
  const bowlWater = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 10), new THREE.MeshBasicMaterial({color: '#5aa8ff', transparent: true, opacity: 0.32, depthWrite: false}));
  bowlWater.position.set(0, 0.98, 0.28);
  bowlWater.scale.z = 1.25;
  inner.add(bowlWater);

  // fill valve (entrada): pipe from below + tube + head
  const valveMat = std(COL.valve);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, PIVOT.y - IN_BOTTOM, 6), valveMat);
  tube.position.set(PIVOT.x, (PIVOT.y + IN_BOTTOM) / 2, TANK.z);
  inner.add(tube);
  const inlet = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 6), valveMat);
  inlet.position.set(PIVOT.x, IN_BOTTOM - 0.08, TANK.z);
  inner.add(inlet);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.16), valveMat);
  head.position.set(PIVOT.x, PIVOT.y, TANK.z);
  inner.add(head);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6), valveMat);
  nozzle.position.set(PIVOT.x - 0.1, PIVOT.y - 0.08, TANK.z);
  inner.add(nozzle);
  // valve state light
  const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), new THREE.MeshBasicMaterial({color: '#ffffff'}));
  lamp.position.set(PIVOT.x, PIVOT.y + 0.09, TANK.z + 0.05);
  inner.add(lamp);

  // float arm + ball
  const armMat = std(COL.metal, {emissiveIntensity: 0.05});
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, ARM, 5), armMat);
  inner.add(arm);
  const ballMat = std(COL.float);
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(BALL_R, 1), ballMat);
  inner.add(ball);

  // flush gate (comporta) + outlet ring + rod to the button
  const gateMat = std(COL.gate);
  const outletRing = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 8, 1, true), std('#8a97a8'));
  outletRing.position.set(GATE_X, IN_BOTTOM + 0.02, TANK.z);
  inner.add(outletRing);
  const gate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 8), gateMat);
  inner.add(gate);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 5), armMat);
  inner.add(rod);
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8), std(COL.metal, {emissiveIntensity: 0.1, metalness: 0.4}));
  inner.add(button);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 5), new THREE.MeshBasicMaterial({color: '#ffd23f', transparent: true}));
  arrow.rotation.x = Math.PI;
  inner.add(arrow);

  // overflow tube (ladrão): open at the top, joins the outlet at the bottom
  const overMat = std(COL.overflow, {transparent: true, opacity: 0.9});
  const over = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, L_CAP - IN_BOTTOM, 7, 1, true), overMat);
  over.position.set(OVER_X, (L_CAP + IN_BOTTOM) / 2, TANK.z);
  inner.add(over);
  const overLip = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.014, 4, 8), overMat);
  overLip.rotation.x = Math.PI / 2;
  overLip.position.set(OVER_X, L_CAP, TANK.z);
  inner.add(overLip);
  const overFoot = new THREE.Mesh(new THREE.BoxGeometry(OVER_X - GATE_X, 0.06, 0.1), overMat);
  overFoot.position.set((OVER_X + GATE_X) / 2, IN_BOTTOM + 0.05, TANK.z);
  inner.add(overFoot);

  // scan plane
  const scanMat = new THREE.MeshBasicMaterial({color: COL.ghost, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending});
  const scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4), scanMat);
  scanPlane.rotation.x = -Math.PI / 2;
  scanPlane.position.z = -0.1;
  scene.add(scanPlane);
  const scanEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.6, 2.4)), new THREE.LineBasicMaterial({color: '#bff6ff', transparent: true, opacity: 0}));
  scanEdge.rotation.x = -Math.PI / 2;
  scanEdge.position.z = -0.1;
  scene.add(scanEdge);

  // --- water particles (instanced, pure in t) --------------------------------
  const dropGeo = new THREE.IcosahedronGeometry(0.028, 0);
  const mkDrops = (n, color) => {
    const m = new THREE.InstancedMesh(dropGeo, new THREE.MeshBasicMaterial({color}), n);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  };
  const fillDrops = mkDrops(70, '#9bd7ff');
  const drainDrops = mkDrops(90, '#7cc4ff');
  const overDrops = mkDrops(60, '#ffe27a');
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const S = new THREE.Vector3();
  const P = new THREE.Vector3();
  const frac = (x) => x - Math.floor(x);
  const jit = (i, k) => frac(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) - 0.5;
  const pathAt = (pts, u) => {
    // polyline by equal segments
    const n = pts.length - 1;
    const f = Math.min(n - 1e-6, u * n);
    const i = Math.floor(f);
    return P.copy(pts[i]).lerp(pts[i + 1], f - i);
  };
  const drainPath = [V(GATE_X, IN_BOTTOM + 0.05, TANK.z), V(GATE_X, 1.38, TANK.z), V(0.05, 1.2, -0.1), V(0, 1.0, 0.28)];
  const overPath = [V(OVER_X, L_CAP, TANK.z), V(OVER_X, IN_BOTTOM + 0.06, TANK.z), V(GATE_X, 1.38, TANK.z), V(0, 1.0, 0.28)];
  const setDrops = (mesh, n, active, fn) => {
    for (let i = 0; i < n; i++) {
      const on = i / n < active;
      if (on) fn(i, P);
      S.setScalar(on ? 1 : 0);
      M.compose(on ? P : P.set(0, -50, 0), Q, S);
      mesh.setMatrixAt(i, M);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  // --- overlay (captions, labels) --------------------------------------------
  const app = document.getElementById('app');
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = `<svg class="lines"></svg><div class="brand"><i></i>LÁ DENTRO</div><div class="cap"></div>
    <div class="sub">Qual objeto eu abro no próximo?<small>@LADENTRO</small></div>`;
  app.appendChild(ov);
  const capBox = ov.querySelector('.cap');
  const caps = TL.captions.map(([a, b, html]) => {
    const el = document.createElement('div');
    el.innerHTML = html;
    capBox.appendChild(el);
    return {a, b, el};
  });
  const sub = ov.querySelector('.sub');
  const svg = ov.querySelector('svg');
  const mkLabel = (name, color, side) => {
    const el = document.createElement('div');
    el.className = 'lab';
    el.innerHTML = `<i style="background:${color};box-shadow:0 0 14px ${color}"></i><b>${name}</b><span></span>`;
    ov.appendChild(el);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '4');
    svg.appendChild(line);
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '9');
    dot.setAttribute('fill', color);
    svg.appendChild(dot);
    return {el, line, dot, span: el.querySelector('span'), side};
  };
  const LAB = {
    button: mkLabel('botão', COL.metal, [220, -110]),
    gate: mkLabel('comporta', COL.gate, [170, 230]),
    float: mkLabel('boia', COL.float, [210, -170]),
    valve: mkLabel('entrada', COL.valve, [40, -200]),
    over: mkLabel('ladrão', COL.overflow, [-40, -210]),
  };
  const proj = new THREE.Vector3();
  const toScreen = (p) => {
    proj.copy(p).project(camera);
    return [(proj.x * 0.5 + 0.5) * innerWidth, (-proj.y * 0.5 + 0.5) * innerHeight];
  };
  const showLabel = (L, p, a, b, t, text = '') => {
    const k = smooth((t - a) / 0.35) * (1 - smooth((t - b + 0.35) / 0.35));
    const [x, y] = toScreen(p);
    const lx = Math.min(Math.max(x + L.side[0], 190), innerWidth - 190);
    const ly = y + L.side[1];
    L.el.style.opacity = k;
    L.el.style.left = `${lx}px`;
    L.el.style.top = `${ly}px`;
    L.el.style.transform = `translate(-50%, -50%) scale(${0.85 + 0.15 * k})`;
    L.span.textContent = text;
    L.span.style.display = text ? '' : 'none';
    L.line.setAttribute('x1', x);
    L.line.setAttribute('y1', y);
    L.line.setAttribute('x2', lx);
    L.line.setAttribute('y2', ly);
    L.line.setAttribute('opacity', k);
    L.dot.setAttribute('cx', x);
    L.dot.setAttribute('cy', y);
    L.dot.setAttribute('opacity', k);
  };

  // --- camera keys: [t, [px, py, pz, tx, ty, tz]] ----------------------------
  const CAM = [
    [0, [3.0, 2.5, 6.9, 0, 1.6, -0.05]],
    [3.2, [2.5, 2.5, 6.6, 0, 1.65, -0.1]],
    [6.0, [1.3, 2.6, 4.9, 0, 2.3, -0.5]],
    [14.0, [0.4, 2.65, 4.7, -0.05, 2.32, -0.5]],
    [20.4, [-0.6, 2.75, 4.6, -0.15, 2.36, -0.5]],
    [24.2, [-0.3, 2.85, 4.4, 0.05, 2.38, -0.5]],
    [26.2, [1.0, 2.8, 4.4, 0.2, 2.3, -0.5]],
    [28.6, [1.2, 2.75, 4.6, 0.15, 2.25, -0.5]],
    [31.0, [2.9, 2.5, 6.8, 0, 1.6, -0.05]],
    [32.0, [3.0, 2.5, 6.9, 0, 1.6, -0.05]],
  ];

  const render = (t) => {
    // camera
    const c = keyed(CAM, t);
    camera.position.set(c[0], c[1], c[2]);
    camera.lookAt(c[3], c[4], c[5]);

    // scan
    const sy = scanY(t);
    clipSolid.constant = sy;
    clipGhost.constant = -sy;
    const scanning = (t > TL.scanStart - 0.1 && t < TL.scanEnd + 0.2) || (t > TL.scanBack - 0.1 && t < TL.scanBackEnd + 0.2);
    scanPlane.position.y = sy;
    scanEdge.position.y = sy;
    scanMat.opacity = scanning && sy > 0 && sy < 3.0 ? 0.16 : 0;
    scanEdge.material.opacity = scanning && sy > 0 && sy < 3.0 ? 0.9 : 0;
    const xr = clamp01((3.0 - sy) / 3.0); // how much is x-rayed
    edgeMat.opacity = 0.85;
    ghostMat.opacity = 0.07;
    // interior only visible once scanned (keeps frame 0 clean)
    inner.visible = sy < 3.0;

    // water
    const lv = level(t);
    water.scale.y = lv - IN_BOTTOM;
    water.position.set(0, (lv + IN_BOTTOM) / 2, TANK.z);
    surf.position.set(0, lv, TANK.z);
    const pos = surf.geometry.attributes.position;
    const ripple = 0.006 + 0.012 * Math.max(valveOpen(t), gateLift(t));
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 9 + t * 5) * ripple + Math.cos(y * 11 + t * 4) * ripple * 0.6);
    }
    pos.needsUpdate = true;
    bowlWater.position.y = 0.98 + 0.03 * gateLift(t) * Math.sin(t * 9) + 0.02 * clamp01((t - TL.riseEnd) / 2) * (stuck(t) ? Math.sin(t * 7) : 0);

    // float + arm
    const by = ballY(t);
    const s = clamp01((PIVOT.y - by) / ARM);
    const ang = Math.asin(s);
    const bx = PIVOT.x + ARM * Math.cos(ang);
    ball.position.set(bx, by, TANK.z);
    arm.position.set((PIVOT.x + bx) / 2, (PIVOT.y + by) / 2, TANK.z);
    arm.rotation.set(0, 0, Math.PI / 2 - ang);
    const failK = stuck(t) ? 0.5 + 0.5 * Math.sin((t - TL.fail) * 10) : 0;
    ballMat.emissive.set(failK > 0 ? '#ff2040' : COL.float);
    ballMat.emissiveIntensity = failK > 0 ? 0.25 + 0.5 * failK : 0.18;

    // valve lamp
    const vo = valveOpen(t);
    lamp.material.color.set(vo > 0.05 ? '#3dff9a' : '#ff5a6a');
    lamp.scale.setScalar(vo > 0.05 ? 1.2 + 0.3 * Math.sin(t * 12) : 1);

    // gate + rod + button
    const gl = gateLift(t);
    gate.position.set(GATE_X, IN_BOTTOM + 0.06 + 0.24 * gl, TANK.z);
    gate.rotation.set(0, 0, -0.5 * gl);
    const press = prog(t, TL.press - 0.15, TL.press, easeOutCubic) * (1 - prog(t, TL.gateClose, TL.gateClose + 0.3));
    button.position.set(GATE_X, TANK.y1 + 0.1 - 0.035 * press, TANK.z);
    const rodTop = TANK.y1 - 0.05;
    const rodBot = gate.position.y + 0.03;
    rod.scale.y = rodTop - rodBot;
    rod.position.set(GATE_X, (rodTop + rodBot) / 2, TANK.z);
    const ak = prog(t, TL.press - 0.9, TL.press - 0.1, easeInOutCubic);
    const aOut = 1 - prog(t, TL.press + 0.3, TL.press + 0.7);
    arrow.position.set(GATE_X, TANK.y1 + 0.55 - 0.32 * ak, TANK.z);
    arrow.material.opacity = (t > TL.press - 1 ? 1 : 0) * aOut;
    arrow.visible = arrow.material.opacity > 0.01;

    // drops: fill stream from the nozzle down to the surface
    const fillTop = V(PIVOT.x - 0.1, PIVOT.y - 0.14, TANK.z);
    setDrops(fillDrops, 70, vo, (i, p) => {
      const u = frac(t * 1.6 + i / 70);
      p.set(fillTop.x + jit(i, 1) * 0.05, lerp(fillTop.y, lv, u * u), TANK.z + jit(i, 2) * 0.05);
    });
    const drainOn = gl > 0.3 ? clamp01((lv - L_LOW) / 0.08 + 0.2) : 0;
    setDrops(drainDrops, 90, drainOn, (i, p) => {
      const u = frac(t * 1.3 + i / 90);
      pathAt(drainPath, u);
      p.x += jit(i, 3) * 0.12;
      p.z += jit(i, 4) * 0.08;
    });
    const overOn = lv > L_CAP - 0.01 && stuck(t) ? clamp01((t - TL.riseEnd) / 0.3) * vo : 0;
    setDrops(overDrops, 60, overOn, (i, p) => {
      const u = frac(t * 1.1 + i / 60);
      pathAt(overPath, u);
      p.x += jit(i, 5) * 0.04;
      p.z += jit(i, 6) * 0.04;
    });
    overMat.emissiveIntensity = t > TL.riseEnd - 0.3 && t < TL.overflowEnd ? 0.45 + 0.25 * Math.sin(t * 8) : 0.18;

    renderer.render(scene, camera);

    // captions
    for (const {a, b, el} of caps) {
      const kin = a === 0 ? 1 : smooth((t - a) / 0.3);
      const k = kin * (1 - smooth((t - b + 0.25) / 0.25));
      el.style.opacity = k;
      el.style.transform = `translateY(${a === 0 ? 0 : (1 - smooth((t - a) / 0.35)) * 26}px)`;
    }
    sub.style.opacity = smooth((t - TL.outro - 0.6) / 0.4) * (1 - smooth((t - TL.scanBackEnd + 0.1) / 0.3));

    // labels
    showLabel(LAB.button, button.position, TL.press - 1.0, TL.press + 0.9, t);
    showLabel(LAB.gate, gate.position, TL.drainStart, TL.refillStart + 0.2, t, gl > 0.5 ? 'aberta' : '');
    showLabel(LAB.float, ball.position, TL.refillStart + 0.2, TL.valveShut + 0.6, t);
    showLabel(LAB.valve, head.position, TL.refillStart + 0.6, TL.fail, t, vo > 0.05 ? 'aberta' : 'fechada');
    showLabel(LAB.over, overLip.position, TL.riseEnd - 0.4, TL.overflowEnd, t);
    return {xr};
  };

  const resize = () => {
    renderer.setPixelRatio(1);
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  return {render, resize};
});
