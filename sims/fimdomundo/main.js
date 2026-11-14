import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutBack, easeOutCubic, lerp, prog, smooth} from '../kit/util.js';
import {createChar, INK} from '../loteria/char.js';
import {at, ball, blobShadow, box, cloud, cyl, sign, sky, solid, toon} from '../loteria/world.js';
import WORDS_RAW from './narracao-fit-words.json';

// "O fim do mundo estava marcado pra ontem" (Ninguém Te Contou, @curiosidadesntc).
// Same look as the lottery video: 2D cutout characters in a toon 3D world.
// Fast cuts; every beat is keyed to the narration word timings.

const frac = (x) => x - Math.floor(x);
const hash = (i, k = 0) => frac(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453);
const norm = (w) => w.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
const pop = (t, t0, d = 0.3) => prog(t, t0, t0 + d, easeOutBack);
const inOut = (t, a, b, f = 0.2) => smooth((t - a) / f) * (1 - smooth((t - b) / f));

const LINES = [];
for (const w of WORDS_RAW) (LINES[w.line] ||= []).push(w);
const L = (n) => ({a: LINES[n][0].a, b: LINES[n][LINES[n].length - 1].b});
const W = (n, prefix, nth = 0) => {
  const p = norm(prefix);
  const ws = LINES[n].filter((x) => norm(x.w).startsWith(p));
  if (!ws[nth]) throw new Error(`word "${prefix}" #${nth} not in line ${n}`);
  return ws[nth].a;
};
const DUR = +(WORDS_RAW[WORDS_RAW.length - 1].b + 1.8).toFixed(2);
const ACCENT = ['ontem', 'vidente', 'cientistas', 'science', 'juizo', 'final', 'infinito', 'aniversario', 'devagar', 'menores', 'bilhoes', 'acabou', 'formula'];

const CAPS = [];
for (const ws of LINES) {
  for (let i = 0; i < ws.length; i++) {
    const g = [ws[i]];
    if (norm(ws[i].w).length <= 3 && i + 1 < ws.length && !/[.?!…:,]$/.test(ws[i].w)) g.push(ws[++i]);
    const next = ws[i + 1];
    CAPS.push({a: g[0].a - 0.04, b: next ? next.a - 0.04 : g[g.length - 1].b + 0.25, text: g.map((x) => x.w).join(' ').replace(/[.,…:]+$/, ''), hot: g.some((x) => ACCENT.includes(norm(x.w)))});
  }
}

// shots: [id, start]
const SHOTS = [
  ['rua', 0],
  ['vidente', L(1).a - 0.1],
  ['lab', W(1, 'foram') - 0.08],
  ['revista', L(2).a - 0.1],
  ['conta', L(3).a - 0.1],
  ['multiplica', L(4).a - 0.1],
  ['curva', W(4, 'nesse') - 0.08],
  ['data', L(5).a - 0.1],
  ['perai', L(6).a - 0.1],
  ['bolo', L(7).a - 0.1],
  ['provoca', W(7, 'ele') - 0.08],
  ['mas', L(8).a - 0.1],
  ['desacelera', L(9).a - 0.1],
  ['planeta', L(10).a - 0.1],
  ['fim', L(11).a - 0.1],
  ['cta', L(12).a - 0.1],
].map(([id, start]) => ({id, start}));
SHOTS.forEach((s, i) => (s.end = i + 1 < SHOTS.length ? SHOTS[i + 1].start : DUR));

const DEFAULTS = {duration: DUR, fps: 30, hud: {enabled: false, title: 'fimdomundo', subtitle: ''}, director: {enabled: false}, watermark: ''};

