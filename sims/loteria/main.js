import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutBack, easeOutCubic, lerp, prog, smooth} from '../kit/util.js';
import {createChar, INK} from './char.js';
import {at, ball, blobShadow, box, cloud, cyl, sign, sky, solid, toon, tree, trophy} from './world.js';
import TL from './timeline.json';
import WORDS_RAW from './narracao-fit-words.json';

// "Ninguém Te Contou" #1: the man who won the lottery 14 times.
// 2D cutout characters (char.js) in a toon-shaded 3D world (world.js).
// Every beat is keyed to the narration's word timings (narracao-fit-words.json),
// so re-generating the voice re-times the whole film. render(t) is pure.

const DEFAULTS = {
  duration: TL.duration,
  fps: 30,
  hud: {enabled: false, title: 'loteria', subtitle: ''},
  director: {enabled: false},
  watermark: '',
};

const frac = (x) => x - Math.floor(x);
const hash = (i, k = 0) => frac(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453);
const norm = (w) => w.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
const pop = (t, t0, d = 0.35) => prog(t, t0, t0 + d, easeOutBack);
const inOut = (t, a, b, f = 0.25) => smooth((t - a) / f) * (1 - smooth((t - b) / f));

// ---------------------------------------------------------------- word timing
const LINES = [];
for (const w of WORDS_RAW) (LINES[w.line] ||= []).push(w);
const L = (n) => ({a: LINES[n][0].a, b: LINES[n][LINES[n].length - 1].b});
/** start time of the first word in line n that starts with `prefix` */
const W = (n, prefix) => {
  const p = norm(prefix);
  const w = LINES[n].find((x) => norm(x.w).startsWith(p));
  if (!w) throw new Error(`word "${prefix}" not in line ${n}`);
  return w.a;
};

// captions: one or two words at a time, short words ride with the next one
const CAPS = [];
for (const ws of LINES) {
  for (let i = 0; i < ws.length; i++) {
    const g = [ws[i]];
    if (norm(ws[i].w).length <= 3 && i + 1 < ws.length && !/[.?!…:,]$/.test(ws[i].w)) g.push(ws[++i]);
    const next = ws[i + 1];
    CAPS.push({
      a: g[0].a - 0.04,
      b: next ? next.a - 0.04 : g[g.length - 1].b + 0.25,
      text: g.map((x) => x.w).join(' ').replace(/[.,…:]+$/, ''),
      hot: g.some((x) => TL.accent.includes(norm(x.w))),
    });
  }
}

// shots: cut a little before each line starts
const SHOTS = TL.shots.map((s, i) => {
  const start = i === 0 ? 0 : s.fromPrevEnd != null ? L(TL.shots[i - 1].line).b + s.fromPrevEnd : L(s.line).a - 0.12;
  return {...s, start};
});
SHOTS.forEach((s, i) => (s.end = i + 1 < SHOTS.length ? SHOTS[i + 1].start : TL.duration));

