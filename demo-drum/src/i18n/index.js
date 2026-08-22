/**
 * DRUM TRANSLATOR — the single translation entry point for the 3D drum.
 *
 * • Reads the requested locale from the `lang` URL param (passed by the main app
 *   in openDrum3D, or set directly on the standalone page), normalizes it, and
 *   validates it against the canonical DRUM_LOCALES. Unknown/missing → 'en'.
 * • `t(key, ...params)` resolves a labelKey to the active locale, falling back to
 *   English, then to the raw key (so a missing key is loud, never a blank).
 * • `setLocale(code)` + `onLocaleChange(fn)` let the drum re-localize live when
 *   the host app's language changes (postMessage), WITHOUT restarting the draw.
 *
 * The locale is resolved BEFORE the first HUD frame (main.js calls initLocale()
 * before building the HUD), so there is never a Russian/English flash.
 */
import { DRUM_LOCALES, DRUM_STRINGS } from './strings.js';

export { DRUM_LOCALES };

const FALLBACK = 'en';
let locale = FALLBACK;
const listeners = new Set();

/** Normalize any incoming tag ('nb-NO', 'EN_us', ' No ') → a canonical drum code. */
export function normalizeLocale(value) {
  const raw = String(value || '').trim().toLowerCase().replace('_', '-');
  if (!raw) return FALLBACK;
  if (DRUM_LOCALES.includes(raw)) return raw;
  const base = raw.split('-')[0];
  // Norwegian variants (nb/nn/nb-NO) collapse to the app's 'no'.
  if (base === 'nb' || base === 'nn') return 'no';
  if (DRUM_LOCALES.includes(base)) return base;
  return FALLBACK;
}

/** Resolve the initial locale from an explicit code or the `lang` URL param. */
export function initLocale(explicit) {
  let code = explicit;
  if (code == null) {
    try { code = new URLSearchParams(location.search).get('lang'); } catch (e) { code = null; }
  }
  locale = normalizeLocale(code);
  try { document.documentElement.lang = locale; } catch (e) { /* no document */ }
  return locale;
}

export function getLocale() { return locale; }

/** Change the active locale at runtime and notify subscribers (returns true if it changed). */
export function setLocale(code) {
  const next = normalizeLocale(code);
  if (next === locale) return false;
  locale = next;
  try { document.documentElement.lang = locale; } catch (e) { /* ignore */ }
  for (const fn of listeners) { try { fn(locale); } catch (e) { /* isolate */ } }
  return true;
}

/** Subscribe to locale changes. Returns an unsubscribe function. */
export function onLocaleChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Translate a labelKey for the active locale. `params` fill {{0}}, {{1}}, … */
export function t(key, ...params) {
  const entry = DRUM_STRINGS[key];
  if (!entry) { if (typeof console !== 'undefined') console.warn('[drum-i18n] unknown key:', key); return key; }
  let s = entry[locale];
  if (s == null || s === '') s = entry[FALLBACK];
  if (s == null) s = key;
  return s.replace(/\{\{(\d+)\}\}/g, (_, i) => {
    const v = params[Number(i)];
    return v == null ? '' : String(v);
  });
}
