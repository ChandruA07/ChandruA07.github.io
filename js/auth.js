'use strict';
// =============================================================
//  auth.js  —  Email/password auth + role-based editing
//
//  Design:
//    • The dashboard is PUBLIC. Anyone can open the URL and read
//      data. No auto sign-in, no forced login screen.
//    • Editing requires email/password sign-in.
//    • Role is fetched from /users/{uid} after login. Unknown
//      users default to 'viewer' (read-only).
//
//  Roles:
//    admin  → can edit everything
//    solar  → edit solar section
//    wtg    → edit wtg section
//    bop    → edit bop section
//    viewer → read-only
//
//  First admin bootstrap (one-time, manual):
//    1. Firebase Console → Authentication → add email/password user.
//    2. Realtime Database → Data → manually create:
//         /users/<that-uid>/role = "admin"
//         /users/<that-uid>/name = "Site Manager"
//    From then on, the admin assigns roles via the in-app User Panel.
//
//  Public surface (window.auth):
//    auth.login(email, password)         → Promise<profile>
//    auth.logout()                       → Promise<void>
//    auth.current()                      → {uid, email, role, name} | null
//    auth.onChange(handler)              → handler(profile|null)
//    auth.requireRole(role|[roles], cb)  → cb() if allowed; else open login
//    auth.canEdit(section)               → boolean
//    auth.setMyName(name)                → admin or self only
//    auth.adminAssignRole(uid, role)     → admin only
//    auth.listAllUsers()                 → admin only
// =============================================================

