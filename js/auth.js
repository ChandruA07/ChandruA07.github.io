'use strict';
// =============================================================
//  auth.js — DEMO BUILD (multi-role)
//
//  ⚠️  THIS IS NOT REAL SECURITY.
//
//  Client-side edit gate with hardcoded per-section passwords.
//  Anyone with browser DevTools can bypass it. The Firebase
//  database itself is configured for public read AND write (see
//  security/rules.json) so any visitor can write to it. This is
//  fine for a controlled demo but MUST NOT be used for any
//  production data.
//
//  Roles:
//    • solar  → can edit only Solar section
//    • wtg    → can edit only WTG section
//    • bop    → can edit only BOP section
//    • land   → can edit only Land section
//    • admin  → Site Manager — can edit everything
//
//  Each section button uses reqLogin('solar' | 'wtg' | 'bop' |
//  'land' | 'all', cb). 'all' requires Site Manager (admin).
//  Section-specific buttons accept either the matching section
//  role or admin.
// =============================================================

(function (global) {

  // -----------------------------------------------------------
  // Credentials. Each entry is { user, pass, name, role }.
  // -----------------------------------------------------------
  const ACCOUNTS = [
    { user: 'solar_user', pass: 'Solar@123', name: 'Solar Engineer',   role: 'solar' },
    { user: 'wtg_user',   pass: 'Wtg@123',   name: 'WTG Engineer',     role: 'wtg'   },
    { user: 'bop_user',   pass: 'Bop@123',   name: 'BOP Engineer',     role: 'bop'   },
    { user: 'land_user',  pass: 'Land@123',  name: 'Land Coordinator', role: 'land'  },
    { user: 'site_user',  pass: 'Site@123',  name: 'Site Manager',     role: 'admin' },
  ];

  const ROLE_LABEL = {
    solar: 'Solar Engineer',
    wtg:   'WTG Engineer',
    bop:   'BOP Engineer',
    land:  'Land Coordinator',
    admin: 'Site Manager',
  };

  const ROLE_HINTS = {
    solar: 'solar_user / Solar@123',
    wtg:   'wtg_user / Wtg@123',
    bop:   'bop_user / Bop@123',
    land:  'land_user / Land@123',
    admin: 'site_user / Site@123',
  };

  // Bumped from v1 → invalidates stale single-role sessions on first load.
  const SS_KEY = 'swppl_demo_unlocked_v2';

  let _unlockedRole = null;
  let _displayName  = null;
  let _username     = null;
  const _listeners  = new Set();

  function _restore() {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && obj.role && ROLE_LABEL[obj.role]) {
        _unlockedRole = obj.role;
        _displayName  = obj.name || ROLE_LABEL[obj.role];
        _username     = obj.user || null;
      }
    } catch (e) { /* ignore */ }
  }
  _restore();

  function _persist() {
    try {
      if (_unlockedRole) {
        sessionStorage.setItem(SS_KEY, JSON.stringify({
          role: _unlockedRole, name: _displayName, user: _username
        }));
      } else {
        sessionStorage.removeItem(SS_KEY);
      }
    } catch (e) { /* ignore */ }
  }

  function _notify() {
    const profile = current();
    _listeners.forEach(fn => { try { fn(profile); } catch(e) {} });
  }

  function current() {
    if (!_unlockedRole) return null;
    return {
      uid:  'demo:' + _unlockedRole,
      name: _displayName || ROLE_LABEL[_unlockedRole] || 'User',
      role: _unlockedRole,
      user: _username,
      isAdmin: _unlockedRole === 'admin',
      isSolar: _unlockedRole === 'admin' || _unlockedRole === 'solar',
      isWtg:   _unlockedRole === 'admin' || _unlockedRole === 'wtg',
      isBop:   _unlockedRole === 'admin' || _unlockedRole === 'bop',
      isLand:  _unlockedRole === 'admin' || _unlockedRole === 'land',
      isViewer: false,
    };
  }

  function onChange(fn) {
    _listeners.add(fn);
    queueMicrotask(() => { try { fn(current()); } catch(e){} });
    return () => _listeners.delete(fn);
  }

  /**
   * canEdit(section)
   *   section omitted        → true if ANY role is unlocked (legacy data-api compat)
   *   section = 'all'        → true only for admin (Site Manager)
   *   section in {'solar','wtg','bop','land'} → true if admin OR matching role
   */
  function canEdit(section) {
    if (!_unlockedRole) return false;
    if (section === undefined || section === null || section === '') return true;  // any role
    if (_unlockedRole === 'admin') return true;
    if (section === 'all') return false;                                            // admin-only
    return _unlockedRole === String(section).toLowerCase();
  }

  /**
   * Validates user + pass. If requiredRole is supplied the creds must
   * resolve to that role OR to admin.
   */
  async function login(user, pass, requiredRole) {
    user = String(user || '').trim();
    pass = String(pass || '');
    const match = ACCOUNTS.find(a => a.user === user && a.pass === pass);
    if (!match) throw new Error('Wrong username or password.');

    if (requiredRole && requiredRole !== 'all') {
      if (match.role !== 'admin' && match.role !== requiredRole) {
        throw new Error(
          'These credentials are for ' + (ROLE_LABEL[match.role] || match.role) +
          '. This action needs ' + (ROLE_LABEL[requiredRole] || requiredRole) +
          ' or Site Manager.'
        );
      }
    } else if (requiredRole === 'all') {
      if (match.role !== 'admin') {
        throw new Error('This action requires Site Manager credentials.');
      }
    }

    _unlockedRole = match.role;
    _displayName  = match.name;
    _username     = match.user;
    _persist();
    _notify();
    console.log('[auth] unlocked as', match.role);
    return current();
  }

  async function logout() {
    _unlockedRole = null;
    _displayName  = null;
    _username     = null;
    _persist();
    _notify();
    console.log('[auth] locked');
  }

  /**
   * requireRole(role, cb)
   *   role = 'solar' | 'wtg' | 'bop' | 'land' → must hold that section's
   *                                              credentials (admin also passes)
   *   role = 'all'                            → Site Manager (admin) only
   */
  function requireRole(role, cb) {
    role = (role || '').toLowerCase();
    if (role === 'all' && canEdit('all')) { cb(); return; }
    if (role !== 'all' && canEdit(role)) { cb(); return; }
    _openLoginModal({
      requiredRole: role || 'admin',
      after: () => {
        if (role === 'all') { if (_unlockedRole === 'admin') cb(); }
        else if (canEdit(role)) cb();
      }
    });
  }

  // -----------------------------------------------------------
  // Login modal
  // -----------------------------------------------------------
  let _pendingAfter    = null;
  let _pendingRequired = null;

  function _openLoginModal(opts) {
    _pendingAfter    = (opts && opts.after) || null;
    _pendingRequired = (opts && opts.requiredRole) || null;

    const modal = document.getElementById('lw');
    if (!modal) {
      const u = window.prompt('Username:'); if (u === null) return;
      const p = window.prompt('Password:'); if (p === null) return;
      login(u, p, _pendingRequired)
        .then(() => { if (_pendingAfter) _pendingAfter(); })
        .catch(e => alert(e.message || 'Login failed'));
      return;
    }
    const t = document.getElementById('l-t');
    const s = document.getElementById('l-s');
    const e = document.getElementById('l-e');
    const u = document.getElementById('l-u');
    const p = document.getElementById('l-p');

    const niceRole = _pendingRequired
      ? (_pendingRequired === 'all' ? 'Site Manager' : (ROLE_LABEL[_pendingRequired] || _pendingRequired))
      : 'Edit';

    if (t) t.textContent = '🔐 ' + niceRole + ' — Login';
    if (s) {
      const hintForRole = _pendingRequired === 'all'
        ? ROLE_HINTS.admin
        : (ROLE_HINTS[_pendingRequired] || ROLE_HINTS.admin);
      s.innerHTML =
        'Enter the credentials for <b>' + niceRole + '</b> to enable edits in this tab.<br>' +
        '<span style="color:var(--t3);font-size:9px;">Demo: <code>' + hintForRole + '</code></span><br>' +
        '<span style="color:var(--t3);font-size:9px;">Site Manager (<code>' + ROLE_HINTS.admin + '</code>) can unlock any section.</span>';
    }
    if (e) e.textContent = '';
    if (u) {
      u.style.display = '';
      const suggestUser = _pendingRequired === 'all'
        ? 'site_user'
        : (ACCOUNTS.find(a => a.role === _pendingRequired) || {}).user || '';
      u.value = suggestUser;
    }
    if (p) { p.style.display = ''; p.value = ''; setTimeout(() => p.focus(), 50); }
    const submit = modal.querySelector('[data-role="submit"]');
    if (submit) submit.style.display = '';
    modal.style.display = 'flex';
  }

  function _closeLogin() {
    const modal = document.getElementById('lw');
    if (modal) modal.style.display = 'none';
    _pendingAfter    = null;
    _pendingRequired = null;
  }

  async function doLoginForm() {
    const u = (document.getElementById('l-u') || {}).value || '';
    const p = (document.getElementById('l-p') || {}).value || '';
    try {
      await login(u, p, _pendingRequired);
      const after = _pendingAfter;
      _closeLogin();
      if (after) after();
    } catch (e) {
      const err = document.getElementById('l-e');
      if (err) err.textContent = '⚠️ ' + (e.message || 'Wrong credentials');
    }
  }

  // -----------------------------------------------------------
  // Legacy compatibility no-ops
  // -----------------------------------------------------------
  function setMyName(name) {
    if (!_unlockedRole) return Promise.reject(new Error('Unlock first.'));
    _displayName = String(name || '').trim().slice(0, 80) || ROLE_LABEL[_unlockedRole] || 'User';
    _persist();
    _notify();
    return Promise.resolve();
  }
  function adminAssignRole() { return Promise.reject(new Error('Not available in demo build.')); }
  function listAllUsers() {
    return Promise.resolve(ACCOUNTS.map(a => ({
      uid: 'demo:' + a.role, name: a.name, role: a.role, user: a.user,
    })));
  }

  global.auth = {
    login, logout,
    current, onChange,
    requireRole, canEdit,
    setMyName, adminAssignRole, listAllUsers,
    doLoginForm,
    closeLogin: _closeLogin,
    openLogin:  _openLoginModal,
    accounts: ACCOUNTS.map(a => ({ user: a.user, role: a.role, name: a.name })),
    ROLE_LABEL,
  };

})(window);
