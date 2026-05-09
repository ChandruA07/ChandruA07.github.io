'use strict';
// =============================================================
//  edit-lock.js  (v10)
//
//  Replaces v9's auth.js. The site is browse-as-guest by default;
//  certain "edit" actions (Solar/WTG/BOP progress, HSE add, ITC
//  sub-activity edits) ask for a shared password. POD entries do
//  NOT use this gate (POD is open to all).
//
//  Public surface (window.editLock):
//    editLock.isUnlocked()         → true if user has unlocked this tab
//    editLock.require(label, cb)   → run cb if unlocked, else prompt
//    editLock.prompt(label, cb)    → unconditionally show prompt
//    editLock.lock()               → re-lock (clears session flag)
//    editLock.onChange(handler)    → notify when locked/unlocked
//
//  Persistence: sessionStorage (cleared when tab closes — per spec).
// =============================================================

(function (global) {

  // ⚠️ Demo password. Anyone who opens DevTools can read this string.
  // It is a UX gate for management demos, NOT real security. The
  // actual write authorization lives in Realtime DB rules + anon-auth.
  const DEMO_PASSWORD = 'Site@123';

  const STORAGE_KEY = 'swppl_edit_unlocked_v10';
  const _listeners = new Set();

  function isUnlocked() {
    try { return sessionStorage.getItem(STORAGE_KEY) === '1'; }
    catch (_) { return false; }
  }

  function _setUnlocked(v) {
    try {
      if (v) sessionStorage.setItem(STORAGE_KEY, '1');
      else   sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    _listeners.forEach(fn => { try { fn(v); } catch (e) {} });
    document.documentElement.dataset.editMode = v ? '1' : '0';
    const pill = document.getElementById('edit-mode-pill');
    if (pill) {
      pill.textContent = v ? '🔓 Edit mode' : '🔒 View mode';
      pill.style.color = v ? 'var(--ok,#3ddc84)' : 'var(--t3,#7a93b0)';
    }
  }

  function lock()  { _setUnlocked(false); }

  function onChange(fn) {
    _listeners.add(fn);
    queueMicrotask(() => { try { fn(isUnlocked()); } catch(e){} });
    return () => _listeners.delete(fn);
  }

  /**
   * Run cb only if edit-mode is unlocked, otherwise prompt for the
   * shared password and run cb after a successful unlock.
   *
   * @param {string} label  short description used in the prompt UI
   * @param {function} cb   action to run when unlocked
   */
  function require(label, cb) {
    if (isUnlocked()) { cb(); return; }
    prompt(label, () => { if (isUnlocked()) cb(); });
  }

  let _pendingCb = null;

  function prompt(label, cb) {
    _pendingCb = cb;
    let modal = document.getElementById('lw');
    if (!modal) {
      console.warn('[editLock] login partial not loaded yet.');
      // Fallback: window.prompt
      const v = global.prompt('Enter edit password:');
      if (v === DEMO_PASSWORD) { _setUnlocked(true); cb && cb(); }
      else if (v !== null)     { alert('Wrong password.'); }
      return;
    }
    const t = document.getElementById('l-t');
    const s = document.getElementById('l-s');
    const e = document.getElementById('l-e');
    const u = document.getElementById('l-u');
    const p = document.getElementById('l-p');
    if (t) t.textContent = 'Edit mode';
    if (s) s.textContent = label
      ? `Password required to: ${label}`
      : 'Password required to make changes';
    if (e) e.textContent = '';
    if (u) { u.parentElement && (u.parentElement.style.display = 'none'); }
    if (p) { p.value = ''; setTimeout(() => p.focus(), 100); }
    modal.style.display = 'flex';
  }

  function _showError(msg) {
    const e = document.getElementById('l-e');
    if (e) e.textContent = '❌ ' + msg;
  }

  function _close() {
    const modal = document.getElementById('lw');
    if (modal) modal.style.display = 'none';
  }

  function submit() {
    const p = (document.getElementById('l-p') || {}).value || '';
    if (p !== DEMO_PASSWORD) {
      _showError('Wrong password. (Demo password — ask the team.)');
      return;
    }
    _setUnlocked(true);
    _close();
    const cb = _pendingCb; _pendingCb = null;
    if (cb) cb();
  }

  function cancel() {
    _close();
    _pendingCb = null;
  }

  // Initialise the doc-level data-attr so CSS can hide edit affordances
  document.documentElement.dataset.editMode = isUnlocked() ? '1' : '0';

  global.editLock = { isUnlocked, require, prompt, lock, onChange, submit, cancel };

})(window);
