import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth} from '../kit/util.js';
import {createChar} from '../loteria/char.js';
import TL from './timeline.json';
import WORDS_RAW from './narracao-fit-words.json';

// "Como morar em Portugal (do jeito certo)" for @lucasmontemorr.
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

runSim(DEFAULTS, async ({canvas}) => {
  await document.fonts.load('900 40px "Inter"').catch(() => {});
  const ctx = canvas.getContext('2d');
  const logo = await loadImg('../portugal/logo-vaibem-branco.png');
  const hero = createChar(null, 'traveler');
  const pal = createChar(null, 'helper');

  // ------------------------------------------------------------------ overlay
  const app = document.getElementById('app');
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = '<div class="tt"><b>como morar em portugal</b><i>do jeito certo</i></div><div class="chip">regras de nov/2026</div><div class="cap"></div>';
  app.appendChild(ov);
  const cap = ov.querySelector('.cap'), title = ov.querySelector('.tt'), chip = ov.querySelector('.chip');

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
    ctx.fillRect(0, y, S, 30);
    ctx.fillStyle = '#4a5168';
    ctx.fillRect(0, y + 30, S, 240);
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
    ctx.fillRect(0, 0, S, 1920);
  };
  const flat = (col) => {
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, S, 1920);
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

  // --------------------------------------------------------------- the shots
  const SHOT = {
    lisboa(t, s) {
      sky();
      cloud(120, 620, 1);
      cloud(760, 540, 0.8);
      // hills of houses
      const cols = [B.yellow, '#ff9a8a', B.cream, '#9fd3c7', '#ffd1a1', B.sky];
      for (let i = 0; i < 9; i++) {
        const x = i * 125 - 20, h = 230 + ((i * 53) % 140);
        rr(x, 1260 - h, 120, h, 6, cols[i % cols.length]);
        ctx.fillStyle = '#d0503c';
        ctx.fillRect(x - 4, 1260 - h - 20, 128, 24);
        for (let r = 0; r < 2; r++) rr(x + 25, 1260 - h + 40 + r * 80, 70, 50, 6, B.sky, B.navy, 6);
      }
      ground();
      tram(lerp(-340, 120, ramp(t, s.start, 1.4)), 1095, 1.1);
      P(t, s.start + 0.15, 790, 810, () => flagPT(660, 720, 260));
    },
    turista(t, s) {
      flat(B.lav);
      ground(1300);
      person(hero, 430, 1300, 620, {expr: t > W(0, 'resolver') ? 'worried' : 'grin', armR: [40, 20], lookX: 0.4});
      suitcase(640, 1300, 1.3);
      P(t, s.start + 0.1, 540, 640, () => {
        rr(330, 580, 420, 110, 55, B.white);
        txt('TURISTA', 540, 637, 64, B.blue);
      });
      xMark(t, W(0, 'turista'), 540, 1000, 260);
    },
    placa(t, s) {
      flat(B.cream);
      ground(1300);
      rr(522, 760, 36, 540, 10, '#9aa1c4');
      P(t, W(1, 'manifestacao') - 0.1, 540, 760, () => {
        rr(120, 600, 840, 300, 30, B.green);
        txt('MANIFESTAÇÃO', 540, 705, 90, '#fff');
        txt('DE INTERESSE', 540, 805, 90, '#fff');
      });
      person(hero, 250, 1300, 460, {expr: 'think', lookX: 0.6});
    },
    fim2024(t, s) {
      flat(B.lav);
      ground(1300);
      const k = ramp(t, s.start, 0.35);
      ctx.save();
      ctx.translate(200, 1150);
      ctx.rotate(lerp(-1.2, 0, k));
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = i % 2 ? B.red : '#fff';
        ctx.fillRect(i * 100, -30, 100, 60);
      }
      ctx.strokeStyle = B.navy;
      ctx.lineWidth = 10;
      ctx.strokeRect(0, -30, 700, 60);
      ctx.restore();
      rr(170, 1100, 60, 200, 10, B.navy, null);
      P(t, W(1, 'junho') - 0.15, 540, 800, () => calendar(540, 800, 'JUN', '2024'));
      stamp(t, W(1, '2024') + 0.2, 'ACABOU', B.red, 540, 1030);
    },
    mito(t, s) {
      flat(B.red);
      const sh = Math.sin(t * 40) * 10 * clamp01(1 - (t - s.start) / 0.6);
      ctx.save();
      ctx.translate(sh, 0);
      bigWord(t, s.start + 0.05, 'MITO', 900, '#fff', 300, B.navy);
      ctx.restore();
    },
    cplp(t, s) {
      flat(B.lav);
      P(t, s.start, 540, 900, () => {
        rr(330, 620, 420, 560, 30, '#1f2a6b');
        txt('PASSAPORTE', 540, 700, 44, B.yellow);
        circ(540, 850, 80, null, B.yellow, 10);
        txt('VISTO CPLP', 540, 1060, 54, '#fff');
      });
      stamp(t, W(2, 'nao') - 0.05, 'NÃO É PASSE LIVRE', B.red, 540, 1250, -0.08, 70);
    },
    papelada(t, s) {
      flat(B.cream);
      const k = ramp(t, W(2, 'simplifica') - 0.1, 0.5);
      const n = Math.round(lerp(12, 4, k));
      for (let i = 0; i < n; i++) rr(330 + ((i * 37) % 30) - 15, 1220 - i * 42, 420, 40, 8, i % 2 ? B.white : '#eef0fa', B.navy, 6);
      person(hero, 820, 1270, 420, {expr: k > 0.5 ? 'grin' : 'neutral', lookX: -0.6});
      flagBR(110, 760, 200);
      P(t, W(2, 'simplifica'), 540, 720, () => {
        rr(290, 650, 500, 130, 65, B.green);
        txt('+ SIMPLES', 540, 717, 70, '#fff');
      });
    },
    out2025(t, s) {
      flat(B.blue);
      P(t, s.start, 540, 900, () => calendar(540, 900, 'OUT', '2025', B.red));
    },
    procura(t, s) {
      flat(B.cream);
      P(t, s.start, 540, 900, () => {
        rr(220, 620, 640, 600, 20, '#fff');
        txt('VAGAS', 540, 700, 80, B.navy);
        for (let i = 0; i < 5; i++) rr(280, 790 + i * 80, i % 2 ? 380 : 520, 30, 10, '#c9cde6', null);
      });
      magnifier(lerp(420, 620, smooth(frac((t - s.start) / 1.6))), 920, 130);
      xMark(t, W(3, 'comum'), 540, 920, 230);
      stamp(t, W(3, 'emprego') - 0.1, 'ACABOU', B.red, 540, 1300, 0.06);
    },
    motivo(t, s) {
      flat(B.lav);
      ground(1320);
      person(hero, 360, 1320, 620, {expr: t > W(4, 'comprovado') ? 'smug' : 'think', armR: t > W(4, 'comprovado') ? [95, 70] : [20, 150], lookX: 0.5});
      P(t, W(4, 'motivo') - 0.1, 740, 700, () => {
        rr(520, 560, 440, 260, 60, '#fff');
        txt('MOTIVO?', 740, 690, 84, B.blue);
      });
      check(t, W(4, 'comprovado'), 770, 1000, 90);
    },
    contrato(t, s) {
      flat(B.cream);
      P(t, s.start, 540, 900, () => doc(240, 560, 600, 760, 'CONTRATO', B.blue, 5));
      // signature drawing in
      const k = clamp01((t - W(5, 'empresa')) / 0.8);
      if (k > 0) {
        ctx.save();
        ctx.strokeStyle = B.blue;
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i <= 40 * k; i++) {
          const u = i / 40;
          const x = 330 + u * 360, y = 1200 + Math.sin(u * 18) * 22 * (1 - u * 0.5);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }
      P(t, W(5, 'd1') - 0.1, 860, 600, () => {
        circ(860, 600, 120, B.red);
        txt('D1', 860, 606, 110, '#fff');
      });
    },
    remoto(t, s) {
      flat(B.lav);
      P(t, s.start, 540, 900, () => laptop(540, 1000, 1));
      globe(540, 860, 110, t);
      P(t, W(6, 'nomade') - 0.15, 540, 560, () => {
        rr(170, 490, 740, 140, 70, B.blue);
        txt('NÔMADE DIGITAL', 540, 562, 70, '#fff');
      });
    },
    renda(t, s) {
      flat(B.cream);
      bars(260, 1250, t, s.start, [180, 300, 450, 640], B.green);
      coin(830, 600 + Math.sin(t * 6) * 20, 70);
      coin(720, 700 + Math.sin(t * 6 + 1) * 20, 55);
      stamp(t, W(6, 'alta') - 0.05, 'RENDA ALTA', B.blue, 540, 560, -0.05, 80);
    },
    estudante(t, s) {
      flat(B.blue);
      P(t, s.start, 540, 820, () => capHat(540, 820, 1.3));
      P(t, W(7, 'estudante') - 0.05, 540, 1150, () => {
        rr(220, 1080, 640, 140, 70, '#fff');
        txt('ESTUDANTE', 540, 1152, 80, B.blue);
      });
      check(t, W(7, 'aceito'), 830, 640, 80);
      if (t > W(7, 'curso') - 0.05) {
        const items = ['profissionalizante', 'politécnico', 'graduação'];
        const vis = items.filter((_, i) => t > W(7, ['profissionalizante', 'politecnico', 'graduacao'][i]) - 0.05);
        if (vis.length) fitTxt(vis.join(' · '), 540, 1290, 56, 940, '#fff', 800);
      }
    },
    rendapropria(t, s) {
      flat(B.lav);
      ground(1300);
      P(t, s.start, 540, 1100, () => house(540, 1300, 1.3));
      coin(200, 880 + Math.sin(t * 5) * 18, 64, 'R$');
      coin(880, 860 + Math.sin(t * 5 + 1) * 18, 64, 'R$');
      P(t, W(7, 'propria') - 0.1, 540, 590, () => {
        rr(180, 520, 720, 140, 70, B.red);
        txt('RENDA PRÓPRIA', 540, 592, 72, '#fff');
      });
      if (t > W(7, 'aposentadoria') - 0.1) txt('aposentadoria · aluguel', 540, 700, 50, B.navy, 800);
    },
    checklist(t, s) {
      flat(B.cream);
      P(t, s.start, 540, 900, () => {
        rr(260, 560, 560, 760, 30, '#fff');
        rr(420, 520, 240, 80, 20, '#9aa1c4');
        txt('PAPELADA', 540, 650, 64, B.navy);
      });
      for (let i = 0; i < 4; i++) {
        const tt = s.start + 0.25 + i * 0.18;
        P(t, tt, 400, 790 + i * 120, () => rr(340, 760 + i * 120, 60, 60, 12, '#fff'));
        check(t, tt + 0.1, 370, 790 + i * 120, 34);
        P(t, tt, 600, 790 + i * 120, () => rr(440, 775 + i * 120, 320, 30, 10, '#c9cde6', null));
      }
    },
    pf(t, s) {
      flat(B.lav);
      P(t, s.start, 540, 900, () => {
        rr(120, 600, 840, 640, 30, '#fff');
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(120, 600, 840, 640, 30);
        ctx.clip();
        ctx.fillStyle = '#1b3a6b';
        ctx.fillRect(120, 600, 840, 110);
        ctx.restore();
        rr(120, 600, 840, 640, 30, null);
        for (let i = 0; i < 3; i++) circ(170 + i * 40, 655, 12, '#fff', null);
        txt('Polícia Federal', 600, 657, 48, '#fff', 800);
      });
      P(t, W(8, 'criminais') - 0.2, 540, 980, () => doc(330, 760, 420, 430, 'ANTECEDENTES', B.navy, 3));
      stamp(t, W(8, 'graca') - 0.05, 'GRÁTIS', B.green, 760, 1160, -0.15, 90);
    },
    apostila(t, s) {
      flat(B.cream);
      doc(300, 640, 480, 620, 'ANTECEDENTES', B.navy, 4);
      // rubber stamp coming down
      const k = clamp01((t - s.start) / 0.35);
      const y = lerp(380, 820, easeOutCubic(k));
      rr(470, y - 200, 140, 160, 30, '#8a5a3a');
      rr(420, y - 50, 240, 60, 14, B.red);
      if (k >= 1) {
        circ(540, 1000, 120, 'rgba(232,25,63,0.12)', B.red, 12);
        txt('HAIA', 540, 1004, 64, B.red);
      }
      P(t, W(8, 'apostila'), 540, 560, () => {
        rr(180, 500, 720, 120, 60, B.blue);
        txt('APOSTILA DE HAIA', 540, 562, 64, '#fff');
      });
      stamp(t, W(8, 'paga') - 0.05, 'PAGA · R$', B.red, 560, 1180, 0.1, 80);
    },
    pouso(t, s) {
      sky('#ffb37a', '#ffe1c4');
      const k = ramp(t, s.start, 1.4);
      for (let i = 0; i < 9; i++) {
        const x = i * 125 - 20, h = 180 + ((i * 53) % 120);
        rr(x, 1300 - h, 120, h, 6, ['#ffd1a1', B.cream, '#ff9a8a'][i % 3]);
      }
      ground(1300);
      plane(lerp(1100, 380, k), lerp(500, 1000, k), 1.2, lerp(0.15, 0.05, k));
      P(t, s.start + 0.2, 230, 760, () => flagPT(110, 690, 240));
    },
    aima(t, s) {
      flat(B.lav);
      ground(1320);
      P(t, s.start, 540, 1000, () => building(540, 1320, 680, 640, 'AIMA'));
      P(t, W(9, 'autorizacao') - 0.1, 540, 590, () => {
        rr(110, 500, 860, 180, 40, B.blue);
        txt('AUTORIZAÇÃO', 540, 555, 66, '#fff');
        txt('DE RESIDÊNCIA', 540, 630, 66, '#fff');
      });
      check(t, W(9, 'imigracao'), 880, 900, 70);
    },
    brasil(t, s) {
      flat(B.green);
      P(t, s.start, 540, 900, () => flagBR(240, 690, 600));
      bigWord(t, s.start + 0.2, 'E NO BRASIL', 1300, '#fff', 120);
    },
    fev(t, s) {
      flat(B.cream);
      P(t, s.start, 540, 820, () => {
        rr(170, 540, 740, 700, 34, '#fff');
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(170, 540, 740, 700, 34);
        ctx.clip();
        ctx.fillStyle = B.red;
        ctx.fillRect(170, 540, 740, 120);
        ctx.restore();
        rr(170, 540, 740, 700, 34, null);
        txt('FEVEREIRO', 540, 602, 70, '#fff');
        for (let i = 0; i < 28; i++) {
          const x = 230 + (i % 7) * 95, y = 720 + Math.floor(i / 7) * 115;
          txt(String(i + 1), x + 25, y + 25, 40, i % 7 > 4 ? '#b5b9d4' : B.navy, 800);
        }
      });
      // last business day ring (day 27 position used as a generic "last weekday")
      const k = ramp(t, W(10, 'util') - 0.05, 0.4);
      if (k > 0) {
        ctx.save();
        ctx.strokeStyle = B.blue;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.arc(230 + 4 * 95 + 25, 720 + 3 * 115 + 25, 56, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
        ctx.stroke();
        ctx.restore();
      }
      if (t > W(10, 'util')) txt('último dia útil', 540, 1310, 64, B.blue, 900);
    },
    receita(t, s) {
      flat(B.lav);
      P(t, s.start, 540, 900, () => doc(220, 560, 640, 720, 'RECEITA FEDERAL', '#1b3a6b', 4));
      P(t, W(10, 'comunicacao') - 0.1, 540, 1100, () => {
        rr(150, 1020, 780, 170, 40, B.red);
        txt('COMUNICAÇÃO DE', 540, 1072, 58, '#fff');
        txt('SAÍDA DEFINITIVA', 540, 1140, 58, '#fff');
      });
      check(t, W(10, 'receita'), 820, 640, 70);
    },
    remessa(t, s) {
      flat(B.cream);
      flagBR(90, 800, 230);
      flagPT(760, 800, 230);
      const k = clamp01((t - s.start - 0.2) / 1.2);
      arrow(330, 880, 740, 880, easeOutCubic(k));
      for (let i = 0; i < 5; i++) {
        const u = frac((t - s.start) * 0.9 + i / 5);
        coin(lerp(330, 740, u), 880 - Math.sin(u * Math.PI) * 160, 40, 'R$');
      }
      P(t, W(11, 'conta') - 0.1, 540, 1150, () => {
        rr(250, 1080, 580, 140, 70, B.blue);
        txt('SUA CONTA', 540, 1152, 70, '#fff');
      });
    },
    iof(t, s) {
      flat(B.red);
      bigWord(t, s.start, 'IOF', 760, '#fff', 260);
      bigWord(t, W(11, 'tres') - 0.05, '3,5%', 1060, B.yellow, 300);
    },
    conta(t, s) {
      flat(B.navy);
      P(t, s.start, 540, 800, () => txt('R$ 10.000', 540, 800, 160, '#fff', 900));
      const k = clamp01((t - W(11, 'trezentos')) / 0.8);
      if (k > 0) {
        txt(`– R$ ${Math.round(350 * k)}`, 540, 1020, 150, '#ff3d63', 900);
        for (let i = 0; i < 6; i++) {
          const u = clamp01(k * 1.4 - i * 0.08);
          coin(300 + i * 95, 1150 + u * 300, 34, 'R$');
        }
      }
    },
    modalidades(t, s) {
      flat(B.lav);
      const cards = [['D1', 'TRABALHO', B.red], ['D8', 'NÔMADE', B.blue], ['D4', 'ESTUDO', B.green], ['D7', 'RENDA', '#8a5cf6']];
      cards.forEach(([code, name, col], i) => {
        const cx = 300 + (i % 2) * 480, cy = 720 + Math.floor(i / 2) * 380;
        P(t, s.start + 0.1 + i * 0.15, cx, cy, () => {
          rr(cx - 200, cy - 150, 400, 300, 36, '#fff');
          circ(cx, cy - 40, 80, col);
          txt(code, cx, cy - 36, 72, '#fff');
          txt(name, cx, cy + 90, 52, B.navy);
        });
      });
      P(t, W(10, 'algumas') - 0.05, 540, 1340, () => {
        rr(150, 1270, 780, 140, 70, B.navy);
        txt('E EXISTEM OUTRAS', 540, 1342, 62, '#fff');
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
      P(t, W(11, 'consulado') - 0.1, 540, 520, () => {
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
        txt('qual seria o seu', 540, 965, 66, B.navy, 900);
        txt('motivo pra ir?', 540, 1050, 74, B.red, 900);
      });
      P(t, W(12, 'salva'), 540, 1290, () => {
        // bookmark icon + handle
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
  const tEnd = L(12).a;
  const render = (t) => {
    const sh = SHOTS.find((x) => t >= x.start && t < x.end) || SHOTS[SHOTS.length - 1];
    ctx.save();
    // snappy shot entrance: quick zoom settle + slide
    const e = clamp01((t - sh.start) / 0.22);
    const z = lerp(1.08, 1, easeOutCubic(e));
    const idx = SHOTS.indexOf(sh);
    const dx = (1 - easeOutCubic(e)) * (idx % 2 ? 80 : -80);
    ctx.translate(S / 2 + dx, 960);
    ctx.scale(z, z);
    ctx.translate(-S / 2, -960);
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
    canvas.height = 1920;
  };
  resize();
  return {render, resize};
});
