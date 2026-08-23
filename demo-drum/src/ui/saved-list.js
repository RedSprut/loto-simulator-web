/**
 * SavedList — the "Saved combinations" panel INSIDE the 3D drum (bookmark button +
 * count badge + side panel + cards + internal scroll + close + per-card actions).
 *
 * PRODUCTION wiring: data comes from the host app's real combination store via the
 * host-store postMessage bridge (never a separate DEMO localStorage). One shared list:
 * a save in the drum appears here immediately; a delete here removes from the real
 * store and the main screen; a change on the main screen pushes a fresh snapshot here.
 *
 * The three per-card actions call the REAL production engines (no DEMO stubs):
 *   • Supreme Judge   → host window.judgeGeneratedRows (server-authoritative budget)
 *   • Model consensus → host CONS_run (the app's own Consensus)
 *   • Delete          → real removal from the store (with a confirm step)
 *
 * Large PRO lists (100s of combinations) render in chunks (IntersectionObserver) so the
 * panel scrolls internally without stretching the page or freezing the UI.
 */
import { t, onLocaleChange, getLocale } from '../i18n/index.js';
import { renderCombinationRows } from './save-prompt.js';
import { toast } from './toast.js';
import { GAME_PROFILES, poolsOf } from '../games.js';

const CHUNK = 30; // incremental render size for big lists

function schemaForProfile(profile) {
  if (!profile) return '';
  const pools = poolsOf(profile);
  return profile.drawOrder.map((poolId) => {
    const pool = pools[poolId] || {};
    return [poolId, pool.min, pool.max, pool.drawCount, pool.strategy || 'main'].join(':');
  }).join('|');
}

function schemaForCombo(combo) {
  const id = combo?.gameKey || combo?.lotteryId || '';
  const profile = GAME_PROFILES[id];
  if (profile) return schemaForProfile(profile);
  return `saved:${Array.isArray(combo?.main) ? combo.main.length : 0}:${Array.isArray(combo?.additional) ? combo.additional.length : 0}`;
}