runSim(DEFAULTS, async ({canvas, cfg}) => {
  await document.fonts.load('900 40px "Inter"').catch(() => {});
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.1, 300);
  const hemi = new THREE.HemisphereLight('#ffffff', '#b9c4e0', 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 2.0);
  sun.position.set(4, 8, 6);
  scene.add(sun);

  const chars = [];
  const mkChar = (look, parent, h = 2) => {
    const ch = createChar(THREE, look);
    ch.mesh.scale.setScalar(h / 2);
    ch.shadow = blobShadow(0.5 * (h / 2));
    parent.add(ch.mesh, ch.shadow);
    ch.place = (x, y, z, vis = true) => {
      ch.mesh.scale.setScalar(h / 2);
      ch.mesh.position.set(x, y, z);
      ch.shadow.position.set(x, y + 0.012, z);
      ch.mesh.visible = ch.shadow.visible = vis;
    };
    chars.push(ch);
    return ch;
  };
  const blink = (t, ph = 0) => frac((t + ph) / 3.1) < 0.045;
  const paperSign = (w, h, title, opts = {}) =>
    sign(w, h, Math.round(w * 300), Math.round(h * 300), (c, pw, ph, st = {}) => {
      const o = {...opts, ...st};
      c.fillStyle = o.bg || '#fffaf0';
      c.beginPath();
      c.roundRect(0, 0, pw, ph, 30);
      c.fill();
      c.lineWidth = 20;
      c.strokeStyle = o.border || INK;
      c.beginPath();
      c.roundRect(10, 10, pw - 20, ph - 20, 24);
      c.stroke();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const rows = o.rows || [[title, 0.5, 0.22, o.fg || INK]];
      for (const [txt, y, size, col] of rows) {
        let fs = Math.round(ph * size);
        c.font = `900 ${fs}px Inter`;
        const fit = (pw * 0.86) / c.measureText(txt).width;
        if (fit < 1) c.font = `900 ${(fs = Math.floor(fs * fit))}px Inter`;
        c.fillStyle = col;
        c.fillText(txt, pw / 2, ph * y);
      }
    });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
  const confetti = (parent, n, box3) => {
    const cf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.09, 0.14), new THREE.MeshBasicMaterial({side: THREE.DoubleSide}), n);
    const cols = ['#ff4d6d', '#ffd23f', '#4dd4ff', '#7bed9f', '#ffffff', '#b28dff'];
    for (let i = 0; i < n; i++) cf.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    cf.frustumCulled = false;
    parent.add(cf);
    const [x0, x1, y0, y1, z0, z1] = box3;
    cf.upd = (t, on = 1) => {
      for (let i = 0; i < n; i++) {
        const y = y1 - frac(t * (0.16 + hash(i, 1) * 0.1) + hash(i, 2)) * (y1 - y0);
        P.set(x0 + hash(i, 3) * (x1 - x0) + Math.sin(t * 2 + i) * 0.12, y, z0 + hash(i, 4) * (z1 - z0));
        E.set(t * 3 + i, t * 2.3 + i * 2, i);
        if (i / n < on) M.compose(P, Q.setFromEuler(E), S1);
        else M.makeScale(0, 0, 0);
        cf.setMatrixAt(i, M);
      }
      cf.instanceMatrix.needsUpdate = true;
    };
    return cf;
  };
  const ground = (parent, color, size = 80) => {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size), toon(color));
    g.rotation.x = -Math.PI / 2;
    parent.add(g);
    return g;
  };

  const SETS = {};
  const skyDay = sky('#3aa0ff', '#bfe6ff');

  // ===================================================================== palco
  {
    const g = new THREE.Group();
    ground(g, '#74c957');
    [[-9, -14, 7], [6, -18, 9], [16, -13, 6]].forEach(([x, z, r]) => {
      const h = ball(r, '#5cb548', 2, 0.02);
      h.scale.y = 0.35;
      g.add(at(h, x, 0, z));
    });
    [[-3.4, -4.5, 2.8], [-2.3, -6, 2.3], [3.3, -5, 3.0], [4.4, -7.5, 2.4], [-5.2, -8, 2.6]].forEach(([x, z, h]) => g.add(at(tree(h), x, 0, z)));
    [[-2.2, 6.6, -12, 1.5], [2.6, 7.4, -14, 1.9], [0.2, 8.6, -16, 1.3]].forEach(([x, y, z, s]) => g.add(at(cloud(s), x, y, z)));
    g.add(at(box(4.6, 0.5, 3.2, '#d9a066'), 0, 0.25, 0));
    g.add(at(box(4.7, 0.14, 0.12, '#a86f3a', 0.02), 0, 0.5, 1.6));
    g.add(at(box(4.2, 3.4, 0.25, '#c8324a'), 0, 2.2, -1.35));
    for (let i = 0; i < 7; i++) g.add(at(box(0.3, 3.4, 0.06, '#a82238', 0), -1.8 + i * 0.6, 2.2, -1.2));
    const lot = sign(3.5, 1.15, 1050, 345, (c, w, h) => {
      c.fillStyle = '#1b2a6b';
      c.beginPath();
      c.roundRect(0, 0, w, h, 50);
      c.fill();
      c.lineWidth = 22;
      c.strokeStyle = '#ffd23f';
      c.beginPath();
      c.roundRect(14, 14, w - 28, h - 28, 40);
      c.stroke();
      c.font = '900 210px Inter';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = 26;
      c.strokeStyle = INK;
      c.strokeText('LOTERIA', w / 2, h / 2 + 12);
      c.fillStyle = '#ffd23f';
      c.fillText('LOTERIA', w / 2, h / 2 + 12);
    });
    g.add(at(box(3.7, 1.35, 0.2, '#16204f'), 0, 4.15, -1.2));
    g.add(at(lot.mesh, 0, 4.15, -1.09));
    const bulbs = [];
    for (let i = 0; i < 12; i++)
      for (const y of [3.5, 4.8]) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), new THREE.MeshBasicMaterial({color: '#fff2a8'}));
        g.add(at(b, -1.76 + i * 0.32, y, -1.06));
        bulbs.push(b);
      }
    const trophies = [];
    [5, 4, 3, 2].forEach((n, r) => {
      g.add(at(box(1.8, 0.34, 0.5, r % 2 ? '#7b4bd6' : '#6a3cc4', 0.03), 1.0, 0.67 + r * 0.34, 0.1 - r * 0.36));
      for (let i = 0; i < n; i++) {
        const tr = trophy();
        tr.userData = {x: 1.0 + (i - (n - 1) / 2) * 0.34, y: 0.5 + 0.34 * (r + 1), z: 0.1 - r * 0.36, k: trophies.length};
        g.add(tr);
        trophies.push(tr);
      }
    });
    const hero = mkChar('mandel', g);
    const cf = confetti(g, 140, [-2.4, 2.4, -0.2, 6.2, -0.8, 1.8]);
    const t14 = W(0, 'catorze');
    SETS.palco = {
      g,
      bg: skyDay,
      cam: [[0.5, 2.35, 8.6, 0.05, 2.25, 0], [0.12, 2.05, 6.7, 0.05, 2.1, 0]],
      upd(t) {
        bulbs.forEach((b, i) => b.material.color.set((i + Math.floor(t * 3)) % 2 ? '#fff2a8' : '#ff9f1c'));
        trophies.forEach((tr) => {
          const {x, y, z, k} = tr.userData;
          const p = pop(t, t14 - 0.6 + k * 0.07, 0.3);
          tr.visible = p > 0.01;
          tr.position.set(x, y, z);
          tr.scale.setScalar(Math.max(0.01, p));
        });
        const jump = Math.abs(Math.sin(t * 5.2)) * 0.07 * smooth((t - 0.2) / 0.5);
        hero.place(-0.95, 0.5 + jump, 0.75);
        hero.draw({expr: t > W(0, 'quebrar') ? 'smug' : 'grin', armL: [60 + 8 * Math.sin(t * 5.2), 125], armR: [130, 160], propR: 'ticket', squash: 0.02 * Math.sin(t * 5.2), lookX: 0.2});
        cf.upd(t);
      },
    };
  }

  // ====================================================== sala (lousa/rifa/perai/balanca)
  const wallBg = new THREE.Color('#2d6f7a');
  {
    const g = new THREE.Group();
    g.add(at(box(12, 0.2, 9, '#e0b074', 0), 0, -0.1, 0.5));
    g.add(at(box(12, 7, 0.2, '#3f9aa3', 0), 0, 3.5, -1.7));
    g.add(at(box(12, 0.3, 0.1, '#f4ead5', 0.015), 0, 0.15, -1.56));
    for (let i = 0; i < 11; i++) g.add(at(box(0.05, 7, 0.02, '#368891', 0), -5 + i, 3.5, -1.59));
    g.add(at(cyl(0.02, 0.02, 1.4, INK, 5, 0), -1.5, 5.4, -0.4));
    g.add(at(solid(new THREE.ConeGeometry(0.42, 0.34, 10, 1, true), '#ffd23f', 0.03, {side: THREE.DoubleSide}), -1.5, 4.6, -0.4));

    // lousa: chalkboard
    const lousaG = new THREE.Group();
    g.add(lousaG);
    lousaG.add(at(box(3.0, 2.2, 0.12, '#8a5a2b'), 0.5, 2.6, -1.52));
    let lousaKey = '';
    const board = sign(2.8, 2.0, 1120, 800, (c, w, h, st = {sorte: 0, cross: 0, conta: 0}) => {
      c.fillStyle = '#24533f';
      c.fillRect(0, 0, w, h);
      c.globalAlpha = 0.08;
      for (let i = 0; i < 40; i++) {
        c.fillStyle = '#ffffff';
        c.fillRect(hash(i, 1) * w, hash(i, 2) * h, 120 * hash(i, 3), 6);
      }
      c.globalAlpha = 1;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      if (st.sorte) {
        c.font = '900 190px Inter';
        c.fillStyle = '#f4f4f4';
        c.fillText('SORTE', w / 2, h * 0.3);
      }
      if (st.cross > 0) {
        c.strokeStyle = '#ff5a6a';
        c.lineWidth = 34;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(w * 0.2, h * 0.36);
        c.lineTo(w * (0.2 + 0.6 * st.cross), h * (0.36 - 0.14 * st.cross));
        c.stroke();
      }
      if (st.conta) {
        c.font = '900 220px Inter';
        c.fillStyle = '#ffd23f';
        c.fillText('CONTA', w / 2, h * 0.72);
        c.strokeStyle = '#ffd23f';
        c.lineWidth = 16;
        c.beginPath();
        c.moveTo(w * 0.22, h * 0.86);
        c.lineTo(w * 0.78, h * 0.86);
        c.stroke();
        c.font = '800 70px Inter';
        c.fillStyle = '#cfe8da';
        c.fillText('3 > 1', w * 0.13, h * 0.12);
        c.fillText('100/100', w * 0.84, h * 0.12);
      }
    });
    lousaG.add(at(board.mesh, 0.5, 2.6, -1.45));

    // rifa
    const rifaG = new THREE.Group();
    g.add(rifaG);
    rifaG.add(at(box(2.75, 3.3, 0.14, '#8a5a2b'), 0.42, 2.45, -1.52));
    let rifaCount = -1;
    const rboard = sign(2.5, 3.05, 1000, 1220, (c, w, h, count = 0) => {
      c.fillStyle = '#fffaf0';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#e63946';
      c.fillRect(0, 0, w, 190);
      c.fillStyle = '#ffffff';
      c.font = '900 120px Inter';
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      c.fillText('RIFA', 44, 100);
      c.font = '800 54px Inter';
      c.textAlign = 'right';
      c.fillText('R$ 1 cada', w - 44, 68);
      c.fillStyle = '#ffd23f';
      c.fillText('prêmio R$ 300', w - 44, 138);
      const gs = 92, x0 = (w - gs * 10) / 2, y0 = 240;
      c.font = '800 38px Inter';
      c.textAlign = 'center';
      for (let i = 0; i < 100; i++) {
        const x = x0 + (i % 10) * gs, y = y0 + Math.floor(i / 10) * gs;
        const on = i < count;
        c.fillStyle = on ? '#35c46a' : '#ffffff';
        c.fillRect(x + 5, y + 5, gs - 10, gs - 10);
        c.lineWidth = 5;
        c.strokeStyle = INK;
        c.strokeRect(x + 5, y + 5, gs - 10, gs - 10);
        c.fillStyle = on ? '#ffffff' : INK;
        c.fillText(String(i + 1), x + gs / 2, y + gs / 2 + 3);
      }
    });
    rifaG.add(at(rboard.mesh, 0.42, 2.45, -1.44));
    rifaG.add(at(box(0.9, 0.08, 0.6, '#8a5a2b', 0.025), -1.75, 0.82, -0.7));
    for (const sx of [-0.36, 0.36]) rifaG.add(at(box(0.07, 0.8, 0.07, '#6e4520', 0.02), -1.75 + sx, 0.4, -0.7));
    const coins = [];
    for (let i = 0; i < 10; i++) {
      const co = cyl(0.13, 0.13, 0.045, '#ffc93c', 12, 0.015);
      rifaG.add(at(co, -1.75, 0.885 + i * 0.047, -0.7));
      coins.push(co);
    }

    // balança
    const balG = new THREE.Group();
    g.add(balG);
    balG.add(at(cyl(0.6, 0.7, 0.16, '#8a5a2b', 14), 0.55, 0.08, -0.3));
    balG.add(at(cyl(0.07, 0.07, 2.6, '#c9a227', 8), 0.55, 1.4, -0.3));
    const beam = new THREE.Group();
    beam.position.set(0.55, 2.72, -0.3);
    balG.add(beam);
    beam.add(box(2.9, 0.1, 0.12, '#c9a227'));
    beam.add(at(ball(0.13, '#c9a227', 1), 0, 0, 0));
    const pans = [-1, 1].map((sd) => {
      const p = new THREE.Group();
      balG.add(p);
      p.add(at(cyl(0.02, 0.02, 0.9, INK, 4, 0), 0, -0.45, 0));
      p.add(at(cyl(0.55, 0.42, 0.1, '#c9a227', 14), 0, -0.92, 0));
      p.sd = sd;
      return p;
    });
    for (let i = 0; i < 9; i++) pans[0].add(at(box(0.62, 0.05, 0.32, i % 2 ? '#fff3b0' : '#ffe58a', 0.012), (hash(i, 7) - 0.5) * 0.08, -0.84 + i * 0.055, 0));
    const bag = ball(0.36, '#e9b949', 1);
    bag.scale.set(1, 0.95, 1);
    pans[1].add(at(bag, 0, -0.52, 0));
    pans[1].add(at(cyl(0.08, 0.14, 0.14, '#e9b949', 8), 0, -0.14, 0));
    const lblL = paperSign(1.05, 0.5, '', {rows: [['TODOS OS', 0.32, 0.24, INK], ['BILHETES', 0.68, 0.3, INK]]});
    const lblR = paperSign(1.05, 0.5, '', {bg: '#fff3b0', rows: [['PRÊMIO', 0.32, 0.24, INK], ['R$ 300', 0.68, 0.32, '#2f7d32']]});
    const lblL2 = paperSign(1.05, 0.5, '', {rows: [['R$ 100', 0.5, 0.42, '#c8324a']]});
    pans[0].add(at(lblL.mesh, 0, -1.5, 0.45));
    pans[1].add(at(lblR.mesh, 0, -1.5, 0.45));
    pans[0].add(at(lblL2.mesh, 0, -2.05, 0.45));
    const stamp = paperSign(2.1, 0.75, 'É COMPRA', {bg: '#35c46a', fg: '#ffffff', border: '#1d6b3a'});
    balG.add(at(stamp.mesh, 0.55, 3.6, -0.2));

    const hero = mkChar('mandel', g);
    const viewer = mkChar('viewer', g);
    const tSorte = W(1, 'sorte'), tConta = W(1, 'conta'), tCompra = W(2, 'compra'), tPerai = L(3).a;
    const tMaior = W(4, 'maior'), tAposta = W(4, 'aposta'), tECompra = L(4).b - 0.55;
    const show = (which) => {
      lousaG.visible = which === 'lousa';
      rifaG.visible = which === 'rifa' || which === 'perai';
      balG.visible = which === 'balanca';
    };
    const mkShot = (which, cam) => ({
      g,
      bg: wallBg,
      cam,
      upd(t) {
        show(which);
        viewer.place(1.45, 0, 2.3, false);
        if (which === 'lousa') {
          const st = {sorte: t > tSorte - 0.1 ? 1 : 0, cross: Math.round(prog(t, tSorte + 0.35, tSorte + 0.75, (x) => clamp01(x)) * 10) / 10, conta: t > tConta - 0.05 ? 1 : 0};
          const key = JSON.stringify(st);
          if (key !== lousaKey) {
            board.repaint(st);
            lousaKey = key;
          }
          hero.place(-1.25, 0, 0.6);
          const writing = t > tSorte - 0.2 && t < tConta + 0.4;
          hero.draw({
            expr: t < W(1, 'percebeu') ? 'neutral' : writing ? 'think' : t > tConta ? 'smug' : 'think',
            armR: writing ? [120 + 12 * Math.sin(t * 12), 120] : t > tConta ? [95, 70] : [14, 8],
            armL: t < W(1, 'percebeu') ? [30, 150] : [14, 8],
            propR: writing ? 'marker' : null,
            lookX: writing ? 0.9 : 0.1,
            blink: blink(t, 0.4),
          });
        } else if (which === 'rifa' || which === 'perai') {
          const end = L(2).b + 0.4;
          const count = Math.round(100 * clamp01((t - tCompra) / (end - tCompra)));
          if (count !== rifaCount) {
            rboard.repaint(count);
            rifaCount = count;
          }
          const marking = t > tCompra && t < end;
          const wave = marking ? Math.sin(t * 14) * 14 : 0;
          hero.place(-1.05, 0, 0.5);
          hero.draw({
            expr: which === 'perai' ? 'smug' : t < W(2, 'que') ? 'think' : marking ? 'grin' : 'smug',
            armR: marking ? [118 + wave * 0.4, 138 + wave] : t < W(2, 'trezentos') ? [20, 150] : [95, 60],
            armL: [14, 8],
            propR: marking ? 'marker' : null,
            lookX: which === 'perai' ? 0.9 : marking ? 0.8 : 0.2,
            blink: blink(t, 1),
            squash: 0.012 * Math.sin(t * 3),
          });
          coins.forEach((co, i) => (co.visible = i < 10 - Math.floor(clamp01((t - tCompra) / (end - tCompra)) * 7)));
          if (which === 'perai') {
            const vin = pop(t, tPerai - 0.1, 0.22);
            viewer.place(1.45, 0, 2.3, vin > 0.01);
            viewer.mesh.scale.setScalar(Math.max(0.01, vin));
            viewer.draw({expr: 'shock', armL: [150, 208], armR: [150, 208], lookX: -0.7, squash: 0.03 * Math.sin((t - tPerai) * 22) * Math.exp(-(t - tPerai) * 5), lean: -3});
          }
        } else {
          // balança tips toward the prize when "muito maior" is said
          const ang = -0.32 * prog(t, tMaior - 0.1, tMaior + 0.5, easeOutBack);
          beam.rotation.z = ang;
          pans.forEach((p) => p.position.set(0.55 + p.sd * 1.4 * Math.cos(ang), 2.72 + p.sd * 1.4 * Math.sin(ang), -0.3));
          const sp = pop(t, tECompra, 0.3);
          stamp.mesh.visible = sp > 0.01;
          stamp.mesh.scale.setScalar(Math.max(0.01, sp));
          stamp.mesh.rotation.z = -0.08;
          hero.place(-1.1, 0, 2.5);
          hero.draw({
            expr: t < tMaior ? 'neutral' : t < tAposta ? 'think' : 'smug',
            armR: t > tMaior - 0.2 ? [100, 80] : [14, 8],
            armL: [14, 8],
            lookX: t > tMaior - 0.2 ? 0.8 : 0.2,
            blink: blink(t, 2),
          });
        }
      },
    });
    SETS.lousa = mkShot('lousa', [[-0.2, 2.2, 7.6, -0.2, 2.1, 0], [-0.1, 2.25, 6.6, 0, 2.15, 0]]);
    SETS.rifa = mkShot('rifa', [[0, 2.3, 7.8, 0.1, 2.15, 0], [0.3, 2.35, 6.5, 0.25, 2.25, 0]]);
    SETS.perai = mkShot('perai', [[1.05, 1.5, 5.6, 1.3, 1.42, 2.3], [1.15, 1.48, 5.25, 1.36, 1.42, 2.3]]);
    SETS.balanca = mkShot('balanca', [[0.1, 2.4, 10.2, 0.2, 2.2, 0], [0.25, 2.45, 9.3, 0.3, 2.3, 0]]);
  }

  // ================================================================= australia
  {
    const g = new THREE.Group();
    ground(g, '#d9733b');
    const rock = ball(5, '#b7472a', 2, 0.03);
    rock.scale.set(1.6, 0.45, 0.8);
    g.add(at(rock, 2, 0, -16));
    [[-3.6, -3, 0.5], [3.8, -4, 0.6], [-2.4, -7, 0.7], [5.5, -9, 0.6], [-6, -10, 0.8]].forEach(([x, z, r]) => {
      const b = ball(r, '#7a9a3a', 1);
      b.scale.y = 0.7;
      g.add(at(b, x, r * 0.5, z));
    });
    [[-2, 7, -14, 1.6], [3, 8, -16, 1.4]].forEach(([x, y, z, s]) => g.add(at(cloud(s), x, y, z)));
    g.add(at(cyl(0.06, 0.06, 2.6, '#7a4a1e', 6), -2.3, 1.3, -0.6));
    const place = paperSign(1.9, 0.6, 'AUSTRÁLIA', {bg: '#fff3b0'});
    g.add(at(place.mesh, -2.3, 2.45, -0.52));
    // shelf with 12 trophies
    g.add(at(box(3.2, 0.12, 0.6, '#8a5a2b'), 0.9, 1.25, -1.2));
    g.add(at(box(3.2, 0.12, 0.6, '#8a5a2b'), 0.9, 2.15, -1.2));
    for (const sx of [-1.55, 1.55]) g.add(at(box(0.1, 2.25, 0.5, '#6e4520', 0.02), 0.9 + sx, 1.12, -1.2));
    const tr12 = [];
    for (let i = 0; i < 12; i++) {
      const tr = trophy();
      tr.userData = {x: 0.9 - 1.25 + (i % 6) * 0.5, y: i < 6 ? 1.31 : 2.21, z: -1.15};
      g.add(tr);
      tr12.push(tr);
    }
    const rules = paperSign(3.4, 1.5, '', {bg: '#ffffff', border: '#c8324a', rows: [['REGRAS NOVAS', 0.3, 0.2, '#c8324a'], ['PROIBIDO COMPRAR', 0.58, 0.13, INK], ['TODOS OS BILHETES', 0.78, 0.13, INK]]});
    const rulesG = new THREE.Group();
    rulesG.add(at(rules.mesh, 0, 0, 0.05));
    rulesG.add(box(3.55, 1.65, 0.08, '#c8324a', 0.02));
    g.add(rulesG);
    const hero = mkChar('mandel', g);
    const inv = [mkChar('helper', g, 1.85), mkChar('viewer', g, 1.85)];
    const tInv = W(5, 'investidores'), tDoze = W(5, 'doze'), tMudar = W(5, 'mudar');
    SETS.australia = {
      g,
      bg: sky('#4aa8ff', '#ffd9a8'),
      cam: [[-0.5, 2.1, 9.6, -0.3, 1.9, 0], [-0.3, 2.2, 8.8, -0.2, 2.0, 0]],
      upd(t) {
        hero.place(-0.6, 0, 1.2);
        const worried = t > tMudar + 0.2;
        hero.draw({expr: worried ? 'worried' : t > tDoze ? 'grin' : 'smug', armL: [14, 8], armR: t > tDoze && !worried ? [135, 165] : [14, 8], propR: t > tDoze && !worried ? 'ticket' : null, lookX: worried ? 0.6 : 0.3, sweat: worried, blink: blink(t)});
        inv.forEach((ch, i) => {
          const p = pop(t, tInv - 0.1 + i * 0.15, 0.3);
          ch.place(-2.1 + i * 0.8 + (1 - p) * -2, 0, 2.0 + i * 0.5, p > 0.01);
          ch.draw({expr: worried ? 'shock' : 'grin', armL: [14, 8], armR: [40, 20], propR: 'bag', lookX: 0.6, blink: blink(t, i)});
        });
        tr12.forEach((tr, i) => {
          const {x, y, z} = tr.userData;
          const p = pop(t, tDoze - 0.2 + i * 0.09, 0.25);
          tr.visible = p > 0.01;
          tr.position.set(x, y, z);
          tr.scale.setScalar(Math.max(0.01, p * 1.2));
        });
        const drop = prog(t, tMudar - 0.15, tMudar + 0.3, easeOutBack);
        rulesG.position.set(0.9, lerp(7.5, 3.75, drop), -0.6);
        rulesG.rotation.z = 0.05 * Math.sin((t - tMudar) * 18) * Math.exp(-Math.max(0, t - tMudar - 0.3) * 4) * (drop > 0.99 ? 1 : 0);
      },
    };
  }

  // ================================================================== virginia
  {
    const g = new THREE.Group();
    ground(g, '#2b3550');
    g.add(at(box(14, 0.06, 2.2, '#3d4766', 0), 0, 0.03, 2.2));
    const winTex = (() => {
      const cv = document.createElement('canvas');
      cv.width = 64;
      cv.height = 128;
      const c = cv.getContext('2d');
      c.fillStyle = '#1e2747';
      c.fillRect(0, 0, 64, 128);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 4; x++) {
          c.fillStyle = hash(x + y * 4, 9) > 0.45 ? '#ffd76a' : '#33406a';
          c.fillRect(6 + x * 14, 6 + y * 15, 9, 10);
        }
      const tx = new THREE.CanvasTexture(cv);
      tx.colorSpace = THREE.SRGBColorSpace;
      tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
      tx.magFilter = THREE.NearestFilter;
      return tx;
    })();
    [[-5.5, -6, 2.2, 7], [-3.2, -8, 2.0, 10], [3.6, -7, 2.4, 9], [6, -5, 2.0, 6], [-7.5, -9, 2.4, 12], [0.4, -12, 3, 13]].forEach(([x, z, w, h], i) => {
      const tx = winTex.clone();
      tx.needsUpdate = true;
      tx.repeat.set(w / 1.2, h / 2.4);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2), new THREE.MeshBasicMaterial({map: tx}));
      g.add(at(m, x, h / 2, z));
    });
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({length: 240}, (_, i) => [(hash(i, 1) - 0.5) * 60, 8 + hash(i, 2) * 20, -25 - hash(i, 3) * 5]).flat(), 3)),
      new THREE.PointsMaterial({color: '#ffffff', size: 0.12}),
    );
    g.add(stars);
    // billboard
    g.add(at(box(0.16, 3.2, 0.16, '#5a6478', 0.02), -1.2, 1.6, -1.5));
    g.add(at(box(0.16, 3.2, 0.16, '#5a6478', 0.02), 2.2, 1.6, -1.5));
    let vKey = '';
    const bb = sign(4.2, 2.6, 1260, 780, (c, w, h, st = {}) => {
      c.fillStyle = '#121a3a';
      c.fillRect(0, 0, w, h);
      c.lineWidth = 24;
      c.strokeStyle = '#ffd23f';
      c.strokeRect(12, 12, w - 24, h - 24);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = '900 92px Inter';
      c.fillStyle = '#ffffff';
      c.fillText('LOTERIA DA VIRGÍNIA', w / 2, 92);
      if (st.combos) {
        c.font = '900 110px Inter';
        c.fillStyle = '#7fd4ff';
        c.fillText('7 MILHÕES', w / 2, 238);
        c.font = '800 58px Inter';
        c.fillStyle = '#cfd8ff';
        c.fillText('de combinações' + (st.dollar ? '  ×  US$ 1' : ''), w / 2, 320);
      }
      if (st.prize != null) {
        c.font = '900 70px Inter';
        c.fillStyle = '#ffd23f';
        c.fillText('PRÊMIO', w / 2, 448);
        c.font = '900 128px Inter';
        c.fillText(`US$ ${st.prize} MILHÕES`, w / 2, 600);
      }
    });
    const bbG = new THREE.Group();
    bbG.add(box(4.4, 2.8, 0.2, '#2b3550', 0.03));
    bbG.add(at(bb.mesh, 0, 0, 0.11));
    g.add(at(bbG, 0.5, 4.3, -1.5));
    const lamps = [];
    for (let i = 0; i < 14; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 1), new THREE.MeshBasicMaterial({color: '#fff2a8'}));
      g.add(at(b, -1.5 + i * 0.3, 5.82, -1.36));
      lamps.push(b);
    }
    const hero = mkChar('mandel', g);
    const tSete = W(6, 'sete'), tDolar = W(6, 'dolar'), tPremio = W(6, 'premio'), tVinte = W(6, 'vinte');
    SETS.virginia = {
      g,
      bg: sky('#0b1230', '#3b2a6b'),
      cam: [[-0.6, 1.6, 8.2, 0.2, 2.8, 0], [-0.2, 1.8, 7.4, 0.35, 3.1, 0]],
      upd(t) {
        const st = {combos: t > tSete - 0.05 ? 1 : 0, dollar: t > tDolar - 0.05 ? 1 : 0, prize: t > tPremio - 0.05 ? Math.round(27 * clamp01((t - tVinte) / 1.1)) : null};
        const key = JSON.stringify(st);
        if (key !== vKey) {
          bb.repaint(st);
          vKey = key;
        }
        const glow = st.prize === 27 ? 1 : 0;
        lamps.forEach((b, i) => b.material.color.set(glow && (i + Math.floor(t * 6)) % 2 ? '#ff9f1c' : '#fff2a8'));
        bbG.scale.setScalar(1 + 0.04 * glow * Math.exp(-(t - tVinte - 1.1) * 4) * (t > tVinte + 1.1 ? 1 : 0));
        hero.place(-0.7, 0, 2.2);
        hero.draw({expr: st.prize === 27 ? 'grin' : t > tSete ? 'think' : 'smug', lookY: -1, lookX: 0.6, armL: [14, 8], armR: st.prize === 27 ? [140, 170] : [20, 150], blink: blink(t, 0.7)});
      },
    };
  }

  // ======================================================= armazém (corrida/final)
  {
    const g = new THREE.Group();
    g.add(at(box(16, 0.2, 12, '#9aa3b5', 0), 0, -0.1, 0));
    g.add(at(box(16, 8, 0.2, '#6b7590', 0), 0, 4, -3.2));
    for (let i = 0; i < 6; i++) g.add(at(box(0.3, 8, 0.25, '#58617a', 0.02), -7 + i * 2.8, 4, -3.0));
    // ticket mountain: instanced paper slips in a cone, filled bottom-up
    const NT = 1500;
    const slips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.035, 0.16), new THREE.MeshToonMaterial({color: '#ffffff'}), NT);
    const slipPos = [];
    for (let i = 0; i < NT; i++) {
      const u = i / NT;
      const y = (1 - Math.cbrt(1 - u)) * 2.6;
      const r = Math.max(0.15, 2.7 * (1 - y / 2.75)) * Math.sqrt(hash(i, 1));
      const a = hash(i, 2) * Math.PI * 2;
      slipPos.push([0.6 + Math.cos(a) * r * 1.25, y + 0.02, -1.0 + Math.sin(a) * r * 0.6, hash(i, 3) * 3, (hash(i, 4) - 0.5) * 0.6]);
      slips.setColorAt(i, new THREE.Color(['#fff3b0', '#ffe58a', '#ffffff', '#ffd9e0'][i % 4]));
    }
    slips.frustumCulled = false;
    g.add(slips);
    const setSlips = (n) => {
      for (let i = 0; i < NT; i++) {
        const [x, y, z, ry, rz] = slipPos[i];
        if (i < n) {
          E.set(0, ry, rz);
          M.compose(P.set(x, y, z), Q.setFromEuler(E), S1);
        } else M.makeScale(0, 0, 0);
        slips.setMatrixAt(i, M);
      }
      slips.instanceMatrix.needsUpdate = true;
    };
    // wall clock
    g.add(at(cyl(0.7, 0.7, 0.08, '#ffffff', 24), -3.2, 5.2, -3.05).rotateX(Math.PI / 2));
    const hand = new THREE.Group();
    hand.position.set(-3.2, 5.2, -2.98);
    hand.add(at(box(0.06, 0.6, 0.03, INK, 0), 0, 0.27, 0));
    g.add(hand);
    const hand2 = new THREE.Group();
    hand2.position.set(-3.2, 5.2, -2.97);
    hand2.add(at(box(0.08, 0.4, 0.03, '#c8324a', 0), 0, 0.18, 0));
    g.add(hand2);
    const falta = paperSign(2.6, 0.85, 'FALTAM BILHETES!', {bg: '#c8324a', fg: '#ffffff', border: '#7a1f2b'});
    g.add(falta.mesh);
    const hero = mkChar('mandel', g);
    const run = [mkChar('helper', g, 1.85), mkChar('viewer', g, 1.85), mkChar('helper', g, 1.7)];
    const cf = confetti(g, 90, [-3, 3, 0.5, 7, -1.5, 2]);
    const tMas = W(7, 'mas'), tFalt = W(7, 'faltaram'), tEmbora = W(7, 'premio');
    SETS.corrida = {
      g,
      bg: new THREE.Color('#4c5570'),
      cam: [[0.8, 2.4, 9.4, 0.4, 2.0, -0.6], [0.5, 2.2, 8.2, 0.3, 1.9, -0.4]],
      upd(t, sh) {
        const n = Math.round(NT * 0.86 * clamp01((t - sh.start + 0.4) / (tFalt - sh.start + 0.4)));
        setSlips(n);
        hand.rotation.z = -t * 6;
        hand2.rotation.z = -t * 0.5;
        const fp = pop(t, tFalt - 0.05, 0.3);
        falta.mesh.visible = fp > 0.01;
        falta.mesh.scale.setScalar(Math.max(0.01, fp));
        falta.mesh.position.set(0.6, 3.6, 0.6);
        falta.mesh.rotation.z = 0.06;
        run.forEach((ch, i) => {
          const per = 1.7 + i * 0.35, ph = frac((t + i * 0.6) / per);
          const dir = i % 2 ? -1 : 1;
          const x = 0.4 + dir * lerp(-3.0, 3.0, ph);
          const running = t < tMas + 0.6;
          ch.place(running ? x : [-0.9, 1.5, 2.2][i], Math.abs(Math.sin(t * 11 + i)) * 0.12 * (running ? 1 : 0), 1.6 + i * 0.45, true);
          ch.mesh.scale.x = ch.mesh.scale.y * (running ? dir : 1);
          ch.draw({expr: running ? 'grin' : 'worried', walk: running ? t * 11 + i : null, armL: running ? [40 + 30 * Math.sin(t * 11 + i), 30] : [150, 208], armR: running ? [40, 20] : [150, 208], propR: running ? 'stack' : null, lookX: running ? 0.5 : 0, sweat: !running});
        });
        hero.place(-0.3, 0, 3.9);
        hero.draw({expr: t > tEmbora ? 'shock' : t > tFalt ? 'worried' : 'think', armL: [14, 8], armR: t < tMas ? [95, 70] : [14, 8], lookX: 0.6, sweat: t > tFalt, blink: blink(t, 0.2)});
        cf.upd(t, 0);
      },
    };
    const tEle = W(10, 'ele');
    SETS.final = {
      g,
      bg: new THREE.Color('#4c5570'),
      cam: null,
      camFn(t, sh) {
        const k = prog(t, tEle - 0.2, tEle + 1.6, easeInOutCubic);
        const from = [-1.2, 1.8, 5.6, -1.2, 1.55, 2.2], to = [0.2, 3.2, 11.5, 0.2, 2.2, -0.4];
        return from.map((v, i) => lerp(v, to[i], k));
      },
      upd(t) {
        setSlips(NT);
        hand.rotation.z = -t * 6;
        hand2.rotation.z = -t * 0.5;
        falta.mesh.visible = false;
        run.forEach((ch) => ch.place(0, 0, 0, false));
        hero.place(-1.2, 0, 2.2);
        const after = t > tEle;
        hero.draw({expr: after ? 'smug' : 'neutral', armL: [14, 8], armR: after ? [135, 165] : [60, 120], propR: 'ticket', lookX: after ? 0.3 : 0.1, blink: blink(t, 1.3)});
        cf.upd(t, after ? clamp01((t - tEle - 1.0) / 1.0) : 0);
      },
    };
  }

  // ================================================================== sorteio
  {
    const g = new THREE.Group();
    g.add(at(box(14, 0.2, 10, '#3a2466', 0), 0, -0.1, 0));
    g.add(at(box(14, 8, 0.2, '#251645', 0), 0, 4, -3));
    for (let i = 0; i < 5; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 16, 1, true), new THREE.MeshBasicMaterial({color: '#bba6ff', transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false}));
      g.add(at(cone, -4 + i * 2, 4.5, -1.5));
    }
    g.add(at(cyl(0.9, 1.1, 0.3, '#c9a227', 16), 0, 0.15, -0.4));
    g.add(at(cyl(0.12, 0.12, 1.2, '#c9a227', 8), 0, 0.85, -0.4));
    const R = 1.25, C = new THREE.Vector3(0, 2.75, -0.4);
    const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 3), new THREE.MeshBasicMaterial({color: '#bfe8ff', transparent: true, opacity: 0.16, depthWrite: false}));
    g.add(at(globe, C.x, C.y, C.z));
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(R, 1)), new THREE.LineBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.6}));
    g.add(at(wire, C.x, C.y, C.z));
    const ballCols = ['#ff4d6d', '#ffd23f', '#4dd4ff', '#7bed9f', '#ff9f1c', '#b28dff', '#ffffff'];
    const balls = Array.from({length: 18}, (_, i) => {
      const b = ball(0.17, ballCols[i % ballCols.length], 1, 0.02);
      g.add(b);
      return b;
    });
    const tube = cyl(0.22, 0.22, 1.2, '#bfe8ff', 10, 0.02);
    tube.material.transparent = true;
    tube.material.opacity = 0.35;
    tube.rotation.z = Math.PI / 2.6;
    g.add(at(tube, 1.55, 1.6, -0.4));
    const win = ball(0.24, '#ffd23f', 2, 0.025);
    g.add(win);
    const tick = paperSign(2.6, 0.8, '', {bg: '#35c46a', border: '#1d6b3a', rows: [['É DELES!', 0.52, 0.5, '#ffffff']]});
    g.add(tick.mesh);
    const hero = mkChar('mandel', g);
    const cf = confetti(g, 120, [-2.5, 3.5, 0.2, 6.5, -1.2, 2.2]);
    const tSaiu = L(8).a, tEnd = L(8).b;
    SETS.sorteio = {
      g,
      bg: new THREE.Color('#1a1033'),
      cam: null,
      camFn(t, sh) {
        const k = prog(t, sh.start, tSaiu + 0.2, easeInOutCubic);
        const k2 = prog(t, tSaiu + 0.4, tEnd + 0.2, easeInOutCubic);
        const a = [0.0, 2.8, 3.6, 0, 2.7, -0.4], b = [0.3, 2.6, 4.6, 0.6, 2.2, -0.2], c2 = [0.9, 2.4, 6.6, 0.9, 2.0, 0.1];
        return a.map((v, i) => lerp(lerp(v, b[i], k), c2[i], k2));
      },
      upd(t) {
        const spin = t < tSaiu ? 1 : Math.exp(-(t - tSaiu) * 3);
        balls.forEach((b, i) => {
          const s = 2.2 + hash(i, 1) * 2;
          const v = new THREE.Vector3(Math.sin(t * s * spin + i), Math.sin(t * s * 1.3 * spin + i * 2.1), Math.cos(t * s * 0.9 * spin + i * 0.7)).normalize().multiplyScalar(0.85 * (0.4 + 0.6 * hash(i, 5)));
          b.position.copy(C).add(v);
        });
        const k = prog(t, tSaiu - 0.15, tSaiu + 0.45, easeOutCubic);
        const out = k < 0.5 ? C.clone().lerp(new THREE.Vector3(1.0, 2.0, -0.4), k * 2) : new THREE.Vector3(1.0, 2.0, -0.4).lerp(new THREE.Vector3(1.4, 0.95, 0.7), (k - 0.5) * 2);
        win.position.copy(out);
        win.visible = t > tSaiu - 0.15;
        const tp = pop(t, tSaiu + 0.45, 0.3);
        tick.mesh.visible = tp > 0.01;
        tick.mesh.scale.setScalar(Math.max(0.01, tp));
        tick.mesh.position.set(0.8, 3.55, 0.4);
        const won = t > tSaiu + 0.35;
        hero.place(1.85, 0, 1.7);
        hero.draw({expr: won ? 'grin' : 'worried', armL: won ? [150, 172] : [150, 208], armR: won ? [140, 168] : [150, 208], propR: won ? 'ticket' : null, lookX: -0.7, sweat: !won, squash: won ? 0.03 * Math.sin(t * 9) : 0});
        hero.mesh.position.y = won ? Math.abs(Math.sin(t * 9)) * 0.12 : 0;
        cf.upd(t, won ? 1 : 0);
      },
    };
  }

  // ============================================================= investigação
  {
    const g = new THREE.Group();
    g.add(at(box(12, 0.2, 9, '#8f6a4a', 0), 0, -0.1, 0.5));
    g.add(at(box(12, 7, 0.2, '#e7d8b8', 0), 0, 3.5, -1.7));
    g.add(at(box(12, 0.3, 0.1, '#7a5a3a', 0.015), 0, 0.15, -1.56));
    g.add(at(box(1.8, 1.2, 0.1, '#a8d8ff', 0.03), -2.2, 3.4, -1.6));
    g.add(at(box(0.9, 1.7, 0.6, '#7d8597'), 2.6, 0.85, -1.2));
    for (let i = 0; i < 3; i++) g.add(at(box(0.6, 0.05, 0.05, INK, 0), 2.6, 0.4 + i * 0.5, -0.88));
    g.add(at(box(2.6, 0.12, 1.2, '#7a4a1e'), 0.2, 1.05, 0.6));
    for (const [sx, sz] of [[-1.15, 0.1], [1.15, 0.1], [-1.15, 1.1], [1.15, 1.1]]) g.add(at(box(0.1, 1.0, 0.1, '#5e3816', 0.015), 0.2 + sx, 0.5, sz));
    const papers = paperSign(0.9, 0.6, '', {rows: [['DOSSIÊ', 0.5, 0.28, INK]]});
    papers.mesh.rotation.x = -Math.PI / 2;
    g.add(at(papers.mesh, 0.7, 1.12, 0.7));
    const lens = new THREE.Group();
    lens.add(solid(new THREE.TorusGeometry(0.55, 0.07, 8, 28), '#5a3a22', 0.02));
    lens.add(new THREE.Mesh(new THREE.CircleGeometry(0.55, 28), new THREE.MeshBasicMaterial({color: '#bfe8ff', transparent: true, opacity: 0.28, depthWrite: false})));
    lens.add(at(box(0.12, 0.8, 0.1, '#5a3a22', 0.02), 0.5, -0.62, 0).rotateZ(0.7));
    g.add(lens);
    const legal = paperSign(2.8, 0.9, '', {bg: '#35c46a', border: '#1d6b3a', rows: [['DENTRO DA LEI', 0.52, 0.44, '#ffffff']]});
    const changed = paperSign(2.8, 1.1, '', {bg: '#ffffff', border: '#c8324a', rows: [['REGRAS MUDARAM', 0.36, 0.26, '#c8324a'], ['NÃO FUNCIONA MAIS', 0.7, 0.18, INK]]});
    g.add(legal.mesh, changed.mesh);
    const hero = mkChar('mandel', g);
    const tAch = W(9, 'acharam'), tLei = W(9, 'lei'), tHoje = W(9, 'hoje');
    SETS.investigacao = {
      g,
      bg: new THREE.Color('#e7d8b8'),
      cam: [[0.0, 2.2, 6.4, 0.0, 2.15, 0], [0.1, 2.2, 5.8, 0.1, 2.2, 0]],
      upd(t, sh) {
        hero.place(-0.5, 0, -0.2);
        const k = clamp01((t - sh.start) / (tAch - sh.start));
        const sweep = t < tAch + 0.3;
        lens.visible = sweep;
        lens.position.set(-0.5 + Math.sin(k * Math.PI * 2.2) * 0.9, 2.2 + Math.cos(k * Math.PI * 3) * 0.6, 0.9);
        const lp = pop(t, tLei - 0.1, 0.25);
        legal.mesh.visible = lp > 0.01 && t < tHoje - 0.1;
        legal.mesh.scale.setScalar(Math.max(0.01, 0.72 * lp * (1 + 0.6 * Math.exp(-(t - tLei) * 10))));
        legal.mesh.position.set(0.1, 3.95, -1.2);
        legal.mesh.rotation.z = -0.08;
        const cp = pop(t, tHoje - 0.05, 0.3);
        changed.mesh.visible = cp > 0.01;
        changed.mesh.scale.setScalar(Math.max(0.01, 0.72 * cp));
        changed.mesh.position.set(0.1, 3.95, -1.15);
        changed.mesh.rotation.z = 0.05;
        hero.draw({expr: t < tAch ? 'worried' : t < tHoje ? 'smug' : 'neutral', sweat: t < tAch, armL: [14, 8], armR: t > tLei && t < tHoje ? [130, 165] : [14, 8], lookX: sweep ? Math.sin(k * Math.PI * 2.2) * 0.8 : 0.2, blink: blink(t, 0.9)});
      },
    };
  }

  for (const g of new Set(Object.values(SETS).map((x) => x.g))) scene.add(g);

  // ------------------------------------------------------------------- overlay
  const app = document.getElementById('app');
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = '<div class="brand">NINGUÉM <b>TE CONTOU</b></div><div class="tag">Stefan Mandel<small>economista romeno</small></div><div class="capw"></div>';
  app.appendChild(ov);
  const capw = ov.querySelector('.capw');
  const tag = ov.querySelector('.tag');
  if (cfg.clean) ov.style.display = 'none';
  const tStefan = W(1, 'stefan');

  const render = (t) => {
    const sh = SHOTS.find((s) => t >= s.start && t < s.end) || SHOTS[SHOTS.length - 1];
    const set = SETS[sh.id];
    const c = set.camFn ? set.camFn(t, sh) : set.cam[0].map((v, i) => lerp(v, set.cam[1][i], easeOutCubic(clamp01((t - sh.start) / (sh.end - sh.start)))));
    camera.position.set(c[0], c[1], c[2]);
    camera.lookAt(c[3], c[4], c[5]);
    for (const s of Object.values(SETS)) s.g.visible = s.g === set.g;
    scene.background = set.bg;
    set.upd(t, sh);
    for (const ch of chars) ch.mesh.rotation.y = Math.atan2(camera.position.x - ch.mesh.position.x, camera.position.z - ch.mesh.position.z);
    renderer.render(scene, camera);

    const w = CAPS.find((x) => t >= x.a && t < x.b);
    if (w) {
      if (capw.textContent !== w.text) capw.textContent = w.text;
      capw.className = 'capw' + (w.hot ? ' hot' : '');
      const p = easeOutBack(clamp01((t - w.a) / 0.12));
      capw.style.transform = `scale(${0.7 + 0.3 * p}) rotate(${w.hot ? -3 : 0}deg)`;
      capw.style.opacity = 1;
    } else capw.style.opacity = 0;
    tag.style.opacity = inOut(t, tStefan - 0.1, tStefan + 2.6);
    tag.style.transform = `translateX(${(1 - easeOutCubic(clamp01((t - tStefan + 0.1) / 0.35))) * -60}px)`;
    return {};
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