(function (global) {

  let _profile  = null;          // {uid, email, role, name}
  let _roleOff  = null;          // detach fn for the live /users/{uid} watcher
  const _listeners = new Set();

  function _notify() {
    _listeners.forEach(fn => { try { fn(_profile); } catch(e) { console.warn('[auth]', e); } });
  }

  // -----------------------------------------------------------
  // canEdit(section, role?)
  //
  // Returns true if `role` (defaults to current user's role) is
  // allowed to edit `section`. Sections recognised:
  //   'solar' | 'wtg' | 'bop' | 'land' | 'gantt' | 'schedule'
  //   'row'   | 'milestone' | 'pod' | 'hse'
  //
  // Truth table:
  //   admin        → everything
  //   solar/wtg/bop→ their own section + cross-cutting (row, milestone, pod, hse)
  //   viewer       → nothing
  //   not signed in→ nothing
  // -----------------------------------------------------------
  function canEdit(section, role) {
    if (role === undefined) role = _profile ? _profile.role : null;
    if (!role || role === 'viewer') return false;
    if (role === 'admin') return true;

    switch (section) {
      case 'solar':    return role === 'solar';
      case 'wtg':      return role === 'wtg';
      case 'bop':      return role === 'bop';
      case 'land':     return false;       // admin-only
      case 'gantt':    return false;       // admin-only
      case 'schedule': return false;       // admin-only
      // Cross-cutting items any non-viewer can touch:
      case 'row':       return true;
      case 'milestone': return true;
      case 'pod':       return true;
      case 'hse':       return true;
      default:          return false;
    }
  }

  // -----------------------------------------------------------
  // /users/{uid} live watcher.
  // Promote/demote takes effect within seconds, no sign-out needed.
  // -----------------------------------------------------------
  function _watchProfile(uid) {
    if (_roleOff) { _roleOff(); _roleOff = null; }
    const ref = fbDB.ref('users/' + uid);
    const handler = snap => {
      if (!_profile || _profile.uid !== uid) return;
      const u = snap.val() || {};
      const newRole = u.role || 'viewer';
      const newName = u.name || _profile.name || (_profile.email || 'User');
      if (newRole !== _profile.role || newName !== _profile.name) {
        _profile = Object.assign({}, _profile, { role: newRole, name: newName });
        console.log('[auth] Role/name updated live:', _profile);
        _notify();
      }
    };
    ref.on('value', handler);
    _roleOff = () => ref.off('value', handler);
  }

  // -----------------------------------------------------------
  // Load profile (role + name) for a UID. If /users/{uid} is
  // missing, default to viewer — do NOT auto-create it. Only
  // admins write to /users (rules enforce this).
  // -----------------------------------------------------------
  async function _loadProfile(user) {
    let role = 'viewer';
    let name = user.email || 'User';
    try {
      const snap = await fbDB.ref('users/' + user.uid).get();
      if (snap.exists()) {
        const u = snap.val() || {};
        role = u.role || 'viewer';
        name = u.name || user.email || 'User';
      } else {
        console.log('[auth] No /users/' + user.uid + ' record — defaulting to viewer.');
      }
    } catch (e) {
      console.warn('[auth] Could not load /users/' + user.uid + ':', e);
    }
    return { uid: user.uid, email: user.email, role, name };
  }

  // -----------------------------------------------------------
  // Firebase Auth state listener — the source of truth for who's
  // signed in. Fires on login / logout / token refresh / page reload.
  //
  // We do NOT call signInAnonymously here. Unauthenticated state
  // is a valid steady state (= public viewer).
  // -----------------------------------------------------------
  fbAuth.onAuthStateChanged(async user => {
    if (!user) {
      if (_roleOff) { _roleOff(); _roleOff = null; }
      _profile = null;
      _notify();
      return;
    }
    _profile = await _loadProfile(user);
    console.log('[auth] Signed in:', _profile);
    _notify();
    _watchProfile(user.uid);
  });

  // -----------------------------------------------------------
  // Public auth methods
  // -----------------------------------------------------------
  async function login(email, password) {
    email = String(email || '').trim();
    password = String(password || '');
    if (!/.+@.+\..+/.test(email)) throw new Error('Enter a valid email address.');
    if (password.length < 6)      throw new Error('Password must be at least 6 characters.');
    await fbAuth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged will fire and populate _profile.
    // Wait for the role to load before resolving so callers can act on it.
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { off(); reject(new Error('Login timed out loading role.')); }, 8000);
      const off = onChange(p => {
        if (p) { clearTimeout(timeout); off(); resolve(p); }
      });
    });
  }

  async function logout() {
    try {
      await fbAuth.signOut();
    } catch (e) {
      console.warn('[auth] sign-out failed:', e);
      throw e;
    }
  }

  function current() { return _profile; }

  function onChange(fn) {
    _listeners.add(fn);
    queueMicrotask(() => { try { fn(_profile); } catch(e){} });
    return () => _listeners.delete(fn);
  }

  // -----------------------------------------------------------
  // requireRole(roles, cb)
  //
  // Used by edit buttons. If the user already has permission,
  // runs cb(). Otherwise opens the login modal; after a
  // successful login, retries the permission check.
  // -----------------------------------------------------------
  function requireRole(roles, cb) {
    if (!Array.isArray(roles)) roles = [roles];
    const allowed = ['admin'].concat(roles).map(r => r === 'all' ? 'admin' : r);
    const ok = () => _profile && allowed.includes(_profile.role);
    if (ok()) { cb(); return; }
    _openLoginModal({
      requiredRoles: allowed.filter(r => r !== 'admin').concat(['admin']),
      after: () => {
        if (ok()) { cb(); }
        else {
          _showLoginError('Your account has role "' + (_profile ? _profile.role : 'viewer') +
                          '". Required: ' + allowed.join(' or ') + '.');
        }
      }
    });
  }

  // -----------------------------------------------------------
  // Login modal interaction
  // -----------------------------------------------------------
  let _pendingAfter = null;
  let _pendingRoles = null;

  function _openLoginModal(opts) {
    opts = opts || {};
    _pendingAfter = opts.after || null;
    _pendingRoles = opts.requiredRoles || null;
    const modal = document.getElementById('lw');
    if (!modal) { alert('Login modal missing — login.html not loaded.'); return; }
    const t = document.getElementById('l-t');
    const s = document.getElementById('l-s');
    const e = document.getElementById('l-e');
    const u = document.getElementById('l-u');
    const p = document.getElementById('l-p');
    if (t) t.textContent = 'Sign In to Edit';
    if (s) {
      if (_pendingRoles && _pendingRoles.length) {
        s.innerHTML = 'Required role: <b>' + _pendingRoles.join(' or ') + '</b>';
      } else {
        s.textContent = 'Anyone can view; sign in to edit.';
      }
    }
    if (e) e.textContent = '';
    if (u) { u.style.display = ''; u.value = ''; }
    if (p) { p.style.display = ''; p.value = ''; }
    const submit = modal.querySelector('[data-role="submit"]');
    if (submit) submit.style.display = '';
    modal.style.display = 'flex';
    setTimeout(() => { try { u && u.focus(); } catch(e){} }, 50);
  }

  function _showLoginError(msg) {
    const e = document.getElementById('l-e');
    if (e) e.textContent = '⚠️ ' + msg;
  }

  function _closeLogin() {
    const modal = document.getElementById('lw');
    if (modal) modal.style.display = 'none';
    _pendingAfter = null;
    _pendingRoles = null;
  }

  // Submit handler called by the form's button / Enter key.
  async function doLoginForm() {
    const email = (document.getElementById('l-u') || {}).value || '';
    const pass  = (document.getElementById('l-p') || {}).value || '';
    try {
      await login(email, pass);
      const after = _pendingAfter;
      _closeLogin();
      if (after) after();
    } catch (e) {
      _showLoginError(_friendlyAuthError(e));
    }
  }

  function _friendlyAuthError(e) {
    switch ((e && e.code) || '') {
      case 'auth/invalid-email':            return 'Invalid email format.';
      case 'auth/user-disabled':            return 'This account is disabled.';
      case 'auth/user-not-found':           return 'No such account.';
      case 'auth/wrong-password':           return 'Wrong password.';
      case 'auth/invalid-credential':       return 'Invalid email or password.';
      case 'auth/too-many-requests':        return 'Too many attempts — wait a minute and try again.';
      case 'auth/network-request-failed':   return 'No network connection.';
      default: return (e && e.message) || 'Sign-in failed.';
    }
  }

  // -----------------------------------------------------------
  // Role + name management (admin-only writes; security rules
  // enforce this server-side independently of the UI checks).
  // -----------------------------------------------------------
  async function setMyName(name) {
    if (!_profile) throw new Error('Sign in first.');
    name = String(name || '').trim().slice(0, 80);
    if (!name) throw new Error('Name cannot be empty.');
    await fbDB.ref('users/' + _profile.uid + '/name').set(name);
  }

  async function adminAssignRole(targetUid, role) {
    if (!_profile || _profile.role !== 'admin') {
      throw new Error('Only the Site Manager can assign roles.');
    }
    if (!targetUid) throw new Error('Target UID required.');
    if (!['admin','solar','wtg','bop','viewer'].includes(role)) {
      throw new Error('Invalid role: ' + role);
    }
    await fbDB.ref('users/' + targetUid + '/role').set(role);
  }

  async function listAllUsers() {
    if (!_profile || _profile.role !== 'admin') {
      throw new Error('Only the Site Manager can list users.');
    }
    const snap = await fbDB.ref('users').get();
    if (!snap.exists()) return [];
    const out = [];
    snap.forEach(c => out.push({ uid: c.key, ...c.val() }));
    out.sort((a,b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (b.role === 'admin' && a.role !== 'admin') return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    return out;
  }

  global.auth = {
    login, logout,
    current, onChange,
    requireRole, canEdit,
    setMyName, adminAssignRole, listAllUsers,
    doLoginForm,
    closeLogin: _closeLogin,
    openLogin: _openLoginModal
  };

})(window);
