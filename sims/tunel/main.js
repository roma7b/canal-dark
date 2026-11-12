import {runSim} from '../kit/runtime.js';
import {clamp01, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth} from '../kit/util.js';
import TL from './timeline.json';
import WORDS_RAW from './narracao-fit-words.json';

// "Você Decide: O Túnel", episode 1. Still keyframes (generated once, cheap)
// brought to life in code: push-ins, handheld drift, lamp flicker, dust,
// a game HUD, code-drawn infographics, and captions keyed to the narration.
// Every beat reads its time from the word timings, so a new voice re-times it.

const DEFAULTS = {duration: TL.duration, fps: 30, hud: {enabled: false, title: 'tunel', subtitle: ''}, director: {enabled: false}, watermark: ''};

const frac = (x) => x - Math.floor(x);
const hash = (i, k = 0) => frac(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453);
const norm = (w) => w.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
const noise = (t, s) => Math.sin(t * 7.1 + s) * 0.5 + Math.sin(t * 13.7 + s * 2.3) * 0.3 + Math.sin(t * 29.3 + s * 4.1) * 0.2;
const ramp = (t, a, d = 0.35) => easeOutCubic(clamp01((t - a) / d));
const inOut = (t, a, b, f = 0.25) => smooth((t - a) / f) * (1 - smooth((t - b) / f));

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

// captions: phrases of up to 3 words, cut at punctuation
const CAPS = [];
{
  let cur = [];
  WORDS_RAW.forEach((w, i) => {
    cur.push(w);
    const next = WORDS_RAW[i + 1];
    if (cur.length >= 3 || /[.?!,…:]$/.test(w.w) || !next || next.line !== w.line) {
      CAPS.push({a: cur[0].a - 0.05, b: next ? next.a - 0.05 : w.b + 0.5, words: cur.map((x) => x.w.replace(/[.,…:]+$/, ''))});
      cur = [];
    }
  });
}

const SHOTS = TL.shots.map((s, i) => ({...s, start: i === 0 ? 0 : L(s.line).a - 0.1}));
SHOTS.forEach((s, i) => (s.end = i + 1 < SHOTS.length ? SHOTS[i + 1].start : TL.duration));

const loadImg = (src) =>
  new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });

const C = {bg: '#05080c', orange: '#ffb347', red: '#ff5a3d', green: '#7dff9a', ink: '#05080c', paper: '#e8dcc2', note: '#c98a4a'};

