/**
 * Minimal, unobtrusive toast. A single transient pill near the bottom of the
 * screen — used for "saved", "available in the app", etc. Never modal.
 */
let el = null;
let hideTimer = 0;

export function toast(message, { duration = 2200 } = {}) {
  if (!message) return;
  if (!el) {
    el = document.createElement('div');
    el.className = 'dd-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    (document.getElementById('hud') || document.body).appendChild(el);
  }
  el.textContent = message;
  // restart the enter animation
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => el && el.classList.remove('show'), duration);
}
