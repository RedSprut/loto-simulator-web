/**
 * SavePrompt — the unobtrusive "Save this combination?" panel shown a beat after a
 * draw fully completes. It is NOT a heavy centred modal and never dims the screen:
 * on phones it slides up as a compact bottom sheet, on desktop it sits as a small
 * card beside the result — the drum and the drawn balls stay fully visible.
 *
 * Lifecycle contract (once per finished draw, never during motion):
 *   • appears only on the transition INTO State.COMPLETE (balls at rest, result final);
 *   • any other state (a new draw, reset, profile switch) dismisses it and re-arms;
 *   • a second click can't create duplicates (the buttons disable on first action);
 *   • "Don't save" just closes; saving never restarts/alters the draw or physics.
 *
 * All persistence goes through the injected `store` adapter (in production this is
 * store/host-store.js, a postMessage bridge to the host app's real combination store)
 * so the same UI runs unchanged against DEMO localStorage or the production backend.
 */
import { State } from '../sim/draw.js';
import { GAME_PROFILES } from '../games.js';
import { t } from '../i18n/index.js';
import { renderChips, gameChipStyles } from './chips.js';
import { toast } from './toast.js';

const SHOW_DELAY_MS = 1400; // "1–2 seconds after" the draw settles

/** Resolve the main / additional group label keys for a lottery id. */
function poolLabelsFor(lotteryId) {
  const p = GAME_PROFILES[lotteryId];
  const groups = p?.resultLayout?.groups || [];
  return {
    mainKey: groups[0]?.labelKey || 'pool.main',
    bonusKey: groups[1]?.labelKey || 'pool.bonus',
  };
}

/** Render labelled main + additional rows into `host` (shared by prompt & list). */
export function renderCombinationRows(host, combo, { small = false } = {}) {
  const { mainKey, bonusKey } = poolLabelsFor(combo.lotteryId);
  const styles = gameChipStyles();
  const row = (labelKey, values, bonus) => {
    if (!values || !values.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'dd-combo-row';
    const label = document.createElement('span');
    label.className = 'dd-combo-row__label';
    label.textContent = t(labelKey);
    const balls = document.createElement('div');
    balls.className = 'dd-combo-row__balls';
    renderChips(balls, values, { bonus, styles, small });
    wrap.append(label, balls);
    host.appendChild(wrap);
  };
  row(mainKey, combo.main, false);
  row(bonusKey, combo.additional, true);
}

export class SavePrompt {
  constructor(root, store, { getResult, notify } = {}) {
    this.store = store;
    this.getResult = getResult;   // () → finalized combo (or null) for the current draw
    this.notify = notify || (() => {});
    this._timer = 0;
    this._current = null;
    this._busy = false;

    this.el = document.createElement('div');
    this.el.className = 'dd-save';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-live', 'polite');
    root.appendChild(this.el);
  }

  /** Drive visibility off the real draw state (wired from main's onState hook). */
  onDrawState(state) {
    if (state === State.COMPLETE) {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.present(), SHOW_DELAY_MS);
    } else {
      clearTimeout(this._timer);
      this.dismiss();
    }
  }

  present() {
    const combo = this.getResult?.();
    if (!combo || !combo.main?.length) return; // nothing final to offer
    this._current = combo;
    this._busy = false;
    this._renderAsk();
    // enter on the next frame so the slide-in transition runs
    this.el.classList.add('open');
    requestAnimationFrame(() => this.el.classList.add('show'));
  }

  dismiss() {
    this._current = null;
    this._busy = false;
    this.el.classList.remove('show');
    // let the transition finish before removing from the layout
    clearTimeout(this._closeTimer);
    this._closeTimer = setTimeout(() => this.el.classList.remove('open'), 260);
  }

  _renderAsk() {
    this.el.innerHTML = '';
    this.el.classList.remove('dd-save--limit');

    const head = document.createElement('div');
    head.className = 'dd-save__head';
    const title = document.createElement('h3');
    title.className = 'dd-save__title';
    title.textContent = t('save.title');
    const game = document.createElement('div');
    game.className = 'dd-save__game';
    game.textContent = this._current.lotteryName || '';
    head.append(title, game);

    const rows = document.createElement('div');
    rows.className = 'dd-combo';
    renderCombinationRows(rows, this._current);

    const actions = document.createElement('div');
    actions.className = 'dd-save__actions';
    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'dd-save__btn ghost';
    dismissBtn.textContent = t('save.dismiss');
    dismissBtn.onclick = () => this.dismiss();
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'dd-save__btn primary';
    saveBtn.textContent = t('save.save');
    saveBtn.onclick = () => this._onSave(saveBtn);
    actions.append(dismissBtn, saveBtn);

    this.el.append(head, rows, actions);
  }

  _onSave(btn) {
    if (this._busy) return; // no duplicate saves from a double-tap
    this._busy = true;
    if (btn) btn.disabled = true;
    if (this.store.canAdd()) {
      const res = this.store.add(this._current);
      if (res.ok) { this._afterSave(); return; }
    }
    // Free limit hit → offer replace-one or PRO (no real checkout in the demo).
    this._busy = false;
    this._renderLimit();
  }

  _afterSave() {
    toast(t('save.toast.saved'));
    this.notify();
    this.dismiss();
  }

  _renderLimit() {
    this.el.innerHTML = '';
    this.el.classList.add('dd-save--limit');

    const head = document.createElement('div');
    head.className = 'dd-save__head';
    const title = document.createElement('h3');
    title.className = 'dd-save__title';
    title.textContent = t('limit.title');
    const body = document.createElement('p');
    body.className = 'dd-save__body';
    body.textContent = t('limit.body', this.store.limit);
    head.append(title, body);

    const list = document.createElement('div');
    list.className = 'dd-save__replace';
    for (const combo of this.store.list()) {
      const rowEl = document.createElement('div');
      rowEl.className = 'dd-save__replace-row';
      const info = document.createElement('div');
      info.className = 'dd-save__replace-info';
      const name = document.createElement('span');
      name.className = 'dd-save__replace-name';
      name.textContent = combo.lotteryName || '';
      const chips = document.createElement('div');
      chips.className = 'dd-combo-row__balls';
      renderChips(chips, combo.main, { small: true });
      renderChips(chips, combo.additional, { bonus: true, small: true });
      info.append(name, chips);
      const replaceBtn = document.createElement('button');
      replaceBtn.type = 'button';
      replaceBtn.className = 'dd-save__btn tiny';
      replaceBtn.textContent = t('limit.replace');
      replaceBtn.onclick = () => {
        if (this._busy) return; this._busy = true; replaceBtn.disabled = true;
        this.store.replace(combo.id, this._current);
        this._afterSave();
      };
      rowEl.append(info, replaceBtn);
      list.appendChild(rowEl);
    }

    const actions = document.createElement('div');
    actions.className = 'dd-save__actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'dd-save__btn ghost';
    cancelBtn.textContent = t('action.cancel');
    cancelBtn.onclick = () => this.dismiss();
    const proBtn = document.createElement('button');
    proBtn.type = 'button';
    proBtn.className = 'dd-save__btn pro';
    proBtn.textContent = t('limit.pro');
    // Carry the combination the user tried to save as a pending action, so the host can
    // save it automatically once PRO is confirmed. Then close only THIS limit card.
    proBtn.onclick = () => { this.store.openPaywall?.(this._current); this.dismiss(); };
    actions.append(cancelBtn, proBtn);

    this.el.append(head, list, actions);
  }
}
