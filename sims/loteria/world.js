// Cartoon 3D helpers: toon shading in three flat steps plus an ink outline
// (inverted hull pushed along smoothed normals), so the world matches the
// 2D characters.
import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {INK} from './char.js';

const grad = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter;
grad.needsUpdate = true;

export const toon = (color, o = {}) => new THREE.MeshToonMaterial({color, gradientMap: grad, ...o});

const outlineMats = new Map();
const outlineMat = (th) => {
  if (!outlineMats.has(th)) {
    const m = new THREE.MeshBasicMaterial({color: INK, side: THREE.BackSide});
    m.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normalize(normal) * ${th.toFixed(4)};`);
    };
    m.customProgramCacheKey = () => `ink${th}`;
    outlineMats.set(th, m);
  }
  return outlineMats.get(th);
};

/** Mesh with toon material and an ink outline child. th = outline thickness in local units (0 = none). */
export function solid(geo, color, th = 0.035, matOpts) {
  const mesh = new THREE.Mesh(geo, typeof color === 'object' && color.isMaterial ? color : toon(color, matOpts));
  if (th > 0) {
    const g = geo.clone();
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    const smooth = mergeVertices(g, 1e-3);
    smooth.computeVertexNormals();
    mesh.add(new THREE.Mesh(smooth, outlineMat(th)));
  }
  return mesh;
}

export const box = (w, h, d, color, th) => solid(new THREE.BoxGeometry(w, h, d), color, th);
export const cyl = (r0, r1, h, color, seg = 10, th) => solid(new THREE.CylinderGeometry(r0, r1, h, seg), color, th);
export const ball = (r, color, detail = 1, th) => solid(new THREE.IcosahedronGeometry(r, detail), color, th);

export const at = (obj, x, y, z) => {
  obj.position.set(x, y, z);
  return obj;
};

/** Flat sign: a plane with a canvas drawn by paint(ctx, w, h). Returns {mesh, repaint}. */
export function sign(w, h, pxW, pxH, paint) {
  const cv = document.createElement('canvas');
  cv.width = pxW;
  cv.height = pxH;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: tex, toneMapped: false}));
  const repaint = (...args) => {
    paint(ctx, pxW, pxH, ...args);
    tex.needsUpdate = true;
  };
  repaint();
  return {mesh, repaint};
}

export function sky(top, bottom) {
  const cv = document.createElement('canvas');
  cv.width = 8;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function tree(h = 2.4) {
  const g = new THREE.Group();
  g.add(at(cyl(0.12, 0.16, h * 0.4, '#8a5a2b', 6), 0, h * 0.2, 0));
  g.add(at(solid(new THREE.ConeGeometry(h * 0.32, h * 0.5, 7), '#2f9e55'), 0, h * 0.55, 0));
  g.add(at(solid(new THREE.ConeGeometry(h * 0.24, h * 0.42, 7), '#3bb565'), 0, h * 0.82, 0));
  return g;
}

export function cloud(s = 1) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({color: '#ffffff'});
  [[0, 0, 0.5], [0.55, 0.05, 0.38], [-0.55, 0, 0.36], [0.2, 0.25, 0.36]].forEach(([x, y, r]) => g.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m), x, y, 0)));
  g.scale.setScalar(s);
  return g;
}

export function trophy() {
  const g = new THREE.Group();
  const gold = '#ffc93c';
  g.add(at(box(0.26, 0.07, 0.26, '#7a4a1e', 0.02), 0, 0.035, 0));
  g.add(at(cyl(0.035, 0.06, 0.16, gold, 8, 0.02), 0, 0.15, 0));
  g.add(at(cyl(0.15, 0.07, 0.22, gold, 10, 0.02), 0, 0.34, 0));
  for (const sd of [-1, 1]) {
    const h = solid(new THREE.TorusGeometry(0.07, 0.018, 5, 10), gold, 0.015);
    h.position.set(sd * 0.16, 0.35, 0);
    g.add(h);
  }
  return g;
}

/** Soft blob shadow that grounds a billboard character. */
export function blobShadow(r = 0.55) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({color: '#000000', transparent: true, opacity: 0.22, depthWrite: false}));
  m.rotation.x = -Math.PI / 2;
  m.scale.y = 0.55;
  return m;
}
