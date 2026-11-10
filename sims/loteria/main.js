import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutBack, easeOutCubic, lerp, prog, smooth} from '../kit/util.js';
import {createChar, INK} from './char.js';
import {at, ball, blobShadow, box, cloud, cyl, sign, sky, solid, toon, tree, trophy} from './world.js';
import TL from './timeline.json';

// "Ninguém Te Contou": true-story shorts. 2D cutout characters (char.js) stand
// in a toon-shaded 3D world (world.js); captions show one or two words at a time.
// Everything is a pure function of t. Shots come from timeline.json.

const DEFAULTS = {
  duration: TL.duration,
  fps: 30,
  hud: {enabled: false, title: 'loteria', subtitle: ''},
  director: {enabled: false},
  watermark: '',
};

const frac = (x) => x - Math.floor(x);
const hash = (i, k = 0) => frac(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// caption words: spread each line's words over its window, short words ride with the next one
const norm = (w) => w.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
const WORDS = [];
for (const [a, b, text] of TL.lines) {
  const raw = text.split(/\s+/);
  const groups = [];
  for (let i = 0; i < raw.length; i++) {
    let g = raw[i];
    if (norm(raw[i]).length <= 3 && i + 1 < raw.length && !/[.?!…]$/.test(raw[i])) g += ' ' + raw[++i];
    groups.push(g);
  }
  const weight = (g) => g.length + 3 + (/[.?!…]$/.test(g) ? 5 : 0);
  const total = groups.reduce((s, g) => s + weight(g), 0);
  let t = a;
  for (const g of groups) {
    const d = ((b - a) * weight(g)) / total;
    WORDS.push({a: t, b: t + d, text: g.replace(/[.,…]+$/, ''), hot: g.split(' ').some((w) => TL.accent.includes(norm(w)))});
    t += d;
  }
}

runSim(DEFAULTS, async ({canvas, cfg}) => {
  await document.fonts.load('900 40px "Inter"').catch(() => {});
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.1, 200);
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9c4e0', 1.25));
  const sun = new THREE.DirectionalLight('#ffffff', 2.0);
  sun.position.set(4, 8, 6);
  scene.add(sun);

  const chars = [];
  const mkChar = (look, parent, x, y, z, h = 2) => {
    const ch = createChar(THREE, look);
    ch.mesh.scale.setScalar(h / 2);
    ch.mesh.position.set(x, y, z);
    parent.add(ch.mesh);
    parent.add(at(blobShadow(0.5 * (h / 2)), x, y + 0.012, z));
    chars.push(ch);
    return ch;
  };
  const blink = (t, ph = 0) => frac((t + ph) / 3.1) < 0.045;

  // ---------------------------------------------------------------- set: palco
  const palco = new THREE.Group();
  scene.add(palco);
  const skyDay = sky('#3aa0ff', '#bfe6ff');
  {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), toon('#74c957'));
    ground.rotation.x = -Math.PI / 2;
    palco.add(ground);
    [[-9, -14, 7], [6, -18, 9], [16, -13, 6]].forEach(([x, z, r]) => {
      const h = ball(r, '#5cb548', 2, 0.02);
      h.scale.y = 0.35;
      palco.add(at(h, x, 0, z));
    });
    [[-3.4, -4.5, 2.8], [-2.3, -6, 2.3], [3.3, -5, 3.0], [4.4, -7.5, 2.4], [-5.2, -8, 2.6]].forEach(([x, z, h]) => palco.add(at(tree(h), x, 0, z)));
    [[-2.2, 6.6, -12, 1.5], [2.6, 7.4, -14, 1.9], [0.2, 8.6, -16, 1.3]].forEach(([x, y, z, s]) => palco.add(at(cloud(s), x, y, z)));
    // stage
    palco.add(at(box(4.6, 0.5, 3.2, '#d9a066'), 0, 0.25, 0));
    palco.add(at(box(4.7, 0.14, 0.12, '#a86f3a', 0.02), 0, 0.5, 1.6));
    // backdrop + sign
    palco.add(at(box(4.2, 3.4, 0.25, '#c8324a'), 0, 2.2, -1.35));
    for (let i = 0; i < 7; i++) palco.add(at(box(0.3, 3.4, 0.06, '#a82238', 0), -1.8 + i * 0.6, 2.2, -1.2));
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
    palco.add(at(box(3.7, 1.35, 0.2, '#16204f'), 0, 4.15, -1.2));
    palco.add(at(lot.mesh, 0, 4.15, -1.09));
    palco.bulbs = [];
    for (let i = 0; i < 12; i++)
      for (const y of [3.5, 4.8]) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), new THREE.MeshBasicMaterial({color: '#fff2a8'}));
        palco.add(at(b, -1.76 + i * 0.32, y, -1.06));
        palco.bulbs.push(b);
      }
    // 14 trophies on a tiered stand: 5 + 4 + 3 + 2
    palco.trophies = [];
    [5, 4, 3, 2].forEach((n, r) => {
      palco.add(at(box(1.8, 0.34, 0.5, r % 2 ? '#7b4bd6' : '#6a3cc4', 0.03), 1.0, 0.5 + 0.17 + r * 0.34, 0.1 - r * 0.36));
      for (let i = 0; i < n; i++) {
        const tr = trophy();
        tr.userData = {x: 1.0 + (i - (n - 1) / 2) * 0.34, y: 0.5 + 0.34 * (r + 1), z: 0.1 - r * 0.36, k: palco.trophies.length};
        palco.add(tr);
        palco.trophies.push(tr);
      }
    });
    palco.hero = mkChar('mandel', palco, -0.95, 0.5, 0.75);
    // confetti
    const N = 140;
    const cf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.09, 0.14), new THREE.MeshBasicMaterial({side: THREE.DoubleSide}), N);
    const cols = ['#ff4d6d', '#ffd23f', '#4dd4ff', '#7bed9f', '#ffffff', '#b28dff'];
    for (let i = 0; i < N; i++) cf.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    cf.frustumCulled = false;
    palco.add(cf);
    palco.confetti = cf;
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = V(0, 0, 0), S = V(1, 1, 1);
  const updPalco = (tl) => {
    palco.bulbs.forEach((b, i) => b.material.color.set((i + Math.floor(tl * 3)) % 2 ? '#fff2a8' : '#ff9f1c'));
    // trophies pop in one by one while the hook is spoken
    palco.trophies.forEach((tr) => {
      const {x, y, z, k} = tr.userData;
      const p = prog(tl, 0.5 + k * 0.11, 0.85 + k * 0.11, easeOutBack);
      tr.visible = p > 0.01;
      tr.position.set(x, y, z);
      tr.scale.setScalar(Math.max(0.01, p));
    });
    const jump = Math.abs(Math.sin(tl * 5.2)) * 0.07 * smooth((tl - 0.2) / 0.5);
    palco.hero.mesh.position.y = 0.5 + jump;
    palco.hero.draw({expr: tl > 3.6 ? 'smug' : 'grin', armL: [60 + 8 * Math.sin(tl * 5.2), 125], armR: [130, 160], propR: 'ticket', blink: false, squash: 0.02 * Math.sin(tl * 5.2), lookX: 0.2});
    for (let i = 0; i < 140; i++) {
      const y = 6.2 - frac(tl * (0.16 + hash(i, 1) * 0.1) + hash(i, 2)) * 6.4;
      P.set(-2.4 + hash(i, 3) * 4.8 + Math.sin(tl * 2 + i) * 0.12, y, -0.8 + hash(i, 4) * 2.6);
      E.set(tl * 3 + i, tl * 2.3 + i * 2, i);
      M.compose(P, Q.setFromEuler(E), S);
      palco.confetti.setMatrixAt(i, M);
    }
    palco.confetti.instanceMatrix.needsUpdate = true;
  };

  // ----------------------------------------------------------------- set: rifa
  const rifa = new THREE.Group();
  scene.add(rifa);
  const wallBg = new THREE.Color('#2d6f7a');
  {
    rifa.add(at(box(10, 0.2, 8, '#e0b074', 0), 0, -0.1, 0.5));
    rifa.add(at(box(10, 7, 0.2, '#3f9aa3', 0), 0, 3.5, -1.7));
    rifa.add(at(box(10, 0.3, 0.1, '#f4ead5', 0.015), 0, 0.15, -1.56));
    for (let i = 0; i < 9; i++) rifa.add(at(box(0.05, 7, 0.02, '#368891', 0), -4 + i, 3.5, -1.59));
    rifa.add(at(box(2.75, 3.3, 0.14, '#8a5a2b'), 0.42, 2.45, -1.52));
    const board = sign(2.5, 3.05, 1000, 1220, (c, w, h, count = 0) => {
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
      const g = 92, x0 = (w - g * 10) / 2, y0 = 240;
      c.font = '800 38px Inter';
      c.textAlign = 'center';
      for (let i = 0; i < 100; i++) {
        const x = x0 + (i % 10) * g, y = y0 + Math.floor(i / 10) * g;
        const on = i < count;
        c.fillStyle = on ? '#35c46a' : '#ffffff';
        c.fillRect(x + 5, y + 5, g - 10, g - 10);
        c.lineWidth = 5;
        c.strokeStyle = INK;
        c.strokeRect(x + 5, y + 5, g - 10, g - 10);
        c.fillStyle = on ? '#ffffff' : INK;
        c.fillText(String(i + 1), x + g / 2, y + g / 2 + 3);
      }
    });
    rifa.add(at(board.mesh, 0.42, 2.45, -1.44));
    rifa.board = board;
    rifa.count = -1;
    // lamp
    rifa.add(at(cyl(0.02, 0.02, 1.4, INK, 5, 0), -1.5, 5.4, -0.4));
    rifa.add(at(solid(new THREE.ConeGeometry(0.42, 0.34, 10, 1, true), '#ffd23f', 0.03, {side: THREE.DoubleSide}), -1.5, 4.6, -0.4));
    // coin stack on a small table
    rifa.add(at(box(0.9, 0.08, 0.6, '#8a5a2b', 0.025), -1.75, 0.82, -0.7));
    for (const sx of [-0.36, 0.36]) rifa.add(at(box(0.07, 0.8, 0.07, '#6e4520', 0.02), -1.75 + sx, 0.4, -0.7));
    rifa.coins = [];
    for (let i = 0; i < 10; i++) {
      const co = cyl(0.13, 0.13, 0.045, '#ffc93c', 12, 0.015);
      rifa.add(co);
      rifa.coins.push(co);
    }
    rifa.hero = mkChar('mandel', rifa, -1.05, 0, 0.5);
    rifa.viewer = mkChar('viewer', rifa, 1.45, 0, 2.3);
  }
  const updRifa = (tl, id) => {
    const count = Math.round(100 * prog(tl, 3.9, 7.3, (x) => clamp01(x)));
    if (count !== rifa.count) {
      rifa.board.repaint(count);
      rifa.count = count;
    }
    const marking = tl > 3.9 && tl < 7.3;
    const wave = marking ? Math.sin(tl * 14) * 14 : 0;
    rifa.hero.draw({
      expr: id === 'perai' ? 'smug' : tl < 3.2 ? 'think' : marking ? 'grin' : 'smug',
      armR: marking ? [118 + wave * 0.4, 138 + wave] : tl < 3.2 ? [20, 150] : [95, 60],
      armL: [14, 8],
      propR: marking ? 'marker' : null,
      lookX: id === 'perai' ? 0.9 : marking ? 0.8 : 0.2,
      blink: blink(tl, 1),
      squash: 0.012 * Math.sin(tl * 3),
    });
    rifa.coins.forEach((co, i) => {
      // the stack shrinks as he "spends" on tickets
      const p = clamp01((tl - 3.9) / 3.4);
      co.visible = i < 10 - Math.floor(p * 7);
      co.position.set(-1.75, 0.885 + i * 0.047, -0.7);
    });
    const vin = id === 'perai' ? prog(tl, 8.0, 8.22, easeOutBack) : 0;
    rifa.viewer.mesh.visible = vin > 0.01;
    rifa.viewer.mesh.scale.setScalar(Math.max(0.01, vin));
    rifa.viewer.draw({expr: 'shock', armL: [150, 208], armR: [150, 208], lookX: -0.7, squash: 0.03 * Math.sin((tl - 8) * 22) * Math.exp(-(tl - 8) * 5), lean: -3});
  };

  // --------------------------------------------------------------------- shots
  // camera per shot: [px,py,pz, tx,ty,tz] at start and end
  const SHOTS = {
    palco: {set: palco, bg: skyDay, cam: [[0.5, 2.35, 8.6, 0.05, 2.25, 0], [0.12, 2.05, 6.7, 0.05, 2.1, 0]], upd: updPalco, t0: 0},
    rifa: {set: rifa, bg: wallBg, cam: [[0, 2.3, 7.8, 0.1, 2.15, 0], [0.3, 2.35, 6.5, 0.25, 2.25, 0]], upd: updRifa, t0: 0},
    perai: {set: rifa, bg: wallBg, cam: [[1.05, 1.5, 5.6, 1.3, 1.42, 2.3], [1.15, 1.48, 5.25, 1.36, 1.42, 2.3]], upd: updRifa, t0: 8.0},
  };
  const SETS = [palco, rifa];

  // ------------------------------------------------------------------- overlay
  const app = document.getElementById('app');
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = '<div class="brand">NINGUÉM <b>TE CONTOU</b></div><div class="capw"></div>';
  app.appendChild(ov);
  const capw = ov.querySelector('.capw');
  if (cfg.clean) ov.style.display = 'none';

  const render = (t) => {
    const sh = TL.shots.find((s) => t >= s.start && t < s.end) || TL.shots[TL.shots.length - 1];
    const S0 = SHOTS[sh.id];
    const k = easeOutCubic(clamp01((t - sh.start) / (sh.end - sh.start)));
    const c = S0.cam[0].map((v, i) => lerp(v, S0.cam[1][i], k));
    camera.position.set(c[0], c[1], c[2]);
    camera.lookAt(c[3], c[4], c[5]);
    for (const g of SETS) g.visible = g === S0.set;
    scene.background = S0.bg;
    S0.upd(S0.t0 + (t - sh.start), sh.id);
    for (const ch of chars) ch.mesh.rotation.y = Math.atan2(camera.position.x - ch.mesh.position.x, camera.position.z - ch.mesh.position.z);
    renderer.render(scene, camera);

    const w = WORDS.find((x) => t >= x.a && t < x.b);
    if (w) {
      if (capw.textContent !== w.text) capw.textContent = w.text;
      capw.className = 'capw' + (w.hot ? ' hot' : '');
      const pop = easeOutBack(clamp01((t - w.a) / 0.12));
      capw.style.transform = `scale(${0.7 + 0.3 * pop}) rotate(${w.hot ? -3 : 0}deg)`;
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