runSim(DEFAULTS, async ({canvas}) => {
  await Promise.all([document.fonts.load('900 40px "Inter"'), document.fonts.load('700 40px "JetBrains Mono"')]).catch(() => {});
  const ctx = canvas.getContext('2d');
  const names = ['s1', 's2', 's4', 's6', 's7', 's8', 's9', 's10'];
  const IM = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await loadImg(`../tunel/frames/${n}.png`)])));

  // ------------------------------------------------------------------ overlay
  const app = document.getElementById('app');
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = `<div class="tag">DOIS CAMINHOS · <b>O TÚNEL</b> · PARTE 1</div>
    <div class="gh"><div class="money"><small>BOLADA</small><b>R$ 0</b></div><div class="crew"><small>EQUIPE</small><b>4</b></div><div class="heat"><small>CALOR</small><b>0%</b></div></div>
    <div class="fic">FICÇÃO INSPIRADA EM FATOS REAIS</div>
    <div class="chip" id="c-local">FORTALEZA · 2005</div>
    <div class="chip" id="c-fach">FACHADA: GRAMA SINTÉTICA</div>
    <div class="chip" id="c-clock">SÁB 23:40 → BANCO ABRE SEG 08:00</div>
    <div class="chip green" id="c-used">✓ NOTAS USADAS</div>
    <div class="chip green" id="c-seq">✓ FORA DE SEQUÊNCIA</div>
    <div class="chip" id="c-plan">PLANO: 1 CARRO POR VEZ</div>
    <div class="chip red" id="c-dom">DOM 03:00</div>
    <div class="choice a" id="ch-a"><h3><span>A</span>FICAR</h3><p>Se o Bira ficar calado, o resto está seguro.<br>Se ele falar, a polícia chega antes do sol.</p></div>
    <div class="choice b" id="ch-b"><h3><span>B</span>FUGIR</h3><p>Caminhão de grama, com o que couber.<br>Pela mesma estrada onde pararam o Bira.</p></div>
    <div class="end"><h2><i>A</i> ou <i class="b">B</i>?</h2><p>Comenta aí embaixo.</p><small>A parte 2 segue a escolha da maioria.<br>Segue <b>@doiscaminhos.br</b> pra não perder.<br>No caso real, a maior parte do bando foi presa.</small></div>
    <div class="cap"></div>`;
  app.appendChild(ov);
  const $ = (s) => ov.querySelector(s);
  const money = $('.money b'), crew = $('.crew b'), heat = $('.heat b'), cap = $('.cap');
  const chips = [
    [$('#c-local'), L(1).a, L(1).a + 2.6, 0],
    [$('#c-fach'), W(1, 'grama') - 0.1, L(2).a - 0.1, 70],
    [$('#c-clock'), L(3).a, L(3).b + 0.3, 0],
    [$('#c-used'), W(6, 'usadas') - 0.1, L(7).a - 0.1, 0],
    [$('#c-seq'), W(6, 'fora') - 0.1, L(7).a - 0.1, 70],
    [$('#c-plan'), W(7, 'plano') - 0.1, L(8).a - 0.1, 0],
    [$('#c-dom'), L(8).a, L(10).a - 0.1, 0],
  ];
  const chA = $('#ch-a'), chB = $('#ch-b'), end = $('.end');

  // ------------------------------------------------------------- drawing kit
  let Wd = 1080, Hd = 1920;
  const cover = (im, x0, y0, w, h, zoom, fx, fy, dx = 0, dy = 0) => {
    if (!im) return;
    const s = Math.max(w / im.width, h / im.height) * zoom;
    let x = x0 + w / 2 - fx * im.width * s + dx;
    let y = y0 + h / 2 - fy * im.height * s + dy;
    x = Math.min(x0, Math.max(x0 + w - im.width * s, x));
    y = Math.min(y0, Math.max(y0 + h - im.height * s, y));
    ctx.drawImage(im, x, y, im.width * s, im.height * s);
  };
  const dust = (t, n, y0 = 0, y1 = Hd, a0 = 1) => {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const px = frac(hash(i, 1) + t * (0.004 + hash(i, 2) * 0.01) + 0.02 * Math.sin(t * 0.7 + i)) * Wd;
      const py = y0 + frac(hash(i, 3) - t * (0.006 + hash(i, 4) * 0.012)) * (y1 - y0);
      const r = 1.5 + hash(i, 5) * 3.5;
      const a = (0.2 + 0.3 * Math.sin(t * 2 + i) ** 2) * a0;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
      g.addColorStop(0, `rgba(255,190,120,${a})`);
      g.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - r * 3, py - r * 3, r * 6, r * 6);
    }
    ctx.globalCompositeOperation = 'source-over';
  };
  const grade = (t, flicker = 0.1) => {
    const dip = frac(t / 2.3) < 0.04 ? 0.5 : 0;
    const fl = flicker * (0.5 + 0.5 * noise(t * 2, 3)) + dip * flicker;
    ctx.fillStyle = `rgba(0,0,0,${fl})`;
    ctx.fillRect(0, 0, Wd, Hd);
    const v = ctx.createRadialGradient(Wd / 2, Hd * 0.58, Hd * 0.25, Wd / 2, Hd * 0.58, Hd * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, Wd, Hd);
    const top = ctx.createLinearGradient(0, 0, 0, Hd * 0.25);
    top.addColorStop(0, 'rgba(0,0,0,0.6)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, Wd, Hd * 0.25);
  };
  const text = (s, x, y, size, col, weight = 900, align = 'center', font = 'Inter') => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (col !== C.ink) {
      ctx.lineWidth = size * 0.16;
      ctx.strokeStyle = C.ink;
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = col;
    ctx.fillText(s, x, y);
  };
  const bgPlate = () => {
    const g = ctx.createLinearGradient(0, 0, 0, Hd);
    g.addColorStop(0, '#071318');
    g.addColorStop(1, '#0d2830');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Wd, Hd);
    ctx.strokeStyle = 'rgba(125,220,255,0.06)';
    ctx.lineWidth = 2;
    for (let x = 0; x < Wd; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, Hd);
      ctx.stroke();
    }
    for (let y = 0; y < Hd; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(Wd, y);
      ctx.stroke();
    }
  };

  // map: house -> tunnel under the avenue -> vault
  const drawMap = (t, sh) => {
    bgPlate();
    const gy = 860;
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(0, gy, Wd, 900);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.15 + hash(i, 2) * 0.2})`;
      ctx.beginPath();
      ctx.arc(hash(i, 1) * Wd, gy + 40 + hash(i, 3) * 820, 3 + hash(i, 4) * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#2a2f36';
    ctx.fillRect(330, gy - 26, 420, 26);
    ctx.setLineDash([26, 22]);
    ctx.strokeStyle = '#f2d16b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(330, gy - 13);
    ctx.lineTo(750, gy - 13);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 2; i++) {
      const x = 330 + frac(t * 0.25 + i * 0.5) * 420;
      ctx.fillStyle = i ? C.red : '#7dc6ff';
      ctx.fillRect(x - 34, gy - 60, 68, 30);
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(x - 20, gy - 28, 8, 0, 7);
      ctx.arc(x + 20, gy - 28, 8, 0, 7);
      ctx.fill();
    }
    text('AV. DOM MANUEL', 540, gy - 100, 30, '#cfe8f0', 800, 'center', 'JetBrains Mono');
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 6;
    ctx.fillStyle = C.paper;
    ctx.fillRect(60, gy - 220, 230, 220);
    ctx.strokeRect(60, gy - 220, 230, 220);
    ctx.fillStyle = '#c0533a';
    ctx.beginPath();
    ctx.moveTo(40, gy - 220);
    ctx.lineTo(175, gy - 320);
    ctx.lineTo(310, gy - 220);
    ctx.fill();
    ctx.fillStyle = '#5ea35a';
    ctx.fillRect(90, gy - 70, 170, 70);
    text('CASA', 175, gy - 150, 40, C.ink, 900);
    ctx.fillStyle = '#9fb3bf';
    ctx.fillRect(780, gy - 420, 260, 420);
    for (let r = 0; r < 5; r++)
      for (let c2 = 0; c2 < 3; c2++) {
        ctx.fillStyle = '#5d7380';
        ctx.fillRect(805 + c2 * 80, gy - 395 + r * 70, 50, 40);
      }
    ctx.strokeStyle = C.ink;
    ctx.strokeRect(780, gy - 420, 260, 420);
    text('BANCO', 910, gy - 520, 40, C.paper, 900);
    text('CENTRAL', 910, gy - 470, 40, C.paper, 900);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(820, gy + 300, 190, 150);
    ctx.strokeRect(820, gy + 300, 190, 150);
    text('COFRE', 915, gy + 375, 40, C.ink, 900);
    const tAte = W(2, 'ate');
    const k = easeInOutCubic(clamp01((t - sh.start - 0.2) / (tAte - sh.start + 0.3)));
    const pts = [[175, gy], [175, gy + 380], [820, gy + 380]];
    const segLen = [380, 645];
    let rem = k * (segLen[0] + segLen[1]);
    ctx.strokeStyle = C.orange;
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    let tip = pts[0];
    for (let i = 0; i < 2 && rem > 0; i++) {
      const d = Math.min(rem, segLen[i]);
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      tip = [x0 + (x1 - x0) * (d / segLen[i]), y0 + (y1 - y0) * (d / segLen[i])];
      ctx.lineTo(...tip);
      rem -= d;
    }
    ctx.stroke();
    ctx.fillStyle = '#fff3d0';
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], 16 + 4 * Math.sin(t * 12), 0, 7);
    ctx.fill();
    const meters = Math.round(80 * clamp01((k * (segLen[0] + segLen[1]) - segLen[0]) / segLen[1]));
    text(`${meters} m`, 500, gy + 230, 96, C.orange, 900, 'center', 'JetBrains Mono');
    text('TÚNEL', 500, gy + 310, 40, '#cfe8f0', 800, 'center', 'JetBrains Mono');
    if (t > tAte - 0.1) {
      ctx.globalAlpha = ramp(t, tAte - 0.1, 0.25) * (0.5 + 0.5 * Math.sin(t * 10));
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 10;
      ctx.strokeRect(808, gy + 288, 214, 174);
      ctx.globalAlpha = 1;
    }
  };

  // weight: one note ~ 1 g, 3.3 million notes ~ 3 tonnes, one car can't carry it
  const drawWeight = (t) => {
    bgPlate();
    const t5 = L(5).a, tTon = W(5, 'toneladas'), tNao = W(5, 'nao');
    const np = ramp(t, L(4).a + 0.6, 0.4);
    const big = t < t5;
    const nw = big ? 640 : 300, nh = nw * 0.48;
    ctx.save();
    ctx.translate(Wd / 2, big ? 900 : 540);
    ctx.scale(np, np);
    ctx.rotate(-0.06);
    ctx.fillStyle = C.note;
    ctx.fillRect(-nw / 2, -nh / 2, nw, nh);
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = nw * 0.012;
    ctx.strokeRect(-nw / 2 + nw * 0.04, -nh / 2 + nh * 0.08, nw * 0.92, nh * 0.84);
    ctx.fillStyle = '#e6b878';
    ctx.beginPath();
    ctx.arc(nw * 0.22, 0, nh * 0.3, 0, 7);
    ctx.fill();
    text('50', -nw * 0.22, 0, nh * 0.55, '#fff3d0');
    ctx.restore();
    if (big) {
      const wp = ramp(t, W(4, 'pesa') - 0.05);
      if (wp > 0) text('≈ 1 g', Wd / 2, 1240, 150 * (0.8 + 0.2 * wp), C.orange, 900, 'center', 'JetBrains Mono');
      return;
    }
    const n = Math.round(3294000 * easeOutCubic(clamp01((t - t5) / (tTon - t5))));
    text(n.toLocaleString('pt-BR'), Wd / 2, 730, 120, '#ffffff', 900, 'center', 'JetBrains Mono');
    text('NOTAS', Wd / 2, 825, 44, '#cfe8f0', 800, 'center', 'JetBrains Mono');
    const k = clamp01((t - t5) / (tTon - t5 + 0.3));
    for (let i = 0; i < 9; i++) {
      const h = 40 + 170 * Math.min(1, k * 1.2 - i * 0.03) * (0.6 + 0.4 * hash(i, 3));
      if (h <= 40) continue;
      const x = 150 + i * 90;
      for (let y = 0; y < h; y += 14) {
        ctx.fillStyle = y % 28 ? C.note : '#a8713a';
        ctx.fillRect(x, 1200 - y, 72, 12);
      }
    }
    if (t > tTon - 0.1) {
      const p = ramp(t, tTon - 0.1, 0.3);
      ctx.globalAlpha = p;
      text('≈ 3 TONELADAS', Wd / 2, 935, 92 * (0.85 + 0.15 * p), C.orange, 900, 'center', 'JetBrains Mono');
      ctx.globalAlpha = 1;
    }
    if (t > tNao - 0.1) {
      const p = easeOutBack(clamp01((t - tNao + 0.1) / 0.3));
      ctx.save();
      ctx.translate(Wd / 2, 1370);
      ctx.scale(p, p);
      ctx.fillStyle = '#7dc6ff';
      ctx.fillRect(-150, -50, 300, 70);
      ctx.fillRect(-90, -100, 170, 60);
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(-90, 25, 30, 0, 7);
      ctx.arc(90, 25, 30, 0, 7);
      ctx.fill();
      ctx.strokeStyle = C.red;
      ctx.lineWidth = 28;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-170, -140);
      ctx.lineTo(170, 80);
      ctx.moveTo(170, -140);
      ctx.lineTo(-170, 80);
      ctx.stroke();
      ctx.restore();
    }
  };

  const drawPhone = (t, a) => {
    const p = easeOutBack(clamp01((t - a) / 0.35));
    if (p <= 0) return;
    ctx.save();
    ctx.translate(Wd * 0.7, 1000);
    ctx.scale(p, p);
    ctx.rotate(0.06);
    ctx.fillStyle = '#222b33';
    ctx.beginPath();
    ctx.roundRect(-170, -260, 340, 520, 40);
    ctx.fill();
    ctx.fillStyle = '#9fd8ff';
    ctx.fillRect(-140, -220, 280, 300);
    text('BIRA', 0, -160, 48, C.ink, 900, 'center', 'JetBrains Mono');
    text('CAIXA', 0, -60, 46, C.red, 900, 'center', 'JetBrains Mono');
    text('POSTAL', 0, 0, 46, C.red, 900, 'center', 'JetBrains Mono');
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = '#3b4752';
      ctx.fillRect(-120 + (i % 3) * 90, 110 + Math.floor(i / 3) * 45, 60, 30);
    }
    ctx.restore();
  };

  const drawRadioFx = (t) => {
    ctx.globalAlpha = ramp(t, W(10, 'plantao') - 0.1, 0.25);
    ctx.fillStyle = C.red;
    ctx.fillRect(0, 430, Wd, 110);
    text('PLANTÃO', Wd / 2, 486, 80, '#ffffff', 900);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.orange;
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let x = 80; x <= Wd - 80; x += 10) {
      const a = 40 * Math.sin(x * 0.05 + t * 20) * Math.sin(x * 0.013 + t * 3) * (0.4 + 0.6 * noise(t * 3 + x * 0.01, 2));
      if (x === 80) ctx.moveTo(x, 640 + a);
      else ctx.lineTo(x, 640 + a);
    }
    ctx.stroke();
  };

  // ------------------------------------------------------------------ render
  const tTon0 = W(0, 'toneladas');
  const tNot = W(8, 'nao');
  const tPol = W(10, 'policia');
  const heatAt = (t) => (t < L(3).a ? 0 : t < tNot ? 10 : t < tPol ? 35 : 70);
  const tA = L(12).a, tB = L(13).a, tEnd = L(14).a;

  const render = (t) => {
    Wd = canvas.width;
    Hd = canvas.height;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, Wd, Hd);
    const sh = SHOTS.find((s) => t >= s.start && t < s.end) || SHOTS[SHOTS.length - 1];
    const k = clamp01((t - sh.start) / (sh.end - sh.start));
    const dx = noise(t, 1) * 0.004 * Wd, dy = noise(t, 7) * 0.004 * Hd;
    if (sh.img) {
      cover(IM[sh.img], 0, 0, Wd, Hd, lerp(sh.zoom[0], sh.zoom[1], smooth(k)), sh.focus[0], sh.focus[1], dx, dy);
      dust(t, sh.id === 'tunel' || sh.id === 'cofre' ? 140 : 50);
      grade(t, sh.id === 'radio' || sh.id === 'janela' ? 0.08 : 0.12);
      if (sh.id === 'janela') drawPhone(t, L(9).a - 0.1);
      if (sh.id === 'radio') drawRadioFx(t);
    } else if (sh.id === 'mapa') drawMap(t, sh);
    else if (sh.id === 'peso') drawWeight(t);
    else {
      // split screen: A (stay) on top, B (run) below
      const fin = sh.id === 'fim';
      const fA = fin ? 0.35 : t > tB ? 0.35 : 1;
      const fB = fin ? 0.35 : t > tA && t < tB ? 0.35 : 1;
      const z = lerp(1.0, 1.12, smooth(k));
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, Wd, Hd / 2 - 4);
      ctx.clip();
      cover(IM.s8, 0, 0, Wd, Hd / 2 - 4, z, 0.45, 0.42, dx, dy);
      ctx.fillStyle = `rgba(0,0,0,${1 - fA})`;
      ctx.fillRect(0, 0, Wd, Hd / 2);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, Hd / 2 + 4, Wd, Hd / 2);
      ctx.clip();
      cover(IM.s10, 0, Hd / 2 + 4, Wd, Hd / 2, z, 0.5, 0.5, dx, dy);
      ctx.fillStyle = `rgba(0,0,0,${1 - fB})`;
      ctx.fillRect(0, Hd / 2, Wd, Hd / 2);
      ctx.restore();
      ctx.fillStyle = C.orange;
      ctx.fillRect(0, Hd / 2 - 4, Wd, 8);
      if (fin) {
        ctx.fillStyle = 'rgba(5,8,12,0.55)';
        ctx.fillRect(0, 0, Wd, Hd);
      }
      dust(t, 40, 0, Hd, 0.6);
    }

    // HUD
    const m = 164.7 * easeOutCubic(clamp01((t - tTon0) / 1.4));
    money.textContent = m < 0.05 ? 'R$ 0' : `R$ ${m.toFixed(1).replace('.', ',')} MI`;
    crew.textContent = t < tNot ? '4' : '3';
    crew.style.color = t > tNot && t < tNot + 1.2 && frac(t * 3) < 0.5 ? C.red : '#ffffff';
    heat.textContent = `${heatAt(t)}%`;
    for (const [el, a, b, off] of chips) {
      el.style.opacity = inOut(t, a, b, 0.2);
      el.style.top = `${360 + off}px`;
      el.style.transform = `translateX(${(1 - ramp(t, a, 0.3)) * -40}px)`;
    }
    chA.style.top = '640px';
    chB.style.top = `${Hd / 2 + 330}px`;
    chA.style.opacity = inOut(t, L(11).a + 0.3, tEnd - 0.1, 0.25) * (t > tB ? 0.45 : 1);
    chB.style.opacity = inOut(t, L(11).a + 0.6, tEnd - 0.1, 0.25) * (t > tA && t < tB ? 0.45 : 1);
    chA.style.borderColor = t > tA && t < tB ? C.orange : 'rgba(255,255,255,0.25)';
    chB.style.borderColor = t > tB ? C.red : 'rgba(255,255,255,0.25)';
    end.style.opacity = ramp(t, tEnd, 0.4);
    end.style.transform = `scale(${0.9 + 0.1 * easeOutBack(clamp01((t - tEnd) / 0.4))})`;

    const c = t < tEnd ? CAPS.find((x) => t >= x.a && t < x.b) : null;
    if (c) {
      const html = c.words.map((w) => (TL.accent.includes(norm(w)) ? `<i>${w}</i>` : w)).join(' ');
      if (cap.innerHTML !== html) cap.innerHTML = html;
      cap.style.transform = `scale(${0.8 + 0.2 * easeOutBack(clamp01((t - c.a) / 0.14))})`;
      cap.style.opacity = 1;
      cap.style.top = sh.id === 'escolha' ? '1720px' : sh.id === 'mapa' || sh.id === 'peso' ? '1580px' : '1400px';
    } else cap.style.opacity = 0;
    return {};
  };
  const resize = () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  };
  resize();
  return {render, resize};
});
