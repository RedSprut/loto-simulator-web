/**
 * Shared number-chip helpers. The result row (hud.js), the save prompt and the
 * saved-combinations list all render the same premium, legible ball chip in the
 * current lottery's colours — so the colour logic lives here once.
 */

export function hexRGB(h) {
  h = String(h || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h || '0', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade([r, g, b], f) { // f>0 lighten toward white, f<0 darken toward black
  const k = f < 0 ? 0 : 255, t = Math.abs(f);
  return `rgb(${Math.round(r + (k - r) * t)},${Math.round(g + (k - g) * t)},${Math.round(b + (k - b) * t)})`;
}

/** Radial-sheen background + contrast-picked text for a ball of colour `hex`. */
export function chipStyle(hex) {
  const rgb = hexRGB(hex);
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return {
    bg: `radial-gradient(120% 120% at 30% 25%, ${shade(rgb, 0.55)}, ${hex} 60%, ${shade(rgb, -0.4)})`,
    fg: lum > 0.62 ? '#2a1c05' : '#fff',
  };
}

/** Current per-game main/bonus ball colours read from the live theme tokens. */
export function gameChipStyles(root = document.documentElement) {
  const cs = getComputedStyle(root);
  return {
    main: chipStyle(cs.getPropertyValue('--g-ball-main').trim() || '#e9b44c'),
    bonus: chipStyle(cs.getPropertyValue('--g-ball-bonus').trim() || '#e23b4e'),
  };
}

/** Append number chips into `el`. `bonus` picks the additional-ball colour. */
export function renderChips(el, values, { bonus = false, styles = null, small = false, pop = false } = {}) {
  const s = (styles || gameChipStyles())[bonus ? 'bonus' : 'main'];
  for (const v of values) {
    const chip = document.createElement('div');
    chip.className = `dd-chip${small ? ' sm' : ''}${bonus ? ' bonus' : ''}${pop ? ' pop' : ''}`;
    chip.textContent = v;
    chip.style.background = s.bg;
    chip.style.color = s.fg;
    el.appendChild(chip);
  }
}