export class SavedList {
  constructor(root, store, { analysis = {}, getCurrentLottery = () => null, onBulkApply = null } = {}) {
    this.store = store;
    this.analysis = analysis; // { supremeJudge(combo), consensus(combo) }
    this.getCurrentLottery = getCurrentLottery; // () → current drum game id (for "select all")
    this.onBulkApply = onBulkApply;             // (lotteryId, combos[]) → transfer to main screen
    this.selected = new Map();                  // id → combo (persists across chunked re-renders)
    this._selGroup = null;                      // one stable lottery/schema per bulk transfer

    // Opener button (top-left; the top-right corner holds sound + settings). The
    // production back button stays at the very top-left of the overlay; CSS seats this
    // just below it so both are visible and never overlap.
    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.className = 'dd-saved-btn';
    this.btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 3h12a1 1 0 0 1 1 1v16l-7-4-7 4V4a1 1 0 0 1 1-1z"/>
      </svg><span class="dd-saved-badge" hidden>0</span>`;
    this.badge = this.btn.querySelector('.dd-saved-badge');

    this.panel = document.createElement('div');
    this.panel.className = 'dd-saved hidden';
    this.panel.innerHTML = `
      <div class="dd-saved__head">
        <h3 class="dd-saved__title"></h3>
        <button class="dd-close" type="button" data-close>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6 18 18M18 6 6 18"/></svg>
        </button>
      </div>
      <div class="dd-saved__seltoolbar">
        <button class="dd-saved__tool" type="button" data-selall></button>
        <button class="dd-saved__tool" type="button" data-selclear></button>
        <span class="dd-saved__selcount" data-selcount aria-live="polite"></span>
      </div>
      <div class="dd-saved__list"></div>
      <div class="dd-saved__actionbar">
        <button class="dd-saved__apply" type="button" data-apply disabled></button>
      </div>`;
    this.listEl = this.panel.querySelector('.dd-saved__list');
    this.selCountEl = this.panel.querySelector('[data-selcount]');
    this.applyBtn = this.panel.querySelector('[data-apply]');

    this.btn.onclick = () => this._toggle();
    this.panel.querySelector('[data-close]').onclick = () => this._close();
    this.panel.querySelector('[data-selall]').onclick = () => this._selectAllCurrent();
    this.panel.querySelector('[data-selclear]').onclick = () => this._clearSelection();
    this.applyBtn.onclick = () => this._bulkApply();

    root.append(this.btn, this.panel);
    this._applyStrings();
    this._unlisten = onLocaleChange(() => { this._applyStrings(); if (!this.panel.classList.contains('hidden')) this._renderList(); });
    // Live sync: the host pushes a fresh snapshot after any change (save/delete/main-screen).
    this.store.onChange?.(() => this.refresh());
    this.refresh();
  }

  _applyStrings() {
    this.panel.querySelector('.dd-saved__title').textContent = t('saved.title');
    this.panel.querySelector('[data-close]').setAttribute('aria-label', t('settings.close'));
    this.panel.querySelector('[data-selall]').textContent = t('bulk.selectAll');
    this.panel.querySelector('[data-selclear]').textContent = t('bulk.clear');
    this.btn.setAttribute('aria-label', t('saved.title'));
    this.btn.setAttribute('title', t('saved.title'));
    this._updateSelBar();
  }

  /** Update the "Selected: N" counter + the pinned "Add to home (N)" button. */
  _updateSelBar() {
    const n = this.selected.size;
    const game = this._selGroup?.name || '';
    if (this.selCountEl) this.selCountEl.textContent = game ? t('bulk.selectedFor', n, game) : t('bulk.selected', n);
    if (this.applyBtn) { this.applyBtn.textContent = t('bulk.addToHome', n); this.applyBtn.disabled = n === 0; }
  }

  _isSelected(combo) { return this.selected.has(combo.id); }

  _identity(combo) {
    const lotteryId = String(combo?.gameKey || combo?.lotteryId || '');
    const profile = GAME_PROFILES[lotteryId] || null;
    return {
      lotteryId,
      schema: schemaForCombo(combo),
      name: combo?.lotteryName || profile?.name || profile?.label || lotteryId,
    };
  }

  _identityForLottery(lotteryId) {
    const profile = GAME_PROFILES[lotteryId] || null;
    return {
      lotteryId: String(lotteryId || ''),
      schema: schemaForProfile(profile),
      name: profile?.name || profile?.label || String(lotteryId || ''),
    };
  }

  _sameGroup(a, b) {
    return !!(a && b && a.lotteryId && b.lotteryId && a.lotteryId === b.lotteryId && a.schema === b.schema);
  }

  _isUnavailable(combo) {
    return !!(this._selGroup && !this._isSelected(combo) && !this._sameGroup(this._identity(combo), this._selGroup));
  }

  _explainUnavailable(combo) {
    const incoming = this._identity(combo);
    if (this._selGroup && !this._sameGroup(incoming, this._selGroup)) toast(t('bulk.incompatibleLottery', incoming.name, this._selGroup.name));
  }

  /** Toggle one combination; a bulk transfer is limited to ONE lottery at a time. */
  _toggleSelect(combo, checkboxEl) {
    if (this._isSelected(combo)) {
      this.selected.delete(combo.id);
      if (!this.selected.size) this._selGroup = null;
    } else {
      const incoming = this._identity(combo);
      if (this.selected.size && this._selGroup && !this._sameGroup(incoming, this._selGroup)) {
        if (checkboxEl) checkboxEl.checked = false;
        this._explainUnavailable(combo);
        return;
      }
      this.selected.set(combo.id, combo);
      this._selGroup = incoming;
    }
    if (checkboxEl) checkboxEl.checked = this._isSelected(combo);
    this._syncCheckboxes();
    this._updateSelBar();
  }

  _selectAllCurrent() {
    const list = this.store.list();
    let group = this._selGroup;
    if (!group) {
      const current = this.getCurrentLottery?.();
      group = current ? this._identityForLottery(current) : this._identity(list[0] || {});
    }
    if (!group?.lotteryId) return;
    const before = this.selected.size;
    for (const c of list) {
      const identity = this._identity(c);
      if (this._sameGroup(identity, group)) this.selected.set(c.id, c);
    }
    if (!this._selGroup && this.selected.size > before) this._selGroup = group;
    if (!this.selected.size) this._selGroup = null;
    this._syncCheckboxes();
    this._updateSelBar();
  }

  _clearSelection() {
    this.selected.clear(); this._selGroup = null;
    this._syncCheckboxes();
    this._updateSelBar();
  }

  _syncCheckboxes() {
    const byId = new Map(this.store.list().map((combo) => [combo.id, combo]));
    this.listEl.querySelectorAll('.dd-saved__check').forEach((cb) => {
      const combo = byId.get(cb.dataset.id);
      const unavailable = combo ? this._isUnavailable(combo) : false;
      cb.checked = this.selected.has(cb.dataset.id);
      cb.setAttribute('aria-disabled', unavailable ? 'true' : 'false');
      cb.closest('.dd-saved__item')?.classList.toggle('is-unavailable', unavailable);
    });
  }

  /** Transfer the selected combinations to the main screen's top working rows. */
  _bulkApply() {
    if (!this.selected.size || !this.onBulkApply) return;
    // Preserve the on-screen order (newest-first, as listed).
    const ids = new Set(this.selected.keys());
    const combos = this.store.list().filter((c) => ids.has(c.id));
    const lotteryId = this._selGroup?.lotteryId || combos[0]?.lotteryId || '';
    // Pre-localized templates with a %N% placeholder the host fills with the ACTUAL
    // applied count (the host owns the real row cap), so feedback stays in the user's
    // language without the host needing the drum's i18n.
    this.onBulkApply(lotteryId, combos, { addedTpl: t('bulk.added', '%N%'), limitTpl: t('bulk.rowLimit', '%N%') });
    this._clearSelection();
    this._close(); // panel + host handle switching to the Simulator screen
  }

  /** Refresh the count badge (and re-render the list if it's open). */
  refresh() {
    const n = this.store.count();
    this.badge.textContent = n > 99 ? '99+' : String(n);
    this.badge.hidden = n === 0;
    // Drop any selected combinations that no longer exist (e.g. deleted elsewhere).
    const live = new Set(this.store.list().map((c) => c.id));
    for (const id of [...this.selected.keys()]) if (!live.has(id)) this.selected.delete(id);
    if (!this.selected.size) this._selGroup = null;
    this._updateSelBar();
    if (!this.panel.classList.contains('hidden')) this._renderList();
  }

  _fmtDate(iso) {
    try { return new Date(iso).toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }); }
    catch (e) { return iso || ''; }
  }

  _renderList() {
    if (this._io) { this._io.disconnect(); this._io = null; }
    this.listEl.innerHTML = '';
    this._items = this.store.list();
    this._rendered = 0;
    if (!this._items.length) {
      const empty = document.createElement('p');
      empty.className = 'dd-saved__empty';
      empty.textContent = t('saved.empty');
      this.listEl.appendChild(empty);
      return;
    }
    this._renderChunk();
  }

  /** Render the next CHUNK of items; add a sentinel that loads more on scroll. */
  _renderChunk() {
    const frag = document.createDocumentFragment();
    const end = Math.min(this._rendered + CHUNK, this._items.length);
    for (let i = this._rendered; i < end; i++) frag.appendChild(this._card(this._items[i]));
    this.listEl.appendChild(frag);
    this._rendered = end;
    if (this._rendered < this._items.length) {
      const sentinel = document.createElement('div');
      sentinel.className = 'dd-saved__sentinel';
      this.listEl.appendChild(sentinel);
      this._io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) { this._io.disconnect(); this._io = null; sentinel.remove(); this._renderChunk(); }
      }, { root: this.listEl, rootMargin: '240px' });
      this._io.observe(sentinel);
    }
  }

  _card(combo) {
    const card = document.createElement('div');
    card.className = 'dd-saved__item';
    const unavailable = this._isUnavailable(combo);
    card.classList.toggle('is-unavailable', unavailable);
    card.onclick = (e) => {
      if (this._isUnavailable(combo) && !e.target.closest('.dd-saved__actions')) this._explainUnavailable(combo);
    };

    // Selection checkbox (state persists across chunked re-renders via this.selected).
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'dd-saved__check';
    check.dataset.id = combo.id;
    check.checked = this._isSelected(combo);
    check.setAttribute('aria-label', combo.lotteryName || t('saved.title'));
    check.setAttribute('aria-disabled', unavailable ? 'true' : 'false');
    check.onclick = (e) => { e.stopPropagation(); this._toggleSelect(combo, check); };
    card.appendChild(check);

    const body = document.createElement('div');
    body.className = 'dd-saved__body';

    const meta = document.createElement('div');
    meta.className = 'dd-saved__meta';
    const name = document.createElement('span');
    name.className = 'dd-saved__name';
    name.textContent = combo.lotteryName || '';
    const sub = document.createElement('span');
    sub.className = 'dd-saved__sub';
    sub.textContent = `${t('saved.source')} · ${this._fmtDate(combo.date)}`;
    meta.append(name, sub);

    const rows = document.createElement('div');
    rows.className = 'dd-combo';
    renderCombinationRows(rows, combo, { small: true });

    const actions = document.createElement('div');
    actions.className = 'dd-saved__actions';
    actions.append(
      this._actionBtn('saved.supreme', () => this._runAnalysis('supremeJudge', combo)),
      this._actionBtn('saved.consensus', () => this._runAnalysis('consensus', combo)),
      this._deleteBtn(combo),
    );

    body.append(meta, rows, actions);
    card.appendChild(body);
    return card;
  }

  _actionBtn(labelKey, onClick, variant = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `dd-saved__act${variant ? ' ' + variant : ''}`;
    b.textContent = t(labelKey);
    b.onclick = onClick;
    return b;
  }

  /** Delete through the host app's shared confirmation modal. */
  _deleteBtn(combo) {
    const b = this._actionBtn('saved.delete', null, 'danger');
    b.onclick = () => {
      this.store.remove(combo.id); // real removal only after host confirms; host pushes a fresh snapshot
    };
    return b;
  }

  /** Bind to the REAL production engines via the host bridge (never DEMO stubs). */
  _runAnalysis(kind, combo) {
    const fn = this.analysis?.[kind];
    if (typeof fn === 'function') { fn(combo); return; }
    toast(t('analysis.pending'));
  }

  _toggle() { if (this.panel.classList.contains('hidden')) this._open(); else this._close(); }
  _open() {
    this._renderList();
    this.panel.classList.remove('hidden');
    try { history.pushState({ ddSaved: 1 }, ''); } catch (e) {}
    this._pop = () => { if (!this.panel.classList.contains('hidden')) this._close(true); };
    window.addEventListener('popstate', this._pop);
    this._esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); this._close(); } };
    document.addEventListener('keydown', this._esc);
  }
  _close(fromPop) {
    if (this.panel.classList.contains('hidden')) return;
    this.panel.classList.add('hidden');
    if (this._io) { this._io.disconnect(); this._io = null; }
    if (this._esc) { document.removeEventListener('keydown', this._esc); this._esc = null; }
    if (this._pop) {
      window.removeEventListener('popstate', this._pop); this._pop = null;
      if (!fromPop) { try { if (history.state && history.state.ddSaved) history.back(); } catch (e) {} }
    }
    try { this.btn.focus(); } catch (e) {}
  }

  destroy() { this._unlisten?.(); if (this._io) this._io.disconnect(); }
}