runSim(DEFAULTS, async ({canvas, cfg}) => {
  await document.fonts.load('900 40px "Inter"').catch(() => {});
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.1, 300);
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9c4e0', 1.25));
  const sun = new THREE.DirectionalLight('#ffffff', 2.0);
  sun.position.set(4, 8, 6);
  scene.add(sun);

  const chars = [];
  const mkChar = (look, parent, h = 2) => {
    const ch = createChar(THREE, look);
    ch.shadow = blobShadow(0.5 * (h / 2));
    parent.add(ch.mesh, ch.shadow);
    ch.place = (x, y, z, vis = true, sc = 1) => {
      ch.mesh.scale.setScalar((h / 2) * sc);
      ch.mesh.position.set(x, y, z);
      ch.shadow.position.set(x, y + 0.012, z);
      ch.mesh.visible = ch.shadow.visible = vis;
    };
    chars.push(ch);
    return ch;
  };
  const blink = (t, ph = 0) => frac((t + ph) / 3.1) < 0.045;
  const groundPlane = (parent, color) => {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), toon(color));
    g.rotation.x = -Math.PI / 2;
    parent.add(g);
  };
  const SETS = {};

  // ======================================================== rua (apocalypse)
  {
    const g = new THREE.Group();
    groundPlane(g, '#9b6b4a');
    for (let i = 0; i < 9; i++) {
      const h = 2 + hash(i, 1) * 4;
      g.add(at(box(1.6, h, 1.6, ['#6b4d6e', '#8a5a6a', '#5a4a72'][i % 3], 0.03), -7 + i * 1.8, h / 2, -9 - hash(i, 2) * 3));
    }
    [[-3, 7, -14, 1.6], [3, 8, -16, 1.3]].forEach(([x, y, z, s]) => {
      const c = cloud(s);
      c.children.forEach((m) => (m.material = new THREE.MeshBasicMaterial({color: '#ffb38a'})));
      g.add(at(c, x, y, z));
    });
    g.add(at(box(0.16, 3.2, 0.16, '#4a4060', 0.02), -1.4, 1.6, -1.6));
    g.add(at(box(0.16, 3.2, 0.16, '#4a4060', 0.02), 1.4, 1.6, -1.6));
    const cal = sign(3.2, 3.4, 960, 1020, (c, w, h, st = {}) => {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#e63946';
      c.fillRect(0, 0, w, 260);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = '900 120px Inter';
      c.fillStyle = '#fff';
      c.fillText('NOVEMBRO', w / 2, 100);
      c.font = '800 80px Inter';
      c.fillText('2026', w / 2, 205);
      c.font = '900 420px Inter';
      c.fillStyle = INK;
      c.fillText('13', w / 2, 560);
      c.font = '900 110px Inter';
      c.fillText('SEXTA-FEIRA', w / 2, 850);
      if (st.x) {
        c.strokeStyle = '#e63946';
        c.lineWidth = 46;
        c.lineCap = 'round';
        c.beginPath();
        c.arc(w / 2, 560, 330 * Math.min(1, st.x), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, st.x));
        c.stroke();
      }
    });
    const calG = new THREE.Group();
    calG.add(box(3.4, 3.6, 0.2, INK, 0.02));
    calG.add(at(cal.mesh, 0, 0, 0.11));
    g.add(at(calG, 0, 4.4, -1.6));
    const hero = mkChar('viewer', g);
    let calKey = -1;
    SETS.rua = {
      g,
      bg: sky('#ff7a59', '#ffd29a'),
      cam: [[0.3, 2.6, 9.6, 0, 3.0, 0], [0.1, 2.9, 8.3, 0, 3.2, 0]],
      upd(t) {
        const k = Math.round(clamp01((t - W(0, 'ontem') + 0.05) / 0.5) * 20) / 20;
        if (k !== calKey) {
          cal.repaint({x: k});
          calKey = k;
        }
        hero.place(-1.5, 0, 1.6);
        hero.draw({expr: t > W(0, 'ontem') ? 'shock' : 'worried', armL: [150, 208], armR: [150, 208], lookX: 0.4, lookY: -0.8, sweat: true});
      },
    };
  }

  // ================================================================= vidente
  {
    const g = new THREE.Group();
    groundPlane(g, '#3a2466');
    g.add(at(box(12, 7, 0.2, '#6b3fa0', 0), 0, 3.5, -2.6));
    for (let i = 0; i < 9; i++) g.add(at(box(0.5, 7, 0.08, '#5a3290', 0), -4 + i, 3.5, -2.45));
    for (let i = 0; i < 14; i++) g.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({color: '#ffd23f'})), -4 + hash(i, 4) * 8, 2.5 + hash(i, 5) * 3.5, -2.3));
    g.add(at(cyl(0.9, 1.0, 0.9, '#8a5a2b', 14), 0, 0.45, 0));
    g.add(at(solid(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 18), '#c8324a', 0.02), 0, 0.92, 0));
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 3), new THREE.MeshBasicMaterial({color: '#bfa6ff', transparent: true, opacity: 0.75}));
    g.add(at(orb, 0, 1.5, 0));
    const seer = mkChar('helper', g);
    SETS.vidente = {
      g,
      bg: new THREE.Color('#1e1236'),
      cam: [[0.3, 2.0, 5.6, 0, 1.7, -0.4], [0.1, 1.95, 5.0, 0, 1.7, -0.4]],
      upd(t) {
        orb.material.color.setHSL(0.72 + 0.05 * Math.sin(t * 4), 0.8, 0.75);
        orb.scale.setScalar(1 + 0.05 * Math.sin(t * 6));
        seer.place(-1.15, 0, -0.6);
        seer.draw({expr: 'smug', armL: [120, 140], armR: [120, 140], lookY: -0.6});
      },
    };
  }

  // ===================================================================== lab
  const boardState = {mode: 'blank', k: 0, t: 0, date: 0, title: 0, line2: 0, x: 0, dashed: 0};
  let boardKey = '';
  const board = sign(3.6, 2.4, 1260, 840, (c, w, h, st = boardState) => {
    c.fillStyle = '#24533f';
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.07;
    for (let i = 0; i < 40; i++) {
      c.fillStyle = '#fff';
      c.fillRect(hash(i, 1) * w, hash(i, 2) * h, 140 * hash(i, 3), 6);
    }
    c.globalAlpha = 1;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const chalk = '#f4f4f4';
    if (st.mode === 'revista') {
      // magazine cover pinned on the board
      const mw = 560, mh = 760, mx = w / 2 - mw / 2, my = 40;
      c.fillStyle = '#fffaf0';
      c.fillRect(mx, my, mw, mh);
      c.fillStyle = '#c8102e';
      c.fillRect(mx, my, mw, 150);
      c.fillStyle = '#fff';
      c.font = '900 110px Georgia';
      c.fillText('Science', w / 2, my + 80);
      c.fillStyle = INK;
      c.font = '800 54px Inter';
      c.fillText('1960', w / 2, my + 210);
      if (st.title) {
        c.font = '900 92px Inter';
        c.fillStyle = '#c8102e';
        c.fillText('DIA DO', w / 2, my + 380);
        c.fillText('JUÍZO', w / 2, my + 480);
        c.fillText('FINAL', w / 2, my + 580);
      }
      c.fillStyle = '#c9cde6';
      for (let i = 0; i < 2; i++) c.fillRect(mx + 70, my + 650 + i * 40, mw - 140 - i * 120, 16);
    } else if (st.mode === 'conta') {
      c.font = '900 120px Inter';
      c.fillStyle = chalk;
      c.fillText('+ GENTE', w / 2, 220);
      if (st.line2) {
        c.font = '900 120px Inter';
        c.fillText('↓', w / 2, 400);
        c.fillStyle = '#ffd23f';
        c.fillText('+ RÁPIDO', w / 2, 600);
      }
    } else if (['curva', 'data', 'mas', 'desacelera', 'fim'].includes(st.mode)) {
      const x0 = 120, y0 = h - 90, x1 = w - 120, y1 = 90;
      c.strokeStyle = chalk;
      c.lineWidth = 8;
      c.beginPath();
      c.moveTo(x0, y1);
      c.lineTo(x0, y0);
      c.lineTo(x1, y0);
      c.stroke();
      c.font = '800 42px Inter';
      c.fillStyle = chalk;
      c.fillText('1960', x0 + 90, y0 + 50);
      // asymptote at 2026
      const ax = x1 - 120;
      const hyper = (u) => {
        // u in 0..1 -> y; population ~ 1/(T-t)
        const tt = lerp(0, 0.985, u);
        const v = 0.06 / (1 - tt);
        return y0 - Math.min(1.25, v) * (y0 - y1);
      };
      const xOf = (u) => lerp(x0, ax, lerp(0, 0.985, u) / 0.985);
      if (st.date || st.mode !== 'curva') {
        c.setLineDash([22, 18]);
        c.strokeStyle = '#ff8a8a';
        c.lineWidth = 6;
        c.beginPath();
        c.moveTo(ax, y0);
        c.lineTo(ax, y1 - 30);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = '#ff8a8a';
        c.font = '900 50px Inter';
        c.fillText('13/11/2026', ax - 40, y0 + 50);
      }
      const drawHyper = (k, col, dashed) => {
        c.strokeStyle = col;
        c.lineWidth = 12;
        c.lineCap = 'round';
        if (dashed) c.setLineDash([26, 22]);
        c.beginPath();
        const n = Math.max(2, Math.floor(120 * k));
        for (let i = 0; i <= n; i++) {
          const u = i / 120;
          const y = hyper(u);
          i ? c.lineTo(xOf(u), y) : c.moveTo(xOf(u), y);
        }
        c.stroke();
        c.setLineDash([]);
      };
      if (st.mode === 'curva' || st.mode === 'data') {
        drawHyper(st.k, '#ffd23f', false);
        if (st.k > 0.95) {
          c.fillStyle = '#ffd23f';
          c.font = '900 120px Inter';
          c.fillText('∞', ax - 40, y1 + 20);
        }
      } else {
        drawHyper(1, 'rgba(255,210,63,0.55)', true);
        // real curve: follows, then bends and flattens
        const k = st.mode === 'mas' ? 0.42 : st.k;
        c.strokeStyle = '#7fe0a0';
        c.lineWidth = 14;
        c.lineCap = 'round';
        c.beginPath();
        const n = Math.max(2, Math.floor(160 * k));
        for (let i = 0; i <= n; i++) {
          const u = i / 160;
          const xu = lerp(x0, x1 - 40, u);
          const yh = hyper(Math.min(u * 1.18, 0.42));
          const bend = u > 0.36 ? (u - 0.36) / 0.64 : 0;
          const yb = yh - (1 - Math.exp(-bend * 3)) * 140;
          const y = u < 0.36 ? hyper(u * 1.18) : yb;
          i ? c.lineTo(xu, y) : c.moveTo(xu, y);
        }
        c.stroke();
        if (st.mode === 'fim' && st.x) {
          c.strokeStyle = '#ff5a6a';
          c.lineWidth = 30;
          c.beginPath();
          const r = Math.min(1, st.x);
          c.moveTo(ax - 260, y1 + 60);
          c.lineTo(ax - 260 + 360 * r, y1 + 60 + 360 * r);
          c.stroke();
        }
      }
    }
  });
  const setBoard = (patch) => {
    Object.assign(boardState, patch);
    const key = JSON.stringify(boardState);
    if (key !== boardKey) {
      board.repaint(boardState);
      boardKey = key;
    }
  };
  {
    const g = new THREE.Group();
    g.add(at(box(14, 0.2, 10, '#d9b48a', 0), 0, -0.1, 0.5));
    g.add(at(box(14, 7, 0.2, '#e8e4d6', 0), 0, 3.5, -1.7));
    g.add(at(box(14, 0.3, 0.1, '#9a8a6a', 0.015), 0, 0.15, -1.56));
    g.add(at(box(3.9, 2.7, 0.14, '#8a5a2b'), 0.4, 2.7, -1.52));
    g.add(at(board.mesh, 0.4, 2.7, -1.44));
    // lab bench with flasks
    g.add(at(box(2.2, 0.1, 0.8, '#5d6a7a', 0.02), -3.4, 0.95, -0.6));
    g.add(at(box(2.0, 0.9, 0.7, '#7d8a9a', 0.02), -3.4, 0.45, -0.6));
    [['#7fe0a0', -4.0], ['#ff8a8a', -3.4], ['#8ac7ff', -2.8]].forEach(([col, x]) => {
      g.add(at(cyl(0.08, 0.2, 0.36, col, 10, 0.015), x, 1.18, -0.6));
      g.add(at(cyl(0.05, 0.05, 0.2, '#e8f4ff', 8, 0.012), x, 1.46, -0.6));
    });
    // crowd for the doubling shot (simple toon people)
    const N = 128;
    const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.09, 0.22, 4, 8), toon('#ffffff'), N);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 10, 8), toon('#f2c9a0'), N);
    const cols = ['#e63946', '#3f5fa8', '#3aa76d', '#f08a24', '#8a5cf6', '#ffd23f'];
    for (let i = 0; i < N; i++) body.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    body.frustumCulled = head.frustumCulled = false;
    g.add(body, head);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
    const setCrowd = (n, t) => {
      for (let i = 0; i < N; i++) {
        const on = i < n;
        const col = i % 16, row = Math.floor(i / 16);
        const x = -3.1 + col * 0.42 + (row % 2) * 0.2, z = 2.6 - row * 0.42;
        const hop = Math.abs(Math.sin(t * 7 + i)) * 0.06;
        const sc = on ? 1 : 0;
        S.setScalar(sc);
        M.compose(P.set(x, 0.2 + hop, z), Q, S);
        body.setMatrixAt(i, M);
        M.compose(P.set(x, 0.47 + hop, z), Q, S);
        head.setMatrixAt(i, M);
      }
      body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = true;
    };
    // birthday cake
    const cakeG = new THREE.Group();
    cakeG.add(at(cyl(0.7, 0.7, 0.1, '#ffffff', 18), 0, 0.05, 0));
    cakeG.add(at(cyl(0.55, 0.55, 0.42, '#ff9ec4', 18), 0, 0.31, 0));
    cakeG.add(at(cyl(0.4, 0.4, 0.34, '#fff3d0', 18), 0, 0.69, 0));
    const flames = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      cakeG.add(at(cyl(0.025, 0.025, 0.22, ['#4dd4ff', '#ffd23f', '#7bed9f', '#ff4d6d', '#b28dff'][i], 6, 0.01), Math.cos(a) * 0.25, 0.97, Math.sin(a) * 0.25));
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 6), new THREE.MeshBasicMaterial({color: '#ffb000'}));
      cakeG.add(at(f, Math.cos(a) * 0.25, 1.13, Math.sin(a) * 0.25));
      flames.push(f);
    }
    g.add(at(box(1.8, 0.1, 1.0, '#8a5a2b', 0.02), 1.9, 0.95, 0.7));
    g.add(at(box(1.6, 0.9, 0.8, '#6e4520', 0.02), 1.9, 0.45, 0.7));
    g.add(at(cakeG, 1.9, 1.0, 0.7));
    const prof = mkChar('scientist', g);
    const p2 = mkChar('mandel', g);
    const p3 = mkChar('helper', g);
    const viewer = mkChar('viewer', g);
    const show = (o) => {
      prof.place(0, 0, 0, false);
      p2.place(0, 0, 0, false);
      p3.place(0, 0, 0, false);
      viewer.place(0, 0, 0, false);
      setCrowd(0, 0);
      cakeG.visible = !!o.cake;
    };
    const boardCam = [[0.4, 2.6, 7.4, 0.4, 2.55, 0], [0.4, 2.65, 6.6, 0.4, 2.6, 0]];
    SETS.lab = {
      g, bg: new THREE.Color('#e8e4d6'), cam: [[-0.6, 2.2, 8.2, -0.4, 1.8, 0], [-0.4, 2.2, 7.4, -0.3, 1.9, 0]],
      upd(t) {
        show({});
        setBoard({mode: 'blank'});
        prof.place(-1.1, 0, 0.7);
        prof.draw({expr: 'smug', armR: [100, 80], lookX: 0.4, blink: blink(t)});
        p2.place(0.4, 0, 0.3);
        p2.draw({expr: 'grin', armL: [14, 8], armR: [14, 8], blink: blink(t, 1)});
        p3.place(1.8, 0, 0.6);
        p3.draw({expr: 'neutral', armR: [40, 20], blink: blink(t, 2)});
      },
    };
    SETS.revista = {
      g, bg: new THREE.Color('#e8e4d6'), cam: boardCam,
      upd(t) {
        show({});
        setBoard({mode: 'revista', title: t > W(2, 'dia') - 0.1 ? 1 : 0});
        prof.place(-0.25, 0, 2.1);
        prof.draw({expr: t > W(2, 'assustador') ? 'shock' : 'neutral', armR: [100, 70], lookX: 0.8, blink: blink(t)});
      },
    };
    SETS.conta = {
      g, bg: new THREE.Color('#e8e4d6'), cam: boardCam,
      upd(t) {
        show({});
        setBoard({mode: 'conta', line2: t > W(3, 'mais', 1) - 0.1 ? 1 : 0});
        prof.place(-0.25, 0, 2.1);
        prof.draw({expr: 'think', armR: [120 + 10 * Math.sin(t * 10), 120], propR: 'marker', lookX: 0.8, blink: blink(t)});
      },
    };
    SETS.multiplica = {
      g, bg: new THREE.Color('#e8e4d6'), cam: [[0, 3.2, 7.2, 0, 0.6, 1.0], [0, 3.6, 6.4, 0, 0.6, 1.2]],
      upd(t) {
        show({});
        setBoard({mode: 'blank'});
        const beats = [W(4, 'gente', 0), W(4, 'gente', 1), W(4, 'gente', 2), W(4, 'ainda'), W(4, 'mais', 2)];
        let n = 2;
        beats.forEach((b) => t > b - 0.05 && (n *= 2));
        if (t > beats[4] + 0.4) n = 128;
        setCrowd(n, t);
      },
    };
    SETS.curva = {
      g, bg: new THREE.Color('#e8e4d6'), cam: [[0.4, 2.7, 6.0, 0.4, 2.7, 0], [0.4, 2.75, 5.2, 0.4, 2.75, 0]],
      upd(t, sh) {
        show({});
        setBoard({mode: 'curva', k: Math.round(easeInOutCubic(clamp01((t - sh.start - 0.2) / (W(4, 'infinito') - sh.start))) * 60) / 60, date: 0});
      },
    };
    SETS.data = {
      g, bg: new THREE.Color('#e8e4d6'), cam: boardCam,
      upd(t) {
        show({});
        setBoard({mode: 'data', k: 1, date: t > W(5, 'sexta') - 0.1 ? 1 : 0});
        prof.place(-0.25, 0, 2.1);
        prof.draw({expr: 'think', armR: [110, 70], lookX: 0.8, blink: blink(t)});
      },
    };
    SETS.perai = {
      g, bg: new THREE.Color('#e8e4d6'), cam: [[1.05, 1.5, 5.6, 1.3, 1.42, 2.3], [1.15, 1.48, 5.25, 1.36, 1.42, 2.3]],
      upd(t, sh) {
        show({});
        const vin = pop(t, sh.start + 0.05, 0.22);
        viewer.place(1.45, 0, 2.3, vin > 0.01, Math.max(0.01, vin));
        viewer.draw({expr: 'shock', armL: [150, 208], armR: [150, 208], lookX: -0.7, lean: -3});
      },
    };
    SETS.bolo = {
      g, bg: new THREE.Color('#e8e4d6'), cam: [[1.4, 2.0, 5.4, 1.4, 1.5, 0.4], [1.5, 2.0, 4.8, 1.5, 1.5, 0.4]],
      upd(t) {
        show({cake: 1});
        flames.forEach((f, i) => f.scale.set(1, 1 + 0.25 * Math.sin(t * 18 + i), 1));
        prof.place(0.6, 0, 0.5);
        prof.draw({expr: 'grin', armR: [150, 172], armL: [60, 120], lookX: 0.5, blink: blink(t)});
      },
    };
    SETS.provoca = {
      g, bg: new THREE.Color('#e8e4d6'), cam: [[0.3, 2.1, 3.9, 0.5, 1.85, 0.5], [0.35, 2.1, 3.6, 0.55, 1.85, 0.5]],
      upd(t) {
        show({cake: 1});
        prof.place(0.6, 0, 0.5);
        prof.draw({expr: 'smug', armR: [95, 60], lookX: 0.1, blink: blink(t, 0.5)});
      },
    };
    SETS.mas = {
      g, bg: new THREE.Color('#e8e4d6'), cam: boardCam,
      upd(t) {
        show({});
        setBoard({mode: 'mas', k: 0.42});
        prof.place(-0.25, 0, 2.1);
        prof.draw({expr: 'worried', armR: [20, 150], lookX: 0.8, sweat: true});
      },
    };
    SETS.desacelera = {
      g, bg: new THREE.Color('#e8e4d6'), cam: [[0.4, 2.7, 6.0, 0.4, 2.7, 0], [0.4, 2.75, 5.3, 0.4, 2.75, 0]],
      upd(t, sh) {
        show({});
        setBoard({mode: 'desacelera', k: Math.round(lerp(0.42, 1, easeInOutCubic(clamp01((t - sh.start - 0.2) / (W(9, 'devagar') - sh.start)))) * 60) / 60});
      },
    };
    SETS.fim = {
      g, bg: new THREE.Color('#e8e4d6'), cam: boardCam,
      upd(t) {
        show({});
        setBoard({mode: 'fim', k: 1, x: Math.round(clamp01((t - W(11, 'formula') + 0.05) / 0.4) * 20) / 20});
        prof.place(-0.25, 0, 2.1);
        prof.draw({expr: t > W(11, 'quem') ? 'grin' : 'smug', armR: t > W(11, 'formula') - 0.2 ? [130, 140] : [95, 60], propR: t > W(11, 'formula') - 0.2 ? 'marker' : null, lookX: 0.8, blink: blink(t)});
      },
    };
  }

  // ================================================================= planeta
  {
    const g = new THREE.Group();
    const earth = new THREE.Group();
    earth.add(ball(2.2, '#3f8ff0', 3, 0.05));
    for (let i = 0; i < 9; i++) {
      const b = ball(0.8 + hash(i, 3) * 0.5, '#3aa76d', 1, 0.03);
      const th = hash(i, 1) * Math.PI * 2, ph = (hash(i, 2) - 0.5) * 2.2;
      b.position.set(Math.cos(th) * Math.cos(ph) * 1.75, Math.sin(ph) * 1.75, Math.sin(th) * Math.cos(ph) * 1.75);
      b.scale.set(1, 0.6, 1);
      b.lookAt(0, 0, 0);
      earth.add(b);
    }
    g.add(at(earth, 0, -0.6, 0));
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({length: 300}, (_, i) => [(hash(i, 1) - 0.5) * 60, (hash(i, 2) - 0.5) * 60, -20 - hash(i, 3) * 10]).flat(), 3)),
      new THREE.PointsMaterial({color: '#ffffff', size: 0.12}),
    );
    g.add(stars);
    SETS.planeta = {
      g, bg: new THREE.Color('#0b1230'), cam: [[0, 1.4, 10.5, 0, 1.8, 0], [0, 1.4, 9.8, 0, 1.8, 0]],
      upd(t) {
        earth.rotation.y = t * 0.4;
        earth.rotation.x = 0.3;
      },
    };
  }
  SETS.cta = SETS.planeta;
  for (const g of new Set(Object.values(SETS).map((x) => x.g))) scene.add(g);

  // ------------------------------------------------------------------ overlay
  const app = document.getElementById('app');
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = `<div class="brand">NINGUÉM <b>TE CONTOU</b></div><div class="tag"></div>
    <div class="stamp"><span></span></div><div class="counter"></div>
    <div class="cta"><img src="../../artes/avatar-ninguem-lupa.png"><b>segue pra mais histórias<br>que ninguém te contou</b><i>@curiosidadesntc</i></div>
    <div class="capw"></div>`;
  app.appendChild(ov);
  if (cfg.clean) ov.style.display = 'none';
  const $ = (s) => ov.querySelector(s);
  const capw = $('.capw'), tag = $('.tag'), stamp = $('.stamp'), stampTxt = $('.stamp span'), counter = $('.counter'), cta = $('.cta');
  const TAGS = [
    [W(2, 'mil') - 0.05, W(2, 'publicaram'), '1960<small>Universidade de Illinois</small>'],
    [W(7, 'heinz') - 0.05, L(7).b + 0.2, 'Heinz von Foerster<small>físico, autor principal</small>'],
  ];
  const STAMPS = [
    [W(0, 'ontem'), L(0).b + 0.2, 'FIM DO MUNDO?', '', 1080],
    [W(1, 'nao') - 0.05, W(1, 'foram') - 0.1, 'NÃO FOI VIDENTE', ''],
    [W(7, 'aniversario') - 0.05, W(7, 'ele') - 0.1, 'ANIVERSÁRIO DELE', 'green'],
    [W(9, 'menores') - 0.05, L(9).b + 0.3, 'FAMÍLIAS MENORES', 'green'],
    [W(11, 'acabou'), W(11, 'quem') - 0.05, 'O MUNDO NÃO ACABOU', 'green'],
    [W(11, 'formula') - 0.05, L(11).b + 0.4, 'A FÓRMULA ACABOU', ''],
  ];

  const render = (t) => {
    const sh = SHOTS.find((s) => t >= s.start && t < s.end) || SHOTS[SHOTS.length - 1];
    const set = SETS[sh.id];
    const c = set.cam[0].map((v, i) => lerp(v, set.cam[1][i], easeOutCubic(clamp01((t - sh.start) / (sh.end - sh.start)))));
    camera.position.set(c[0], c[1], c[2]);
    camera.lookAt(c[3], c[4], c[5]);
    for (const s of Object.values(SETS)) s.g.visible = s.g === set.g;
    scene.background = set.bg;
    set.upd(t, sh);
    for (const ch of chars) ch.mesh.rotation.y = Math.atan2(camera.position.x - ch.mesh.position.x, camera.position.z - ch.mesh.position.z);
    renderer.render(scene, camera);

    const tg = TAGS.find(([a, b]) => t >= a && t < b);
    tag.style.opacity = tg ? inOut(t, tg[0], tg[1]) : 0;
    if (tg && tag.innerHTML !== tg[2]) tag.innerHTML = tg[2];
    const st = STAMPS.find(([a, b]) => t >= a && t < b);
    if (st) {
      if (stampTxt.textContent !== st[2]) stampTxt.textContent = st[2];
      stamp.className = 'stamp ' + st[3];
      stamp.style.top = `${st[4] || 520}px`;
      const k = clamp01((t - st[0]) / 0.16);
      stamp.style.opacity = k * (1 - smooth((t - st[1] + 0.15) / 0.15));
      stamp.style.transform = `scale(${lerp(1.8, 1, easeOutCubic(k))}) rotate(-5deg)`;
    } else stamp.style.opacity = 0;
    if (sh.id === 'planeta') {
      const k = easeOutCubic(clamp01((t - W(10, 'oito') + 0.1) / 1.2));
      counter.innerHTML = `${Math.round(8.3e9 * k).toLocaleString('pt-BR')}<small>${t > W(10, 'infinito') - 0.1 ? 'e o infinito? nem perto' : 'pessoas'}</small>`;
      counter.style.opacity = smooth((t - W(10, 'oito') + 0.2) / 0.2);
    } else counter.style.opacity = 0;
    cta.style.opacity = sh.id === 'cta' ? smooth((t - sh.start) / 0.25) : 0;
    cta.style.transform = `scale(${0.92 + 0.08 * easeOutBack(clamp01((t - sh.start) / 0.4))})`;

    const w = sh.id !== 'cta' ? CAPS.find((x) => t >= x.a && t < x.b) : null;
    if (w) {
      if (capw.textContent !== w.text) capw.textContent = w.text;
      capw.className = 'capw' + (w.hot ? ' hot' : '');
      capw.style.transform = `scale(${0.7 + 0.3 * easeOutBack(clamp01((t - w.a) / 0.12))}) rotate(${w.hot ? -3 : 0}deg)`;
      capw.style.opacity = 1;
    } else capw.style.opacity = 0;
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
