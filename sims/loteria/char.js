// 2D cutout characters drawn with canvas, shown as billboards in the 3D world.
// Channel look: squircle head, thick ink outline, flat colours. draw(state) is
// pure: the same state always gives the same picture.

export const INK = '#1d1b2e';
const W = 512, H = 768, CX = 256, FEET = 745;
const rad = (d) => (d * Math.PI) / 180;

export const LOOKS = {
  mandel: {skin: '#f2c9a0', cloth: '#3f5fa8', pants: '#2b2d42', shoe: '#5a3a22', hair: '#3a2a20', outfit: 'suit', hairStyle: 'side', glasses: true},
  viewer: {skin: '#c98a5e', cloth: '#f08a24', pants: '#3b4a6b', shoe: '#f4f4f4', hair: '#1f1a17', outfit: 'hoodie', hairStyle: 'curly', glasses: false},
  traveler: {skin: '#d9a07a', cloth: '#2b40d3', pants: '#0e1030', shoe: '#f4f4f4', hair: '#2a1d16', outfit: 'hoodie', hairStyle: 'curly', glasses: false},
  helper: {skin: '#e8b48a', cloth: '#3aa76d', pants: '#2b2d42', shoe: '#5a3a22', hair: '#7a4a1e', outfit: 'tee', hairStyle: 'curly', glasses: false},
};

