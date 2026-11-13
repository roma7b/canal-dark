import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth} from '../kit/util.js';
import {createChar} from '../loteria/char.js';
import TL from './timeline.json';
import WORDS_RAW from './narracao-fit-words.json';

// "Como ir pra Portugal em 4 passos" for @lucasmontemorr (inspired by his own video).
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
  ov.innerHTML = '<div class="tt"><b>como ir pra portugal</b><i>em 4 passos</i></div><div class="chip">regras de nov/2026</div><div class="cpt"></div>';
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
    ctx.fillRect(-400, y + 30, S + 800, 600);
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
  const stepCard = (t, s, n, label, col) => {
    flat(col);
    P(t, s.start, 540, 860, () => {
      circ(540, 860, 230, '#fff', B.navy, 14);
      txt(String(n), 540, 878, 300, col);
    });
    P(t, s.start + 0.12, 540, 560, () => {
      rr(360, 505, 360, 110, 55, B.navy, null);
      txt('PASSO', 540, 562, 64, '#fff');
    });
    bigWord(t, s.start + 0.3, label, 1240, '#fff', 150);
    for (let i = 0; i < 4; i++) circ(390 + i * 100, 1400, 26, i < n ? '#fff' : 'rgba(255,255,255,0.25)', i < n ? B.navy : null, 8);
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

  const SHOT = {
    rota(t, s) {
      flat(B.cream);
      flagBR(110, 720, 300);
      flagPT(670, 720, 300);
      const k = easeOutCubic(clamp01((t - s.start - 0.2) / 1.6));
      arrow(430, 820, 650, 820, k);
      const u = clamp01((t - s.start) / 2.4);
      plane(lerp(200, 880, smooth(u)), 620 - Math.sin(u * Math.PI) * 140, 0.75, lerp(-0.15, 0.15, u));
      person(hero, 470, 1400, 300, {expr: 'grin', lookX: 0.5});
      suitcase(620, 1400, 0.8);
      P(t, W(0, 'portugal') - 0.05, 540, 1040, () => {
        rr(400, 985, 280, 110, 55, B.blue, null);
        txt('2026', 540, 1042, 70, '#fff');
      });
    },
    quatro(t, s) {
      flat(B.blue);
      bigWord(t, s.start, '4 PASSOS', 640, '#fff', 200);
      const items = ['PASSAPORTE', 'VISTO', 'DINHEIRO', 'PASSAGEM'];
      items.forEach((name, i) => P(t, W(0, 'ordem') - 0.4 + i * 0.12, 540, 860 + i * 135, () => {
        rr(220, 805 + i * 135, 640, 110, 55, '#fff');
        circ(285, 860 + i * 135, 42, B.red, null);
        txt(String(i + 1), 285, 864 + i * 135, 52, '#fff');
        txt(name, 580, 862 + i * 135, 56, B.navy);
      }));
    },
    voo(t, s) {
      sky();
      cloud(140, 560, 1);
      cloud(720, 480, 0.8);
      ground(1300);
      person(hero, 360, 1300, 600, {expr: 'grin', armR: [95, 70], lookX: 0.5});
      suitcase(580, 1300, 1.2);
      P(t, W(1, 'voo') - 0.1, 720, 760, () => ticket(720, 760, 0.85, -0.08));
      P(t, W(1, 'amanha') - 0.05, 760, 980, () => {
        rr(560, 920, 400, 110, 55, B.red);
        txt('AMANHÃ', 760, 977, 64, '#fff');
      });
    },
    naoexiste(t, s) {
      flat(B.lav);
      ground(1300);
      person(hero, 360, 1300, 600, {expr: 'worried', lookX: 0.5});
      ticket(720, 760, 0.85, -0.08);
      xMark(t, s.start + 0.05, 720, 760, 220);
      stamp(t, W(1, 'existe') - 0.05, 'NÃO EXISTE MAIS', B.red, 540, 1060, -0.08, 76);
    },
    passo1(t, s) {
      stepCard(t, s, 1, 'PASSAPORTE', B.red);
    },
    pf(t, s) {
      flat(B.lav);
      P(t, s.start, 540, 940, () => {
        phone(540, 940, 1.05);
        ctx.fillStyle = '#1b3a6b';
        ctx.fillRect(367, 605, 346, 100);
        txt('gov.br/pf', 540, 657, 44, '#fff', 800);
      });
      P(t, W(2, 'pede') - 0.1, 540, 1000, () => passport(540, 1010, 0.6));
      P(t, W(2, 'policia') - 0.1, 540, 1380, () => {
        rr(170, 1310, 740, 140, 70, B.navy);
        txt('POLÍCIA FEDERAL', 540, 1382, 66, '#fff');
      });
    },
    validade(t, s) {
      flat(B.cream);
      P(t, s.start, 330, 950, () => passport(330, 950, 0.9));
      P(t, W(3, 'validade') - 0.1, 770, 800, () => calendar(770, 800, 'VALE', 'ATÉ', B.blue));
      P(t, W(3, 'tres') - 0.05, 770, 1150, () => {
        rr(560, 1080, 420, 140, 70, B.red);
        txt('+3 MESES', 770, 1152, 72, '#fff');
      });
      if (t > W(3, 'estadia') - 0.05) txt('além da estadia prevista', 540, 1340, 56, B.navy, 800);
    },
    passo2(t, s) {
      stepCard(t, s, 2, 'VISTO', B.blue);
    },
    importante(t, s) {
      flat(B.lav);
      P(t, s.start, 540, 900, () => {
        passport(540, 900, 1);
        rr(380, 950, 320, 170, 20, '#fff', null);
        txt('VISTO', 540, 1036, 64, B.navy);
      });
      stamp(t, W(4, 'importante') - 0.05, 'O MAIS IMPORTANTE', B.red, 540, 1300, -0.06, 74);
    },
    procura(t, s) {
      flat(B.cream);
      P(t, s.start, 540, 900, () => {
        rr(220, 620, 640, 600, 20, '#fff');
        txt('PROCURA DE', 540, 690, 64, B.navy);
        txt('TRABALHO', 540, 760, 64, B.navy);
        for (let i = 0; i < 4; i++) rr(280, 850 + i * 80, i % 2 ? 380 : 520, 30, 10, '#c9cde6', null);
      });
      stamp(t, W(5, 'suspenso') - 0.05, 'SUSPENSO', B.red, 540, 960, -0.1, 100);
      P(t, W(5, 'outubro') - 0.1, 540, 1360, () => {
        rr(260, 1290, 560, 140, 70, B.navy);
        txt('DESDE OUT/2025', 540, 1362, 62, '#fff');
      });
    },
    motivo(t, s) {
      flat(B.lav);
      ground(1350);
      person(hero, 250, 1350, 480, {expr: 'think', lookX: 0.6});
      P(t, W(5, 'motivo') - 0.1, 540, 600, () => {
        rr(300, 520, 480, 160, 80, '#fff');
        txt('MOTIVO?', 540, 602, 84, B.blue);
      });
      P(t, W(5, 'contrato') - 0.1, 560, 980, () => doc(420, 780, 300, 400, 'CONTRATO', B.blue, 3));
      P(t, W(5, 'curso') - 0.1, 870, 980, () => {
        rr(730, 790, 280, 380, 26, B.blue);
        capHat(870, 940, 0.48);
        txt('CURSO', 870, 1100, 52, '#fff');
      });
      check(t, W(5, 'contrato') + 0.15, 690, 800, 46);
      check(t, W(5, 'curso') + 0.15, 990, 800, 46);
    },
    vfs(t, s) {
      flat(B.cream);
      ground(1300);
      P(t, s.start, 290, 1100, () => building(290, 1300, 420, 520, 'VFS'));
      P(t, W(6, 'consulado') - 0.15, 800, 1100, () => building(800, 1300, 420, 520, 'CONSULADO', B.red));
      const k = clamp01((t - W(6, 'documentos')) / 1.0);
      if (k > 0) {
        const u = easeInOutCubic(k);
        P(t, W(6, 'documentos'), lerp(290, 800, u), 640, () => doc(lerp(290, 800, u) - 65, 570 - Math.sin(u * Math.PI) * 60, 130, 150, 'DOCS', B.blue, 2));
      }
      P(t, W(6, 'feitos') - 0.1, 540, 495, () => {
        rr(250, 440, 580, 110, 55, B.blue);
        txt('VFS GLOBAL', 540, 497, 60, '#fff');
      });
    },
    checklist(t, s) {
      flat(B.lav);
      P(t, s.start, 540, 940, () => phone(540, 940, 1.05));
      txt('CHECKLIST', 540, 650, 52, B.navy);
      for (let i = 0; i < 5; i++) {
        const tt = W(7, 'checklist') + i * 0.22;
        P(t, tt, 560, 780 + i * 105, () => rr(450, 765 + i * 105, 230, 30, 10, '#c9cde6', null));
        check(t, tt + 0.08, 400, 780 + i * 105, 34);
      }
      P(t, W(7, 'documentos') - 0.1, 540, 1400, () => {
        rr(170, 1330, 740, 140, 70, B.red);
        txt('DE CADA VISTO', 540, 1402, 66, '#fff');
      });
    },
    passo3(t, s) {
      stepCard(t, s, 3, 'DINHEIRO', B.green);
    },
    meios(t, s) {
      flat(B.cream);
      P(t, s.start, 540, 900, () => doc(260, 600, 560, 640, 'COMPROVANTE', B.green, 4));
      coin(250, 760 + Math.sin(t * 6) * 18, 64);
      coin(840, 700 + Math.sin(t * 6 + 1) * 18, 54);
      coin(820, 1180 + Math.sin(t * 6 + 2) * 18, 60);
      P(t, W(8, 'meios') - 0.1, 540, 1360, () => {
        rr(110, 1260, 860, 190, 40, B.navy);
        txt('MEIOS DE', 540, 1318, 62, '#fff');
        txt('SUBSISTÊNCIA', 540, 1394, 62, B.yellow);
      });
      check(t, W(8, 'checklist'), 760, 1110, 60);
    },
    reserva(t, s) {
      flat(B.lav);
      ground(1350);
      // jar filling with coins
      const k = clamp01((t - s.start - 0.2) / 2.2);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(330, 700, 420, 560, 60);
      ctx.clip();
      ctx.fillStyle = B.yellow;
      ctx.fillRect(330, 1260 - 520 * easeOutCubic(k), 420, 600);
      ctx.restore();
      rr(330, 700, 420, 560, 60, 'rgba(188,212,255,0.25)', B.navy, 12);
      rr(380, 650, 320, 70, 20, B.navy, null);
      for (let i = 0; i < 4; i++) {
        const u = frac((t - s.start) * 0.8 + i / 4);
        coin(480 + i * 40, lerp(420, 900, u), 34);
      }
      P(t, W(9, 'reserva') - 0.1, 540, 560, () => {
        rr(300, 480, 480, 140, 70, B.green);
        txt('RESERVA', 540, 552, 76, '#fff');
      });
      if (t > W(9, 'primeiros') - 0.05) txt('pros primeiros meses', 540, 1300, 56, B.navy, 800);
    },
    passo4(t, s) {
      stepCard(t, s, 4, 'PASSAGEM', B.red);
    },
    aprovado(t, s) {
      flat(B.blue);
      P(t, s.start, 380, 900, () => {
        passport(380, 900, 0.95);
        rr(240, 940, 280, 160, 20, '#fff', null);
        txt('VISTO', 380, 1020, 58, B.navy);
      });
      stamp(t, W(10, 'aprovado') - 0.05, 'APROVADO', B.green, 400, 1040, -0.12, 80);
      P(t, W(10, 'mao') - 0.1, 780, 1280, () => ticket(760, 1290, 0.7, 0.08));
      check(t, W(10, 'mao') + 0.1, 960, 1170, 54);
    },
    atraso(t, s) {
      flat(B.cream);
      // clock with racing hands
      P(t, s.start, 540, 820, () => circ(540, 820, 220, '#fff', B.navy, 14));
      ctx.save();
      ctx.strokeStyle = B.navy;
      ctx.lineCap = 'round';
      ctx.lineWidth = 16;
      const a = (t - s.start) * 7;
      ctx.beginPath();
      ctx.moveTo(540, 820);
      ctx.lineTo(540 + Math.cos(a) * 160, 820 + Math.sin(a) * 160);
      ctx.moveTo(540, 820);
      ctx.lineTo(540 + Math.cos(a / 12) * 100, 820 + Math.sin(a / 12) * 100);
      ctx.stroke();
      ctx.restore();
      P(t, W(11, 'passagem') - 0.1, 540, 1210, () => ticket(540, 1210, 0.8, -0.05));
      stamp(t, W(11, 'prejuizo') - 0.05, 'PREJUÍZO', B.red, 540, 1220, 0.08, 96);
    },
    basicos(t, s) {
      flat(B.lav);
      const items = ['PASSAPORTE', 'VISTO', 'DINHEIRO', 'PASSAGEM'];
      items.forEach((name, i) => {
        const tt = s.start + 0.1 + i * 0.18;
        P(t, tt, 540, 680 + i * 160, () => {
          rr(200, 620 + i * 160, 680, 120, 60, '#fff');
          txt(name, 580, 682 + i * 160, 60, B.navy);
        });
        check(t, tt + 0.1, 270, 680 + i * 160, 46);
      });
    },
    exigencias(t, s) {
      flat(B.blue);
      const cards = [['D1', 'TRABALHO', B.red], ['D4', 'ESTUDO', B.green], ['D7', 'RENDA', '#8a5cf6'], ['D8', 'NÔMADE', B.yellow]];
      cards.forEach(([code, name, col], i) => {
        const cx = 300 + (i % 2) * 480, cy = 760 + Math.floor(i / 2) * 380;
        P(t, s.start + 0.1 + i * 0.12, cx, cy, () => {
          rr(cx - 200, cy - 150, 400, 300, 36, '#fff');
          circ(cx, cy - 40, 80, col);
          txt(code, cx, cy - 36, 72, '#fff');
          txt(name, cx, cy + 90, 52, B.navy);
        });
      });
      P(t, W(12, 'exigencias') - 0.1, 540, 1360, () => {
        rr(130, 1290, 820, 140, 70, '#fff');
        txt('REGRAS DIFERENTES', 540, 1362, 62, B.red);
      });
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
    consulado(t, s) {
      flat(B.lav);
      P(t, s.start, 540, 940, () => phone(540, 940, 1));
      for (let i = 0; i < 4; i++) {
        const tt = s.start + 0.3 + i * 0.25;
        P(t, tt, 540, 760 + i * 120, () => rr(420, 735 + i * 120, 300, 40, 12, '#c9cde6', null));
        check(t, tt + 0.1, 380, 755 + i * 120, 36);
      }
      P(t, W(13, 'consulado') - 0.1, 540, 520, () => {
        rr(170, 450, 740, 140, 70, B.blue);
        fitTxt('CONFIRA NO CONSULADO', 540, 522, 56, 660, '#fff');
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
        txt('em qual passo', 540, 965, 66, B.navy, 900);
        txt('você está?', 540, 1050, 74, B.red, 900);
      });
      P(t, W(14, 'salva'), 540, 1290, () => {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(250, 1240);
        ctx.lineTo(310, 1240);
        ctx.lineTo(310, 1340);
        ctx.lineTo(280, 1315);
        ctx.lineTo(250, 1340);
        ctx.closePath();
        ctx.fill();
        txt('salva e comenta', 590, 1290, 60, '#fff', 800);
      });
      txt('@lucasmontemorr', 540, 1430, 54, B.lav, 800);
    },
  };

  // ------------------------------------------------------------------ render
  const tEnd = L(14).a;
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
      ctx.translate(S / 2 + dx, 475);
      ctx.scale(z * 0.72, z * 0.72);
      ctx.translate(-S / 2, -900);
    } else {
      ctx.translate(S / 2 + dx, 960);
      ctx.scale(z, z);
      ctx.translate(-S / 2, -960);
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
    chip.style.opacity = showTitle ? 1 : 0;
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
