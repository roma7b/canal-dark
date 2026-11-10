import {runSim} from '../kit/runtime.js';
import {clamp01, easeOutBack, easeOutCubic, lerp, smooth} from '../kit/util.js';
import TL from './timeline.json';
import WORDS_RAW from './narracao-fit-words.json';

// "Você Decide: O Túnel". Still keyframes (generated once, cheap) brought to
// life in code: slow push-in, handheld drift, lamp flicker, floating dust,
// game HUD and one-word-highlighted captions keyed to the narration timings.

const DEFAULTS = {
  duration: TL.duration,
  fps: 30,
  hud: {enabled: false, title: 'tunel', subtitle: ''},
  director: {enabled: false},
  watermark: '',
};

const frac = (x) => x - Math.floor(x);
const hash = (i, k = 0) => frac(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453);
const norm = (w) => w.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
const noise = (t, s) => Math.sin(t * 7.1 + s) * 0.5 + Math.sin(t * 13.7 + s * 2.3) * 0.3 + Math.sin(t * 29.3 + s * 4.1) * 0.2;

// captions: short phrases of up to 3 words, cut at punctuation
const CAPS = [];
{
  let cur = [];
  const flush = (end) => {
    if (!cur.length) return;
    CAPS.push({a: cur[0].a - 0.05, b: end, words: cur.map((w) => w.w.replace(/[.,…:]+$/, ''))});
    cur = [];
  };
  WORDS_RAW.forEach((w, i) => {
    cur.push(w);
    const next = WORDS_RAW[i + 1];
    if (cur.length >= 3 || /[.?!,…:]$/.test(w.w) || !next) flush(next ? next.a - 0.05 : w.b + 0.4);
  });
}

const loadImg = (src) =>
  new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });

runSim(DEFAULTS, async ({canvas}) => {
  const ctx = canvas.getContext('2d');
  const imgs = await Promise.all(TL.shots.map((s) => loadImg(s.img)));

  const app = document.getElementById('app');
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = `<div class="tag">VOCÊ DECIDE · <b>O TÚNEL</b> · EP 1</div>
    <div class="gh"><div class="money"><small>BOLADA</small><b>R$ 0</b></div><div><small>EQUIPE</small><b>4</b></div><div class="heat"><small>CALOR</small><b>0%</b></div></div>
    <div class="fic">FICÇÃO INSPIRADA EM FATOS REAIS</div><div class="cap"></div>`;
  app.appendChild(ov);
  const money = ov.querySelector('.money b');
  const cap = ov.querySelector('.cap');

  const render = (t) => {
    const W = canvas.width, H = canvas.height;
    const si = Math.max(0, TL.shots.findIndex((s) => t >= s.start && t < s.end));
    const sh = TL.shots[si], im = imgs[si];
    const k = clamp01((t - sh.start) / (sh.end - sh.start));
    ctx.fillStyle = '#05080c';
    ctx.fillRect(0, 0, W, H);
    if (im) {
      // cover-fit, then push in toward the focus point with a little handheld drift
      const z = lerp(sh.zoom[0], sh.zoom[1], smooth(k));
      const base = Math.max(W / im.width, H / im.height);
      const s = base * z;
      const fx = sh.focus[0] * im.width, fy = sh.focus[1] * im.height;
      const dx = noise(t, 1) * sh.shake * W, dy = noise(t, 7) * sh.shake * H;
      let x = W / 2 - fx * s + dx;
      let y = H / 2 - fy * s + dy;
      x = Math.min(0, Math.max(W - im.width * s, x));
      y = Math.min(0, Math.max(H - im.height * s, y));
      ctx.drawImage(im, x, y, im.width * s, im.height * s);
    }
    // lamp flicker: warm light breathing, with an occasional dip
    const dip = frac(t / 2.3) < 0.04 ? 0.5 : 0;
    const fl = sh.flicker * (0.5 + 0.5 * noise(t * 2, 3)) + dip * sh.flicker;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(0,0,0,${fl})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    // dust motes drifting through the light
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < sh.dust; i++) {
      const px = frac(hash(i, 1) + t * (0.004 + hash(i, 2) * 0.01) + 0.02 * Math.sin(t * 0.7 + i)) * W;
      const py = frac(hash(i, 3) - t * (0.006 + hash(i, 4) * 0.012)) * H;
      const r = 1.5 + hash(i, 5) * 3.5;
      const a = 0.25 + 0.35 * Math.sin(t * 2 + i) ** 2;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
      g.addColorStop(0, `rgba(255,190,120,${a})`);
      g.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - r * 3, py - r * 3, r * 6, r * 6);
    }
    ctx.globalCompositeOperation = 'source-over';
    // vignette, darker at the top for the HUD
    const v = ctx.createRadialGradient(W / 2, H * 0.58, H * 0.25, W / 2, H * 0.58, H * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    const top = ctx.createLinearGradient(0, 0, 0, H * 0.25);
    top.addColorStop(0, 'rgba(0,0,0,0.6)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, H * 0.25);

    // HUD money counts up once "toneladas" is said
    const tTon = (WORDS_RAW.find((w) => norm(w.w).startsWith('toneladas')) || {a: 3}).a;
    const m = 164.7 * easeOutCubic(clamp01((t - tTon) / 1.4));
    money.textContent = m < 0.05 ? 'R$ 0' : `R$ ${m.toFixed(1).replace('.', ',')} MI`;

    const c = CAPS.find((x) => t >= x.a && t < x.b);
    if (c) {
      const html = c.words.map((w) => (TL.accent.includes(norm(w)) ? `<i>${w}</i>` : w)).join(' ');
      if (cap.innerHTML !== html) cap.innerHTML = html;
      const p = easeOutBack(clamp01((t - c.a) / 0.14));
      cap.style.transform = `scale(${0.8 + 0.2 * p})`;
      cap.style.opacity = 1;
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