export function createChar(THREE, lookName) {
  const L = LOOKS[lookName];
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d');
  // THREE = null gives a plain 2D canvas character (for 2D motion graphics)
  let tex = null, mesh = null;
  if (THREE) {
    tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(4 / 3, 2);
    geo.translate(0, 1 - (2 * (H - FEET)) / H, 0); // feet on y = 0
    mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false}));
  }

  const limb = (pts, color, w) => {
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const [col, lw] of [[INK, w + 14], [color, w]]) {
      c.strokeStyle = col;
      c.lineWidth = lw;
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
      c.stroke();
    }
  };
  const blob = (x, y, rx, ry, fill, lw = 8) => {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    if (lw) {
      c.lineWidth = lw;
      c.strokeStyle = INK;
      c.stroke();
    }
  };

  const arm = (side, a1, a2, prop) => {
    const S = [CX + side * 74, 372];
    const E = [S[0] + side * 84 * Math.sin(rad(a1)), S[1] + 84 * Math.cos(rad(a1))];
    const Hn = [E[0] + side * 84 * Math.sin(rad(a2)), E[1] + 84 * Math.cos(rad(a2))];
    limb([S, E, Hn], L.cloth, 26);
    if (prop === 'ticket') {
      c.save();
      c.translate(Hn[0] + side * 8, Hn[1] - 26);
      c.rotate(side * 0.25);
      c.fillStyle = '#fff3b0';
      c.strokeStyle = INK;
      c.lineWidth = 7;
      c.beginPath();
      c.roundRect(-40, -26, 80, 52, 8);
      c.fill();
      c.stroke();
      c.fillStyle = '#e63946';
      c.fillRect(-28, -14, 56, 9);
      c.fillStyle = INK;
      c.fillRect(-28, 2, 40, 6);
      c.restore();
    }
    if (prop === 'marker') {
      c.save();
      c.translate(Hn[0], Hn[1]);
      c.rotate(side * rad(a2) + Math.PI);
      c.fillStyle = '#e63946';
      c.strokeStyle = INK;
      c.lineWidth = 6;
      c.beginPath();
      c.roundRect(-9, -70, 18, 70, 6);
      c.fill();
      c.stroke();
      c.restore();
    }
    if (prop === 'bag') {
      blob(Hn[0], Hn[1] + 58, 52, 50, '#e9b949');
      c.fillStyle = '#e9b949';
      c.strokeStyle = INK;
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(Hn[0] - 18, Hn[1] + 12);
      c.lineTo(Hn[0] + 18, Hn[1] + 12);
      c.lineTo(Hn[0] + 10, Hn[1] - 4);
      c.lineTo(Hn[0] - 10, Hn[1] - 4);
      c.closePath();
      c.fill();
      c.stroke();
      c.font = '900 52px Inter';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#2f7d32';
      c.fillText('$', Hn[0], Hn[1] + 62);
    }
    if (prop === 'stack') {
      for (let i = 0; i < 5; i++) {
        c.fillStyle = i % 2 ? '#fff3b0' : '#ffe58a';
        c.strokeStyle = INK;
        c.lineWidth = 5;
        c.beginPath();
        c.roundRect(Hn[0] - 46 + (i % 2) * 6, Hn[1] - 30 - i * 16, 92, 20, 4);
        c.fill();
        c.stroke();
      }
    }
    blob(Hn[0], Hn[1], 21, 21, L.skin);
  };

  const face = (s, hx, hy) => {
    const e = s.expr || 'neutral';
    const lx = (s.lookX || 0) * 12, ly = (s.lookY || 0) * 7;
    const ex = 50, ey = hy - 4 + ly;
    // eyes
    for (const sd of [-1, 1]) {
      const x = hx + sd * ex + lx;
      if (s.blink) {
        c.strokeStyle = INK;
        c.lineWidth = 8;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x - 14, ey);
        c.lineTo(x + 14, ey);
        c.stroke();
      } else if (e === 'shock') {
        blob(x, ey, 27, 30, '#ffffff', 7);
        blob(x + lx * 0.3, ey, 9, 10, INK, 0);
      } else if (e === 'grin' || e === 'smug') {
        // happy closed arcs
        c.strokeStyle = INK;
        c.lineWidth = 9;
        c.lineCap = 'round';
        c.beginPath();
        if (e === 'smug' && sd === 1) {
          c.ellipse(x, ey, 12, 16, 0, 0, Math.PI * 2);
          c.fillStyle = INK;
          c.fill();
        } else {
          c.arc(x, ey + 10, 18, Math.PI * 1.12, Math.PI * 1.88);
          c.stroke();
        }
      } else {
        blob(x, ey, 12, 16, INK, 0);
        blob(x + 4, ey - 6, 4, 4, '#ffffff', 0);
      }
    }
    if (L.glasses) {
      c.strokeStyle = INK;
      c.lineWidth = 7;
      for (const sd of [-1, 1]) {
        c.beginPath();
        c.roundRect(hx + sd * ex + lx - 36, ey - 30, 72, 60, 22);
        c.fillStyle = 'rgba(255,255,255,0.28)';
        c.fill();
        c.stroke();
      }
      c.beginPath();
      c.moveTo(hx + lx - 14, ey - 4);
      c.lineTo(hx + lx + 14, ey - 4);
      c.stroke();
    }
    // brows: [inner dy, outer dy] per side
    const B = {neutral: [0, 0, 0, 0], grin: [-8, -4, -8, -4], smug: [6, -2, -12, -8], shock: [-18, -16, -18, -16], worried: [-14, 2, -14, 2], think: [4, 0, -14, -10], angry: [8, -8, 8, -8]}[e] || [0, 0, 0, 0];
    c.strokeStyle = L.hair;
    c.lineWidth = 10;
    c.lineCap = 'round';
    [[-1, B[0], B[1]], [1, B[2], B[3]]].forEach(([sd, din, dout]) => {
      const by = ey - (L.glasses ? 48 : 36);
      c.beginPath();
      c.moveTo(hx + sd * 26 + lx, by + din);
      c.lineTo(hx + sd * 74 + lx, by + dout);
      c.stroke();
    });
    // mouth
    const mx = hx + lx * 0.6, my = hy + 56 + ly * 0.5;
    c.strokeStyle = INK;
    c.lineWidth = 8;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (e === 'grin') {
      c.beginPath();
      c.moveTo(mx - 50, my - 12);
      c.lineTo(mx + 50, my - 12);
      c.quadraticCurveTo(mx + 46, my + 44, mx, my + 44);
      c.quadraticCurveTo(mx - 46, my + 44, mx - 50, my - 12);
      c.closePath();
      c.fillStyle = '#7a1f2b';
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = '#ffffff';
      c.fillRect(mx - 60, my - 14, 120, 18);
      c.fillStyle = '#e8707e';
      c.beginPath();
      c.ellipse(mx, my + 46, 28, 16, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
      c.stroke();
    } else if (e === 'shock') {
      blob(mx, my + 10, 20, 28, '#7a1f2b', 8);
    } else if (e === 'smug') {
      c.beginPath();
      c.moveTo(mx - 30, my + 6);
      c.quadraticCurveTo(mx + 10, my + 22, mx + 40, my - 10);
      c.stroke();
    } else if (e === 'worried') {
      c.beginPath();
      c.moveTo(mx - 34, my + 14);
      c.quadraticCurveTo(mx - 17, my - 4, mx, my + 10);
      c.quadraticCurveTo(mx + 17, my + 24, mx + 34, my + 6);
      c.stroke();
    } else if (e === 'think') {
      c.beginPath();
      c.moveTo(mx - 18, my + 10);
      c.lineTo(mx + 26, my + 4);
      c.stroke();
    } else if (e === 'angry') {
      c.beginPath();
      c.moveTo(mx - 30, my + 16);
      c.quadraticCurveTo(mx, my - 6, mx + 30, my + 16);
      c.stroke();
    } else {
      c.beginPath();
      c.moveTo(mx - 26, my + 4);
      c.quadraticCurveTo(mx, my + 20, mx + 26, my + 4);
      c.stroke();
    }
    if (e === 'grin') {
      c.globalAlpha = 0.35;
      blob(hx - 84 + lx, hy + 34, 18, 12, '#ff6b81', 0);
      blob(hx + 84 + lx, hy + 34, 18, 12, '#ff6b81', 0);
      c.globalAlpha = 1;
    }
    if (e === 'worried' || s.sweat) {
      c.fillStyle = '#7fd4ff';
      c.strokeStyle = INK;
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(hx + 104, hy - 62);
      c.quadraticCurveTo(hx + 126, hy - 22, hx + 104, hy - 16);
      c.quadraticCurveTo(hx + 84, hy - 22, hx + 104, hy - 62);
      c.fill();
      c.stroke();
    }
  };

  const draw = (s = {}) => {
    c.clearRect(0, 0, W, H);
    c.save();
    // squash and lean around the feet
    c.translate(CX, FEET);
    c.rotate(rad(s.lean || 0));
    c.scale(1 / (1 + (s.squash || 0)), 1 + (s.squash || 0));
    c.translate(-CX, -FEET);

    // legs
    const st = s.stance ?? 0;
    const sw = s.walk != null ? Math.sin(s.walk) : 0;
    for (const sd of [-1, 1]) {
      const foot = [CX + sd * (44 + st) + sw * sd * 10, 722 - Math.max(0, sd * sw) * 46];
      limb([[CX + sd * 36, 560], foot], L.pants, 28);
      blob(foot[0] + sd * 10, foot[1] + 8, 32, 15, L.shoe, 8);
    }
    // neck
    c.fillStyle = L.skin;
    c.strokeStyle = INK;
    c.lineWidth = 8;
    c.beginPath();
    c.rect(CX - 20, 296, 40, 60);
    c.fill();
    c.stroke();
    // torso
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(CX - 78, 348);
    c.lineTo(CX + 78, 348);
    c.lineTo(CX + 88, 578);
    c.lineTo(CX - 88, 578);
    c.closePath();
    c.fillStyle = L.cloth;
    c.fill();
    c.lineWidth = 10;
    c.strokeStyle = INK;
    c.stroke();
    if (L.outfit === 'suit') {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(CX - 34, 350);
      c.lineTo(CX + 34, 350);
      c.lineTo(CX, 440);
      c.closePath();
      c.fill();
      c.lineWidth = 7;
      c.stroke();
      c.fillStyle = '#e63946';
      c.beginPath();
      c.moveTo(CX - 12, 356);
      c.lineTo(CX + 12, 356);
      c.lineTo(CX + 16, 430);
      c.lineTo(CX, 452);
      c.lineTo(CX - 16, 430);
      c.closePath();
      c.fill();
      c.stroke();
    } else if (L.outfit === 'hoodie') {
      c.lineWidth = 7;
      c.beginPath();
      c.roundRect(CX - 50, 478, 100, 60, 14);
      c.stroke();
      c.beginPath();
      c.moveTo(CX - 14, 352);
      c.lineTo(CX - 18, 410);
      c.moveTo(CX + 14, 352);
      c.lineTo(CX + 18, 410);
      c.stroke();
    }
    // arms
    const aL = s.armL || [12, 6], aR = s.armR || [12, 6];
    arm(-1, aL[0], aL[1], s.propL);
    arm(1, aR[0], aR[1], s.propR);

    // head
    const hx = CX + (s.lookX || 0) * 5, hy = 200 + (s.headY || 0);
    blob(hx - 120, hy + 6, 16, 22, L.skin);
    blob(hx + 120, hy + 6, 16, 22, L.skin);
    if (L.hairStyle === 'curly') for (let i = 0; i < 7; i++) blob(hx - 96 + i * 32, hy - 100 + Math.abs(i - 3) * 9, 30, 30, L.hair);
    c.beginPath();
    c.roundRect(hx - 118, hy - 106, 236, 212, 82);
    c.fillStyle = L.skin;
    c.fill();
    if (L.hairStyle === 'side') {
      c.save();
      c.clip();
      c.fillStyle = L.hair;
      c.beginPath();
      c.moveTo(hx - 130, hy - 120);
      c.lineTo(hx + 130, hy - 120);
      c.lineTo(hx + 130, hy - 50);
      c.quadraticCurveTo(hx + 40, hy - 78, hx - 30, hy - 40);
      c.quadraticCurveTo(hx - 90, hy - 30, hx - 130, hy - 40);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.beginPath();
    c.roundRect(hx - 118, hy - 106, 236, 212, 82);
    c.lineWidth = 10;
    c.strokeStyle = INK;
    c.stroke();
    face(s, hx, hy);
    c.restore();
    if (tex) tex.needsUpdate = true;
  };

  draw();
  return {mesh, draw, canvas: cv};
}
