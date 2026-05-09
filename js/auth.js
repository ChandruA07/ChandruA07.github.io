'use strict';
// =============================================================
//  auth.js — DEMO BUILD
//
//  ⚠️  THIS IS NOT REAL SECURITY.
//
//  This file implements a *client-side* edit gate using a
//  hardcoded password. Anyone with browser DevTools can bypass
//  it in seconds. The Firebase database itself is configured
//  for public read AND write (see security/rules.json) so any
//  visitor can write to it. This is fine for a controlled demo
//  but MUST NOT be used for any production data.
//
//  The "real" auth surface (auth.canEdit, auth.requireRole,
//  auth.current, auth.login, auth.logout) is preserved with the
//  same names, so renderers that already call auth.canEdit('wtg')
//  keep working without any changes.
//
//  Behaviour:
//    • Page loads → no login screen, view-only by default.
//    • POD form → editable without unlock.
//    • Solar/WTG/BOP/Land edits → prompt for the demo password.
//    • Once unlocked, the tab stays unlocked for its lifetime
//      (sessionStorage). New tab = re-enter password.
// =============================================================

(function (global) {

  // -----------------------------------------------------------
  // Demo credentials. Change these in one place if you need to
  // distribute a different password to the team.
  // -----------------------------------------------------------
  const DEMO_USER = 'site_user';
  const DEMO_PASS = 'Site@123';
  const DEMO_NAME = 'Site Engineer';

  const SS_KEY = 'swppl_demo_unlocked_v1';

  let _unlockedRole = null;       // null | 'admin'   ('admin' = full edit access)
  let _displayName  = null;       // 'Site Engineer' once unlocked
  const _listeners  = new Set();

  function _restore() {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && obj.role) {
        _unlockedRole = obj.role;
        _displayName  = obj.name || DEMO_NAME;
      }
    } catch (e) { /* ignore */ }
  }
  _restore();

  function _persist() {
    try {
      if (_unlockedRole) {
        sessionStorage.setItem(SS_KEY, JSON.stringify({ role: _unlockedRole, name: _displayName }));
      } else {
        sessionStorage.removeItem(SS_KEY);
      }
    } catch (e) { /* ignore */ }
  }

  function _notify() {
    const profile = current();
    _listeners.forEach(fn => { try { fn(profile); } catch(e) {} });
  }

  // -----------------------------------------------------------
  // Public surface
  // -----------------------------------------------------------

  /**
   * Returns the "current user" — null if not unlocked, or
   * { uid: 'demo', name, role: 'admin' } if unlocked.
   * Same shape renderers used to expect from Firebase Auth.
   */
  function current() {
    if (!_unlockedRole) return null;
    return { uid: 'demo', name: _displayName || DEMO_NAME, role: _unlockedRole };
  }

  /**
   * Subscribe to lock/unlock state changes. Fires immediately
   * with the current state.
   */
  function onChange(fn) {
    _listeners.add(fn);
    queueMicrotask(() => { try { fn(current()); } catch(e){} });
    return () => _listeners.delete(fn);
  }

  /**
   * canEdit(section) — used by renderers to gate buttons / inputs.
   * Returns true if the tab is unlocked. Section name is ignored
   * (single-role demo) but accepted for API compatibility.
   */
  function canEdit(/* section */) {
    return _unlockedRole === 'admin';
  }

  /**
   * Login attempt. Throws on bad credentials. On success,
   * unlocks the tab and notifies subscribers.
   */
  async function login(user, pass) {
    user = String(user || '').trim();
    pass = String(pass || '');
    if (user === DEMO_USER && pass === DEMO_PASS) {
      _unlockedRole = 'admin';
      _displayName  = DEMO_NAME;
      _persist();
      _notify();
      console.log('[auth] demo unlocked');
      return current();
    }
    throw new Error('Wrong username or password.');
  }

  async function logout() {
    _unlockedRole = null;
    _displayName  = null;
    _persist();
    _notify();
    console.log('[auth] demo locked');
  }

  /**
   * requireRole(rolesIgnored, cb)
   *
   * Used by edit buttons. If the tab is already unlocked, runs cb()
   * immediately. Otherwise opens the password modal; runs cb() if
   * the user enters the correct password.
   *
   * The role parameter is accepted but ignored — single-role demo.
   */
  function requireRole(_rolesIgnored, cb) {
    if (canEdit()) { cb(); return; }
    _openLoginModal({
      after: () => { if (canEdit()) cb(); }
    });
  }

  // -----------------------------------------------------------
  // Login modal
  // -----------------------------------------------------------
  let _pendingAfter = null;

  function _openLoginModal(opts) {
    _pendingAfter = (opts && opts.after) || null;
    const modal = document.getElementById('lw');
    if (!modal) {
      // Fallback to a native prompt if the modal isn't loaded yet.
      const u = window.prompt('Username:'); if (u === null) return;
      const p = window.prompt('Password:'); if (p === null) return;
      login(u, p)
        .then(() => { if (_pendingAfter) _pendingAfter(); })
        .catch(e => alert(e.message || 'Login failed'));
      return;
    }
    const t = document.getElementById('l-t');
    const s = document.getElementById('l-s');
    const e = document.getElementById('l-e');
    const u = document.getElementById('l-u');
    const p = document.getElementById('l-p');
    if (t) t.textContent = 'Edit Access — Demo Login';
    if (s) s.innerHTML = 'Enter the demo credentials to enable edits in this tab.<br><span style="color:var(--t3);font-size:9px;">Default: <code>site_user</code> / <code>Site@123</code></span>';
    if (e) e.textContent = '';
    if (u) { u.style.display = ''; u.value = DEMO_USER; }   // pre-fill convenience
    if (p) { p.style.display = ''; p.value = ''; setTimeout(() => p.focus(), 50); }
    const submit = modal.querySelector('[data-role="submit"]');
    if (submit) submit.style.display = '';
    modal.style.display = 'flex';
  }

  function _closeLogin() {
    const modal = document.getElementById('lw');
    if (modal) modal.style.display = 'none';
    _pendingAfter = null;
  }

  async function doLoginForm() {
    const u = (document.getElementById('l-u') || {}).value || '';
    const p = (document.getElementById('l-p') || {}).value || '';
    try {
      await login(u, p);
      const after = _pendingAfter;
      _closeLogin();
      if (after) after();
    } catch (e) {
      const err = document.getElementById('l-e');
      if (err) err.textContent = '⚠️ ' + (e.message || 'Wrong credentials');
    }
  }

  // -----------------------------------------------------------
  // No-ops for the methods that used to exist when this was
  // backed by Firebase Auth. Renderers that called them won't crash.
  // -----------------------------------------------------------
  function setMyName(name) {
    if (!_unlockedRole) return Promise.reject(new Error('Unlock first.'));
    _displayName = String(name || '').trim().slice(0, 80) || DEMO_NAME;
    _persist();
    _notify();
    return Promise.resolve();
  }
  function adminAssignRole() { return Promise.reject(new Error('Not available in demo build.')); }
  function listAllUsers()    { return Promise.resolve([{ uid: 'demo', name: DEMO_NAME, role: _unlockedRole || 'viewer' }]); }

  global.auth = {
    login, logout,
    current, onChange,
    requireRole, canEdit,
    setMyName, adminAssignRole, listAllUsers,
    doLoginForm,
    closeLogin: _closeLogin,
    openLogin:  _openLoginModal
  };

})(window);
