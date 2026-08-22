/**
 * Paints a lottery-ball texture on a 2:1 equirectangular canvas. The number is
 * printed on four ivory equator medallions. The two pole medallions are curved
 * decal meshes in scene/balls.js; painting them into this equirectangular map
 * would pinch the circles into wedges at the UV singularities.
 */
import * as THREE from 'three';

const CACHE = new Map();
const STICKER_CACHE = new Map();

function hex(n) { return `#${(n >>> 0).toString(16).padStart(6, '0').slice(-6)}`; }

function medallion(g, cx, cy, r, label) {
  // Ivory disc.
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = '#f7f0dd'; g.fill();
  // Dark ring.
  g.lineWidth = r * 0.11; g.strokeStyle = '#2a2b31'; g.stroke();
  // Digit.
  g.fillStyle = '#18191d';
  g.font = `700 ${Math.round(r * 1.05)}px "Helvetica Neue", Arial, system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, cx, cy + r * 0.04);
}

export function numberStickerTexture(value) {
  const label = String(value);
  if (STICKER_CACHE.has(label)) return STICKER_CACHE.get(label);

  const S = 256;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  medallion(g, S * 0.5, S * 0.5, S * 0.45, label);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  STICKER_CACHE.set(label, tex);
  return tex;
}

export function ballTexture(value, color) {
  const key = `${value}:${color}`;
  if (CACHE.has(key)) return CACHE.get(key);

  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  // Base coat: the ball colour with a subtle vertical shade for volume.
  const base = new THREE.Color(color);
  const dark = base.clone().multiplyScalar(0.72);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, hex(dark.getHex()));
  grad.addColorStop(0.5, hex(base.getHex()));
  grad.addColorStop(1, hex(dark.getHex()));
  g.fillStyle = grad; g.fillRect(0, 0, W, H);

  const label = String(value);
  const rEq = H * 0.17;
  // Four equatorial medallions (v = 0.5), 90 degrees apart, avoiding the u=0 seam.
  // The required top/bottom medallions are separate spherical decals, so they stay
  // round instead of being crushed by this texture's pole singularities.
  for (const u of [0.125, 0.375, 0.625, 0.875]) medallion(g, u * W, H * 0.5, rEq, label);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  CACHE.set(key, tex);
  return tex;
}
