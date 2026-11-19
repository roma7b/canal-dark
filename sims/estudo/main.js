import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth} from '../kit/util.js';
import {createChar} from '../loteria/char.js';
import TL from './timeline.json';
import WORDS_RAW from './narracao-fit-words.json';

// "Visto de estudo pra Portugal: o checklist" for @lucasmontemorr (inspired by his own video).
// Fast-cut flat motion graphics drawn in 2D canvas: a new shot every 2-3 s,
// each element pops in on the word that names it. Everything is a pure
// function of t and reads its timing from the narration word timings.

const DEFAULTS = {duration: TL.duration, fps: 30, hud: {enabled: false, title: 'portugal', subtitle: ''}, director: {enabled: false}, watermark: ''};

const B = {blue: '#2b40d3', red: '#e8193f', lav: '#e2e4f1', navy: '#0e1030', white: '#ffffff', cream: '#fff6ea', green: '#2fbf71', yellow: '#ffc93c', sky: '#bcd4ff'};
const frac = (x) => x - Math.floor(x);
const norm = (w) => w.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
const pop = (t, t0, d = 0.28) => easeOutBack(clamp01((t - t0) / d));
const ramp = (t, t0, d = 0.3) => easeOutCubic(clamp01((t - t0) / d));

// ---------------------------------------------------------------- word timing
const LINES = [];
for (const w of WORDS_RAW) (LINES[w.line] ||= []).push(w);
const L = (n) => ({a: LINES[n][0].a, b: LINES[n][LINES[n].length - 1].b});
const W = (n, prefix) => {
  const p = norm(prefix);
  const w = LINES[n].find((x) => norm(x.w).startsWith(p));
  if (!w) throw new Error(`word "${prefix}" not in line ${n}`);
  return w.a;
};
const CAPS = [];
{
  let cur = [];
  WORDS_RAW.forEach((w, i) => {
    cur.push(w);
    const next = WORDS_RAW[i + 1];
    if (cur.length >= 2 || /[.?!,…:]$/.test(w.w) || !next || next.line !== w.line) {
      CAPS.push({a: cur[0].a - 0.04, b: next ? next.a - 0.04 : w.b + 0.6, words: cur.map((x) => x.w.replace(/[.,…:]+$/, ''))});
      cur = [];
    }
  });
}
const SHOTS = TL.shots.map(([id, line, word], i) => ({id, line, start: i === 0 ? 0 : word ? W(line, word) - 0.08 : L(line).a - 0.1}));
SHOTS.forEach((s, i) => (s.end = i + 1 < SHOTS.length ? SHOTS[i + 1].start : TL.duration));

const loadImg = (src) =>
  new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });

runSim(DEFAULTS, async ({canvas, cfg}) => {
  // cfg.half: 1080x960 layout for posts where the video fills only the top half of the screen
  const HALF = !!cfg.half;
  if (HALF) document.documentElement.classList.add('half');
  await document.fonts.load('900 40px "Inter"').catch(() => {});
  const ctx = canvas.getContext('2d');
  const logo = await loadImg('../portugal/logo-vaibem-branco.png');
  const hero = createChar(null, 'traveler');
  const pal = createChar(null, 'helper');

  // ------------------------------------------------------------------ overlay
  const app = document.getElementById('app');
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = '<div class="tt"><b>visto de estudo pra portugal</b><i>o checklist</i><div class="chip">regras de nov/2026</div></div><div class="cpt"></div>';
  app.appendChild(ov);
  const cap = ov.querySelector('.cpt'), title = ov.querySelector('.tt'), chip = ov.querySelector('.chip');

  // ------------------------------------------------------------- drawing kit
  const S = 1080;
  const rr = (x, y, w, h, r, fill, stroke = B.navy, lw = 10) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  };
  const circ = (x, y, r, fill, stroke = B.navy, lw = 10) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  };
  const txt = (s, x, y, size, col, weight = 900, align = 'center', stroke = null) => {
    // all on-screen copy in caps, except handles and site addresses
    if (!/[@.\/]/.test(s)) s = s.toUpperCase();
    ctx.font = `${weight} ${size}px Inter`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.18;
      ctx.strokeStyle = stroke;
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = col;
    ctx.fillText(s, x, y);
  };
  const fitTxt = (s, x, y, size, maxW, col, weight = 900, stroke = null) => {
    if (!/[@.\/]/.test(s)) s = s.toUpperCase();
    ctx.font = `${weight} ${size}px Inter`;
    const k = Math.min(1, maxW / ctx.measureText(s).width);
    txt(s, x, y, Math.floor(size * k), col, weight, 'center', stroke);
  };
  // scale-pop an element around (cx, cy)
  const P = (t, t0, cx, cy, fn, rot = 0) => {
    const p = pop(t, t0);
    if (p <= 0.001) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(p, p);
    ctx.translate(-cx, -cy);
    fn();
    ctx.restore();
  };
  const stamp = (t, t0, text, col, cx, cy, rot = -0.12, size = 92) => {
    const k = clamp01((t - t0) / 0.18);
    if (k <= 0) return;
    const sc = lerp(2.2, 1, easeOutCubic(k));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(sc, sc);
    ctx.globalAlpha = k;
    ctx.font = `900 ${size}px Inter`;
    const w = ctx.measureText(text).width + 70;
    rr(-w / 2, -size * 0.75, w, size * 1.5, 22, 'rgba(255,255,255,0.9)', col, 14);
    txt(text, 0, 4, size, col);
    ctx.restore();
  };
  const xMark = (t, t0, cx, cy, r = 150) => {
    const k = clamp01((t - t0) / 0.2);
    if (k <= 0) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = B.red;
    ctx.lineWidth = 46;
    const a = Math.min(1, k * 2), b = Math.max(0, k * 2 - 1);
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r);
    ctx.lineTo(cx - r + 2 * r * a, cy - r + 2 * r * a);
    if (b > 0) {
      ctx.moveTo(cx + r, cy - r);
      ctx.lineTo(cx + r - 2 * r * b, cy - r + 2 * r * b);
    }
    ctx.stroke();
    ctx.restore();
  };
  const check = (t, t0, cx, cy, r = 70, col = B.green) => {
    const p = pop(t, t0);
    if (p <= 0) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(p, p);
    circ(0, 0, r, col, B.navy, 10);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = r * 0.22;
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, 0);
    ctx.lineTo(-r * 0.1, r * 0.32);
    ctx.lineTo(r * 0.45, -r * 0.32);
    ctx.stroke();
    ctx.restore();
  };
  const doc = (x, y, w, h, head, headCol = B.blue, lines = 4) => {
    rr(x, y, w, h, 22, B.white);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 22);
    ctx.clip();
    ctx.fillStyle = headCol;
    ctx.fillRect(x, y, w, h * 0.2);
    ctx.restore();
    rr(x, y, w, h, 22, null);
    fitTxt(head, x + w / 2, y + h * 0.1, h * 0.085, w * 0.85, '#fff');
    for (let i = 0; i < lines; i++) rr(x + w * 0.12, y + h * (0.32 + i * 0.13), w * (i % 2 ? 0.55 : 0.76), 14, 7, '#c9cde6', null);
  };
  const calendar = (cx, cy, month, year, col = B.red) => {
    const w = 380, h = 400;
    rr(cx - w / 2, cy - h / 2, w, h, 34, B.white);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 34);
    ctx.clip();
    ctx.fillStyle = col;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, 120);
    ctx.restore();
    rr(cx - w / 2, cy - h / 2, w, h, 34, null);
    txt(month, cx, cy - h / 2 + 62, 72, '#fff');
    txt(year, cx, cy + 50, 130, B.navy);
    for (const sx of [-90, 90]) rr(cx + sx - 14, cy - h / 2 - 34, 28, 70, 14, B.navy, null);
  };
  const flagPT = (x, y, w) => {
    const h = w * 0.66;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.clip();
    ctx.fillStyle = '#046a38';
    ctx.fillRect(x, y, w * 0.4, h);
    ctx.fillStyle = '#da291c';
    ctx.fillRect(x + w * 0.4, y, w * 0.6, h);
    ctx.restore();
    circ(x + w * 0.4, y + h / 2, h * 0.2, B.yellow, B.navy, 6);
    rr(x, y, w, h, 14, null, B.navy, 8);
  };
  const flagBR = (x, y, w) => {
    const h = w * 0.7;
    rr(x, y, w, h, 14, '#009c3b', B.navy, 8);
    ctx.fillStyle = '#ffdf00';
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h * 0.1);
    ctx.lineTo(x + w * 0.92, y + h / 2);
    ctx.lineTo(x + w / 2, y + h * 0.9);
    ctx.lineTo(x + w * 0.08, y + h / 2);
    ctx.fill();
    circ(x + w / 2, y + h / 2, h * 0.22, '#002776', null);
  };
  const building = (cx, base, w, h, name, roof = B.blue) => {
    rr(cx - w / 2, base - h, w, h, 10, B.cream);
    rr(cx - w / 2 - 20, base - h - 50, w + 40, 60, 14, roof);
    rr(cx - w * 0.38, base - h + 50, w * 0.76, 90, 16, B.white);
    fitTxt(name, cx, base - h + 95, 54, w * 0.7, B.navy);
    for (const sx of [-0.28, 0.28]) rr(cx + w * sx - 55, base - h + 190, 110, 110, 10, B.sky);
    rr(cx - 60, base - 170, 120, 170, 10, '#4a5168');
  };
  const ground = (y = 1260) => {
    ctx.fillStyle = '#c8ccdf';
    ctx.fillRect(-400, y, S + 800, 30);
    ctx.fillStyle = '#4a5168';
    ctx.fillRect(-400, y + 30, S + 800, 1400);
    ctx.fillStyle = '#fff';
    for (let x = 30; x < S; x += 170) ctx.fillRect(x, y + 140, 90, 16);
  };
  const cloud = (x, y, s) => {
    ctx.fillStyle = '#fff';
    for (const [dx, dy, r] of [[0, 0, 50], [55, -20, 60], [115, 0, 48], [55, 20, 50]]) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const sky = (top = '#7fb2ff', bot = '#cfe0ff') => {
    const g = ctx.createLinearGradient(0, 0, 0, 1300);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(-400, -400, S + 800, 2720);
  };
  const flat = (col) => {
    ctx.fillStyle = col;
    ctx.fillRect(-400, -400, S + 800, 2720);
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = col === B.blue || col === B.navy || col === B.red ? '#fff' : B.navy;
    for (let y = 0; y < 1920; y += 80) for (let x = (y / 80) % 2 ? 40 : 0; x < S; x += 80) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  const person = (ch, x, base, h, state) => {
    ch.draw(state);
    const w = h * (512 / 768);
    ctx.drawImage(ch.canvas, x - w / 2, base - h * (745 / 768), w, h);
  };
  const suitcase = (x, y, s = 1) => {
    rr(x - 70 * s, y - 120 * s, 140 * s, 120 * s, 20 * s, B.red);
    rr(x - 30 * s, y - 150 * s, 60 * s, 36 * s, 12 * s, null, B.navy, 10 * s);
    rr(x - 70 * s, y - 70 * s, 140 * s, 14 * s, 4 * s, B.navy, null);
  };
  const coin = (x, y, r, sym = '€') => {
    circ(x, y, r, B.yellow);
    txt(sym, x, y + 3, r * 1.1, B.navy);
  };
  const plane = (x, y, s, rot = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = B.navy;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 180, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = B.red;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(20, 140);
    ctx.lineTo(70, 140);
    ctx.lineTo(40, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-150, -10);
    ctx.lineTo(-190, -90);
    ctx.lineTo(-150, -90);
    ctx.lineTo(-110, -20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 5; i++) circ(-60 + i * 40, -8, 9, B.sky, null);
    ctx.restore();
  };
  const tram = (x, y, s = 1) => {
    rr(x, y, 300 * s, 170 * s, 26 * s, B.yellow);
    for (let i = 0; i < 4; i++) rr(x + (22 + i * 68) * s, y + 26 * s, 50 * s, 60 * s, 8 * s, B.sky, B.navy, 6 * s);
    rr(x, y + 120 * s, 300 * s, 20 * s, 0, B.white, null);
    for (const wx of [70, 230]) circ(x + wx * s, y + 175 * s, 22 * s, B.navy, null);
    ctx.strokeStyle = B.navy;
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    ctx.moveTo(x + 150 * s, y);
    ctx.lineTo(x + 190 * s, y - 70 * s);
    ctx.stroke();
  };
  const laptop = (cx, cy, s = 1) => {
    rr(cx - 260 * s, cy - 300 * s, 520 * s, 340 * s, 24 * s, B.navy);
    rr(cx - 230 * s, cy - 272 * s, 460 * s, 284 * s, 12 * s, B.sky, null);
    rr(cx - 320 * s, cy + 40 * s, 640 * s, 40 * s, 18 * s, '#9aa1c4');
  };
  const globe = (cx, cy, r, t) => {
    circ(cx, cy, r, '#5aa0ff');
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = B.green;
    const o = (t * 40) % (r * 2);
    for (const [dx, dy, rx, ry] of [[-0.4, -0.3, 0.35, 0.25], [0.3, 0.2, 0.3, 0.35], [-0.2, 0.5, 0.25, 0.15]]) {
      ctx.beginPath();
      ctx.ellipse(cx + dx * r + o - r, cy + dy * r, rx * r, ry * r, 0.3, 0, Math.PI * 2);
      ctx.ellipse(cx + dx * r + o + r, cy + dy * r, rx * r, ry * r, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    circ(cx, cy, r, null);
  };
  const capHat = (cx, cy, s = 1) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    rr(-110, 10, 220, 90, 20, B.navy);
    ctx.fillStyle = B.navy;
    ctx.strokeStyle = B.navy;
    ctx.beginPath();
    ctx.moveTo(-240, 0);
    ctx.lineTo(0, -100);
    ctx.lineTo(240, 0);
    ctx.lineTo(0, 100);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = B.yellow;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(180, 40);
    ctx.lineTo(180, 150);
    ctx.stroke();
    circ(180, 160, 18, B.yellow, null);
    ctx.restore();
  };
  const house = (cx, base, s = 1) => {
    ctx.save();
    ctx.translate(cx, base);
    ctx.scale(s, s);
    rr(-160, -220, 320, 220, 10, B.cream);
    ctx.fillStyle = B.red;
    ctx.strokeStyle = B.navy;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-200, -210);
    ctx.lineTo(0, -380);
    ctx.lineTo(200, -210);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    rr(-40, -130, 80, 130, 8, B.blue);
    rr(-130, -170, 70, 70, 8, B.sky);
    rr(60, -170, 70, 70, 8, B.sky);
    ctx.restore();
  };
  const magnifier = (cx, cy, r, rot = 0.6) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    rr(-22, r - 10, 44, r * 1.2, 22, B.navy, null);
    ctx.restore();
    circ(cx, cy, r, 'rgba(188,212,255,0.6)', B.navy, 22);
  };
  const phone = (cx, cy, s = 1) => {
    rr(cx - 190 * s, cy - 360 * s, 380 * s, 720 * s, 50 * s, B.navy);
    rr(cx - 165 * s, cy - 320 * s, 330 * s, 620 * s, 26 * s, B.white, null);
  };
  const bars = (x0, base, t, t0, vals, col) => {
    vals.forEach((v, i) => {
      const k = easeOutCubic(clamp01((t - t0 - i * 0.12) / 0.4));
      const h = v * k;
      rr(x0 + i * 150, base - h, 110, h, 14, i === vals.length - 1 ? col : '#9aa1c4');
    });
    ctx.fillStyle = B.navy;
    ctx.fillRect(x0 - 30, base, vals.length * 150 + 30, 10);
  };
  const arrow = (x0, y0, x1, y1, k, col = B.red) => {
    const x = lerp(x0, x1, k), y = lerp(y0, y1, k);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = col;
    ctx.lineWidth = 26;
    ctx.setLineDash([46, 30]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.lineTo(-30, -40);
    ctx.lineTo(-30, 40);
    ctx.fill();
    ctx.restore();
  };
  const bigWord = (t, t0, s, y, col, size = 170, stroke = B.navy, rot = -0.04) => P(t, t0, S / 2, y, () => fitTxt(s, S / 2, y, size, 940, col, 900, stroke), rot);

  // big numbered card that opens each of the four steps
  const stepCard = (t, s, n, label, col, word = 'FASE', total = 3) => {
    flat(col);
    P(t, s.start, 540, 860, () => {
      circ(540, 860, 230, '#fff', B.navy, 14);
      txt(String(n), 540, 878, 300, col);
    });
    P(t, s.start + 0.12, 540, 560, () => {
      rr(360, 505, 360, 110, 55, B.navy, null);
      txt(word, 540, 562, 64, '#fff');
    });
    bigWord(t, s.start + 0.3, label, 1240, '#fff', 150);
    for (let i = 0; i < total; i++) circ(540 - (total - 1) * 50 + i * 100, 1400, 26, i < n ? '#fff' : 'rgba(255,255,255,0.25)', i < n ? B.navy : null, 8);
  };
  const passport = (cx, cy, s = 1) => {
    rr(cx - 210 * s, cy - 290 * s, 420 * s, 580 * s, 30 * s, '#1f2a6b', B.navy, 10 * s);
    txt('PASSAPORTE', cx, cy - 210 * s, 46 * s, B.yellow);
    circ(cx, cy - 40 * s, 80 * s, null, B.yellow, 10 * s);
    txt('BRASIL', cx, cy + 180 * s, 44 * s, '#fff', 800);
  };
  const ticket = (cx, cy, s = 1, rot = 0) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(s, s);
    rr(-300, -130, 600, 260, 30, '#fff');
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-300, -130, 600, 260, 30);
    ctx.clip();
    ctx.fillStyle = B.blue;
    ctx.fillRect(-300, -130, 600, 70);
    ctx.restore();
    rr(-300, -130, 600, 260, 30, null);
    txt('PASSAGEM', 0, -94, 44, '#fff');
    txt('GRU', -170, 20, 70, B.navy);
    txt('LIS', 170, 20, 70, B.navy);
    plane(0, 20, 0.28);
    rr(-230, 80, 460, 18, 9, '#c9cde6', null);
    ctx.restore();
  };

  const heart = (cx, cy, r, col = B.red) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(r / 50, r / 50);
    ctx.fillStyle = col;
    ctx.strokeStyle = B.navy;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, 35);
    ctx.bezierCurveTo(-60, -5, -40, -55, 0, -25);
    ctx.bezierCurveTo(40, -55, 60, -5, 0, 35);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  const rainCloud = (x, y, s, t) => {
    ctx.fillStyle = '#8a90ad';
    for (const [dx, dy, r] of [[0, 0, 50], [55, -20, 60], [115, 0, 48], [55, 20, 50]]) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#5aa0ff';
    ctx.lineWidth = 8 * s;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const u = frac(t * 1.6 + i * 0.37);
      const rx = x + (i * 30 - 5) * s, ry = y + (60 + u * 160) * s;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 8 * s, ry + 30 * s);
      ctx.stroke();
    }
  };
  const nata = (cx, cy, s = 1) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.fillStyle = '#d99a4e';
    ctx.strokeStyle = B.navy;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-90, -20);
    ctx.lineTo(90, -20);
    ctx.lineTo(70, 50);
    ctx.lineTo(-70, 50);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd54a';
    ctx.beginPath();
    ctx.ellipse(0, -20, 80, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (const [dx, dy] of [[-30, -24], [20, -16], [40, -28]]) circ(dx, dy, 9, '#8a4b1c', null);
    ctx.restore();
  };
  const confetti = (t, t0) => {
    const k = t - t0;
    if (k < 0) return;
    const cols = [B.red, B.yellow, B.green, B.blue, '#ff9a8a'];
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % 1080, sp = 260 + (i * 37) % 200;
      const y = 380 + k * sp - ((i * 53) % 300);
      if (y < 380 || y > 1500) continue;
      ctx.save();
      ctx.translate(x + Math.sin(k * 3 + i) * 30, y);
      ctx.rotate(k * 4 + i);
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(-12, -7, 24, 14);
      ctx.restore();
    }
  };
  const flash = (t, t0) => {
    const k = clamp01((t - t0) / 0.25);
    if (k <= 0 || k >= 1) return;
    ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
    ctx.fillRect(-400, -400, S + 800, 2720);
  };
  const sun = (cx, cy, r, t) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.6);
    ctx.strokeStyle = B.yellow;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r + 20), Math.sin(a) * (r + 20));
      ctx.lineTo(Math.cos(a) * (r + 60), Math.sin(a) * (r + 60));
      ctx.stroke();
    }
    ctx.restore();
    circ(cx, cy, r, B.yellow);
  };
  const label = (t, t0, s, cx, cy, w, col, txtCol = '#fff', size = 66) => P(t, t0, cx, cy, () => {
    rr(cx - w / 2, cy - 70, w, 140, 70, col);
    fitTxt(s, cx, cy + 2, size, w - 80, txtCol);
  });

  const visaCard = (t, t0, code, name, col, cy = 600) => P(t, t0, 540, cy, () => {
    rr(170, cy - 110, 740, 220, 50, '#fff');
    circ(275, cy, 76, col);
    txt(code, 275, cy + 4, 66, '#fff');
    const lines = name.split('|');
    lines.forEach((ln, i) => fitTxt(ln, 645, cy + 4 + (i - (lines.length - 1) / 2) * 66, 60, 430, B.navy));
  });
  const trophy = (cx, cy, s = 1) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.fillStyle = B.yellow;
    ctx.strokeStyle = B.navy;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-120, -160);
    ctx.lineTo(120, -160);
    ctx.quadraticCurveTo(120, 40, 0, 60);
    ctx.quadraticCurveTo(-120, 40, -120, -160);
    ctx.fill();
    ctx.stroke();
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * 125, -90, 55, sx > 0 ? -Math.PI / 2 : Math.PI / 2, sx > 0 ? Math.PI / 2 : Math.PI * 1.5);
      ctx.stroke();
    }
    rr(-25, 55, 50, 70, 6, B.yellow);
    rr(-90, 120, 180, 50, 12, B.navy, null);
    txt('1', 0, -70, 120, B.navy);
    ctx.restore();
  };
  const podium = (t, t0, firstHidden) => {
    const blocks = [[540, 1300, 360, '1', B.yellow], [250, 1300, 240, '2', '#c9cde6'], [830, 1300, 180, '3', '#ffd1a1']];
    blocks.forEach(([cx, base, h, n, col], i) => {
      const k = easeOutCubic(clamp01((t - t0 - i * 0.12) / 0.45));
      rr(cx - 140, base - h * k, 280, h * k, 16, col);
      if (k > 0.6) txt(n === '1' && firstHidden ? '?' : n + 'º', cx, base - h * k + 70, 80, B.navy);
    });
  };

  const clipboard = (cx, cy, s, t, t0, n = 5, gap = 0.18) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    rr(-260, -340, 520, 680, 30, '#fff');
    rr(-110, -380, 220, 80, 20, '#9aa1c4');
    ctx.restore();
    for (let i = 0; i < n; i++) {
      const tt = t0 + i * gap;
      const y = cy + (-220 + i * 110) * s;
      P(t, tt, cx, y, () => rr(cx - 120 * s, y - 15 * s, (i % 2 ? 200 : 260) * s, 30 * s, 10 * s, '#c9cde6', null));
      check(t, tt + 0.08, cx - 180 * s, y, 36 * s);
    }
  };
  const browser = (x, y, w, h) => {
    rr(x, y, w, h, 26, '#fff');
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 26);
    ctx.clip();
    ctx.fillStyle = '#eef0fa';
    ctx.fillRect(x, y, w, 70);
    ctx.restore();
    rr(x, y, w, h, 26, null);
    for (let i = 0; i < 3; i++) circ(x + 40 + i * 34, y + 35, 11, [B.red, B.yellow, B.green][i], null);
    rr(x + 150, y + 18, w - 190, 34, 17, '#fff', '#c9cde6', 4);
  };
  const shield = (cx, cy, s, col = B.green) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.fillStyle = col;
    ctx.strokeStyle = B.navy;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, -150);
    ctx.lineTo(130, -100);
    ctx.quadraticCurveTo(130, 90, 0, 160);
    ctx.quadraticCurveTo(-130, 90, -130, -100);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.lineTo(0, 60);
    ctx.moveTo(-60, 0);
    ctx.lineTo(60, 0);
    ctx.stroke();
    ctx.restore();
  };
  const hourglass = (cx, cy, s, k) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = B.navy;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-170, -260);
    ctx.lineTo(170, -260);
    ctx.lineTo(10, 0);
    ctx.lineTo(170, 260);
    ctx.lineTo(-170, 260);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#d99a4e';
    ctx.fillRect(-200, -260 + 250 * k, 400, 250 * (1 - k));
    ctx.fillRect(-200, 260 - 250 * k, 400, 250 * k);
    ctx.restore();
    ctx.stroke();
    rr(-210, -300, 420, 50, 20, B.navy, null);
    rr(-210, 250, 420, 50, 20, B.navy, null);
    ctx.restore();
  };

  const SHOT = {
    checklist(t, s) {
      flat(B.lav);
      clipboard(540, 940, 1, t, s.start + 0.2);
      label(t, W(0, 'checklist') - 0.1, 'O CHECKLIST', 540, 1330, 600, B.red);
    },
    cuidado(t, s) {
      flat(B.cream);
      ground(1320);
      person(pal, 300, 1320, 520, {expr: 'grin', lookX: 0.6});
      person(hero, 780, 1320, 520, {expr: 'worried', lookX: -0.6});
      check(t, W(1, 'certo') - 0.05, 300, 700, 60);
      P(t, W(1, 'servir') - 0.1, 780, 700, () => txt('?', 780, 700, 200, B.red, 900, 'center', B.navy));
      label(t, s.start + 0.05, 'CUIDADO', 540, 540, 480, B.red);
    },
    oficial(t, s) {
      flat(B.blue);
      P(t, s.start, 540, 940, () => doc(300, 640, 480, 620, 'CHECKLIST', B.navy, 5));
      stamp(t, W(1, 'oficial') - 0.05, 'OFICIAL', B.green, 560, 1150, -0.1, 100);
    },
    vfs(t, s) {
      flat(B.lav);
      P(t, s.start, 540, 940, () => {
        browser(120, 560, 840, 760);
        rr(120, 630, 840, 110, 0, B.blue, null);
        txt('VFS GLOBAL', 540, 688, 60, '#fff');
      });
      const steps = [['VISTOS DE LONGA DURAÇÃO', 'longa'], ['DOCUMENTOS NECESSÁRIOS', 'documentos']];
      steps.forEach(([name, w], i) => {
        const tt = W(2, w) - 0.15;
        P(t, tt, 540, 880 + i * 200, () => {
          rr(190, 810 + i * 200, 700, 140, 30, i ? B.red : B.yellow, B.navy, 8);
          fitTxt(name, 540, 882 + i * 200, 54, 620, i ? '#fff' : B.navy);
        });
      });
      if (t > W(2, 'documentos')) arrow(540, 960, 540, 1000, 1, B.navy);
    },
    formulario(t, s) {
      flat(B.cream);
      P(t, s.start, 540, 940, () => doc(270, 620, 540, 700, 'FORMULÁRIO', B.blue, 5));
      for (let i = 0; i < 2; i++) {
        const tt = W(3, 'fotos') - 0.1 + i * 0.15;
        P(t, tt, 640 + i * 150, 900, () => {
          rr(580 + i * 150, 820, 120, 160, 10, B.sky);
          circ(640 + i * 150, 880, 30, '#d9a77a', null);
          rr(605 + i * 150, 920, 70, 50, 25, B.blue, null);
        });
      }
      if (t > W(3, 'tres') - 0.1) txt('2 FOTOS 3×4', 540, 1380, 70, B.navy);
      check(t, W(3, 'quatro'), 830, 600, 50);
    },
    passaporte(t, s) {
      flat(B.cream);
      P(t, s.start, 330, 950, () => passport(330, 950, 0.9));
      P(t, W(4, 'valido') - 0.1, 770, 800, () => calendar(770, 800, 'VALE', 'ATÉ', B.blue));
      P(t, W(4, 'tres') - 0.05, 770, 1150, () => {
        rr(560, 1080, 420, 140, 70, B.red);
        txt('+3 MESES', 770, 1152, 72, '#fff');
      });
      if (t > W(4, 'estadia') - 0.05) txt('além da estadia prevista', 540, 1340, 56, B.navy, 800);
    },
    situacao(t, s) {
      flat(B.lav);
      P(t, s.start, 540, 900, () => doc(300, 600, 480, 560, 'SITUAÇÃO REGULAR', '#5b6280', 4));
      xMark(t, W(5, 'comprovativo') - 0.05, 540, 880, 200);
      flagBR(110, 1180, 200);
      label(t, W(5, 'precisa') - 0.1, 'NÃO PRECISA', 640, 1290, 520, B.green);
    },
    seguro(t, s) {
      flat(B.lav);
      P(t, s.start, 540, 900, () => shield(540, 900, 1.3));
      label(t, s.start + 0.1, 'SEGURO DE VIAGEM', 540, 1300, 740, B.navy);
    },
    pb4(t, s) {
      flat(B.cream);
      P(t, s.start, 540, 940, () => {
        phone(540, 940, 1.05);
        ctx.fillStyle = '#1b3a6b';
        ctx.fillRect(367, 605, 346, 100);
        txt('gov.br', 540, 657, 44, '#fff', 800);
        txt('PB4', 540, 900, 130, B.blue);
        fitTxt('assistência médica', 540, 1020, 36, 300, B.navy, 800);
      });
      stamp(t, W(6, 'graca') - 0.05, 'GRÁTIS', B.green, 760, 1150, -0.12, 90);
    },
    antecedentes(t, s) {
      flat(B.lav);
      P(t, s.start, 540, 900, () => doc(300, 600, 480, 600, 'ANTECEDENTES', B.navy, 4));
      P(t, W(7, 'policia') - 0.1, 540, 560, () => {
        rr(220, 495, 640, 120, 60, '#1b3a6b');
        txt('POLÍCIA FEDERAL', 540, 557, 58, '#fff');
      });
      stamp(t, W(7, 'trinta') - 0.05, 'MÁX. 30 DIAS', B.red, 560, 1200, -0.08, 84);
    },
    final(t, s) {
      flat(B.yellow);
      hourglass(540, 880, 1, clamp01((t - s.start) / 1.6));
      label(t, W(7, 'final') - 0.15, 'DEIXA PRO FINAL', 540, 1310, 720, B.navy);
    },
    meios(t, s) {
      flat(B.cream);
      P(t, s.start, 540, 930, () => doc(270, 650, 540, 580, 'COMPROVANTE', B.green, 4));
      coin(250, 800 + Math.sin(t * 6) * 18, 64);
      coin(840, 700 + Math.sin(t * 6 + 1) * 18, 54);
      coin(820, 1180 + Math.sin(t * 6 + 2) * 18, 60);
      P(t, s.start + 0.1, 540, 1360, () => {
        rr(110, 1260, 860, 190, 40, B.navy);
        txt('MEIOS DE', 540, 1318, 62, '#fff');
        txt('SUBSISTÊNCIA', 540, 1394, 62, B.yellow);
      });
      label(t, W(8, 'curso') - 0.15, 'DURANTE O CURSO', 540, 535, 660, B.green);
    },
    origem(t, s) {
      flat(B.lav);
      P(t, s.start, 540, 920, () => {
        rr(220, 600, 640, 680, 26, '#fff');
        txt('EXTRATO', 540, 670, 54, B.navy);
        for (let i = 0; i < 5; i++) {
          rr(270, 760 + i * 90, 300, 26, 10, '#c9cde6', null);
          rr(640, 760 + i * 90, 160, 26, 10, i === 4 ? B.red : '#c9cde6', null);
        }
      });
      if (t > W(9, 'alto') - 0.1) txt('+ R$ ???', 720, 1220, 50, B.red);
      const k = ramp(t, W(9, 'onde') - 0.6, 0.5);
      magnifier(lerp(380, 720, k), lerp(820, 1130, k), 110);
      label(t, W(9, 'onde') - 0.1, 'DE ONDE VEIO?', 540, 520, 620, B.red);
    },
    matricula(t, s) {
      flat(B.blue);
      P(t, s.start, 540, 900, () => doc(300, 600, 480, 620, 'MATRÍCULA', B.green, 4));
      check(t, W(10, 'matricula'), 760, 640, 70);
      P(t, W(10, 'escola') - 0.1, 540, 1340, () => {
        rr(230, 1270, 620, 140, 70, '#fff');
        txt('DA ESCOLA', 540, 1342, 66, B.blue);
      });
    },
    dgert(t, s) {
      flat(B.lav);
      ground(1320);
      P(t, s.start, 540, 1050, () => building(540, 1320, 640, 600, 'ESCOLA'));
      P(t, W(11, 'dgert') - 0.1, 860, 1020, () => {
        circ(860, 1020, 120, B.green, B.navy, 12);
        txt('DGERT', 860, 1024, 52, '#fff');
      });
      check(t, W(11, 'certificada'), 230, 700, 70);
      label(t, W(11, 'profissionalizante') - 0.1, 'PROFISSIONALIZANTE', 470, 520, 760, B.navy, '#fff', 56);
    },
    umano(t, s) {
      flat(B.cream);
      P(t, s.start, 540, 900, () => {
        calendar(540, 900, 'CURSO', '', B.green);
        txt('1 ANO', 540, 950, 96, B.navy);
      });
      label(t, W(11, 'ano') - 0.1, 'PELO MENOS 1 ANO', 540, 1290, 760, B.green);
    },
    outros(t, s) {
      flat(B.lav);
      clipboard(540, 900, 0.9, t, s.start + 0.1, 5, 0.12);
      label(t, W(12, 'outros') - 0.1, '+ OUTROS DOCUMENTOS', 540, 1330, 860, B.red, '#fff', 60);
    },
    regras(t, s) {
      flat(B.yellow);
      ctx.save();
      ctx.translate(540, 900);
      ctx.rotate((t - s.start) * 2.2);
      ctx.strokeStyle = B.navy;
      ctx.lineWidth = 34;
      ctx.lineCap = 'round';
      for (const a0 of [0, Math.PI]) {
        ctx.beginPath();
        ctx.arc(0, 0, 230, a0 + 0.3, a0 + Math.PI - 0.3);
        ctx.stroke();
      }
      ctx.restore();
      bigWord(t, s.start + 0.05, 'REGRAS MUDAM', 900, B.red, 120);
    },
    cta(t, s) {
      flat(B.blue);
      if (logo) P(t, s.start, 540, 640, () => {
        const w = 600, h = w * (logo.height / logo.width);
        ctx.drawImage(logo, 540 - w / 2, 640 - h / 2, w, h);
      });
      P(t, W(14, 'ajuda') - 0.1, 540, 820, () => {
        rr(330, 760, 420, 120, 60, B.yellow, null);
        txt('AJUDA COM', 540, 822, 60, B.navy);
      });
      [['VISTO', 'visto'], ['DOCUMENTOS', 'documentos'], ['PASSAGEM', 'passagem']].forEach(([name, w], i) => {
        const tt = W(14, w) - 0.08;
        P(t, tt, 540, 990 + i * 140, () => {
          rr(220, 935 + i * 140, 640, 110, 55, '#fff');
          txt(name, 580, 992 + i * 140, 58, B.navy);
        });
        check(t, tt + 0.08, 290, 990 + i * 140, 44);
      });
    },
    direct(t, s) {
      flat(B.lav);
      P(t, s.start, 540, 940, () => {
        phone(540, 940, 1.05);
        circ(540, 740, 80, B.blue);
        if (logo) {
          const w = 130, h = w * (logo.height / logo.width);
          ctx.drawImage(logo, 540 - w / 2, 740 - h / 2, w, h);
        }
        fitTxt('@vaibemviagens', 540, 870, 40, 300, B.navy);
        rr(400, 935, 280, 70, 22, '#eef0fa', null);
        rr(450, 1030, 230, 70, 22, B.blue, null);
        rr(400, 1125, 260, 70, 22, '#eef0fa', null);
      });
      const pulse = 1 + 0.05 * Math.sin((t - s.start) * 9);
      P(t, W(14, 'direct') - 0.1, 540, 1320, () => {
        ctx.save();
        ctx.translate(540, 1320);
        ctx.scale(pulse, pulse);
        ctx.translate(-540, -1320);
        rr(170, 1255, 740, 130, 65, B.red);
        txt('CHAMA NO DIRECT', 540, 1322, 66, '#fff');
        ctx.restore();
      });
    },
    fim(t, s) {
      flat(B.blue);
      if (logo) P(t, s.start, 540, 640, () => {
        const w = 640, h = w * (logo.height / logo.width);
        ctx.drawImage(logo, 540 - w / 2, 640 - h / 2, w, h);
      });
      P(t, s.start + 0.25, 540, 1000, () => {
        rr(120, 880, 840, 260, 50, '#fff');
        txt('qual item tá te dando', 540, 965, 60, B.navy, 900);
        txt('mais trabalho?', 540, 1050, 74, B.red, 900);
      });
      P(t, W(15, 'salva'), 540, 1290, () => {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(230, 1240);
        ctx.lineTo(290, 1240);
        ctx.lineTo(290, 1340);
        ctx.lineTo(260, 1315);
        ctx.lineTo(230, 1340);
        ctx.closePath();
        ctx.fill();
        txt('salva e comenta', 600, 1292, 52, '#fff', 800);
      });
      txt('@vaibemviagens · @lucasmontemorr', 540, 1430, 46, B.lav, 800);
    },
  };

  // ------------------------------------------------------------------ render
  const tEnd = L(15).a;
  const render = (t) => {
    const sh = SHOTS.find((x) => t >= x.start && t < x.end) || SHOTS[SHOTS.length - 1];
    ctx.save();
    // snappy shot entrance: quick zoom settle + slide
    const e = clamp01((t - sh.start) / 0.22);
    const z = lerp(1.08, 1, easeOutCubic(e));
    const idx = SHOTS.indexOf(sh);
    const dx = (1 - easeOutCubic(e)) * (idx % 2 ? 80 : -80);
    if (HALF) {
      // map the scene band y 420..1420 into y 95..855 of a 1080x960 frame
      // TikTok-safe top half: scene band y 450..1460 into y 292..858, left of the icon column
      ctx.translate(S / 2 - 40 + dx, 575);
      ctx.scale(z * 0.56, z * 0.56);
      ctx.translate(-S / 2, -955);
    } else {
      // TikTok/Reels safe area: scene band y 450..1460 shrinks into y 501..1309,
      // shifted left of the right-hand icon column
      ctx.translate(S / 2 - 40 + dx, 905);
      ctx.scale(z * 0.8, z * 0.8);
      ctx.translate(-S / 2, -955);
    }
    SHOT[sh.id](t, sh);
    ctx.restore();
    // white flash on the cut
    const f = 1 - clamp01((t - sh.start) / 0.1);
    if (f > 0 && idx > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 * f})`;
      ctx.fillRect(0, 0, S, 1920);
    }

    const showTitle = t < tEnd;
    title.style.opacity = showTitle ? 1 : 0;
    if (chip) chip.style.opacity = showTitle ? 1 : 0;
    const c = t < tEnd ? CAPS.find((x) => t >= x.a && t < x.b) : null;
    if (c) {
      const html = c.words.map((w) => (TL.accent.includes(norm(w)) ? `<i>${w}</i>` : w)).join(' ');
      if (cap.innerHTML !== html) cap.innerHTML = html;
      cap.style.transform = `scale(${0.82 + 0.18 * easeOutBack(clamp01((t - c.a) / 0.12))})`;
      cap.style.opacity = 1;
    } else cap.style.opacity = 0;
    return {};
  };
  const resize = () => {
    canvas.width = 1080;
    canvas.height = HALF ? 960 : 1920;
  };
  resize();
  return {render, resize};
});
