'use strict';
// =============================================================
//  auth.js  (SUPABASE BUILD)
//
//  Real authentication via Supabase Auth (email/password), role read
//  from public.users (kept in sync with auth.users by the
//  handle_new_user trigger, roles assigned by an admin — see
//  docs/supabase/SECURITY.md).
//
//  Public surface is IDENTICAL to every previous auth variant, so no
//  renderer changes:
//    auth.current() → {uid,name,role,isAdmin,is*,…} | null
//    auth.login(userOrEmail, pass, requiredRole?) / auth.logout()
//    auth.canEdit(section?) / auth.requireRole(role, cb)
//    auth.onChange(fn), auth.setMyName, auth.adminAssignRole,
//    auth.listAllUsers, auth.openLogin/closeLogin/doLoginForm
//
//  IMPORTANT: the client-side role logic here is UX only. After
//  Phase 6, Row Level Security in Postgres is the real boundary —
//  a tampered client gets its writes rejected by the database.
//
//  Falls back to the clearly-labelled DEMO gate only when supabase-js
//  is absent (e.g. opening index.html with no network for a UI look).
// =============================================================

(function (global) {

  const CONFIGURED_MODE = global.SWPPL_AUTH_MODE || 'supabase';
  const SUPABASE_AVAILABLE = !!(global.sb && global.sb.auth && typeof global.sb.from === 'function');
  const MODE = (CONFIGURED_MODE === 'supabase' && !SUPABASE_AVAILABLE) ? 'demo' : CONFIGURED_MODE;
  if (CONFIGURED_MODE === 'supabase' && MODE === 'demo') {
    console.warn('[auth] supabase-js not loaded — falling back to DEMO gate. ' +
      'This is NOT security; deploy with the supabase-js script tag for production.');
  }

  const ROLE_LABEL = {
    solar: 'Solar Engineer', wtg: 'WTG Engineer', bop: 'BOP Engineer',
    land: 'Land Coordinator', procurement: 'Procurement Officer',
    store: 'Store Keeper', planner: 'Planning Engineer',
    viewer: 'Viewer (read-only)', admin: 'Site Manager'
  };
  const ALL_ROLES = Object.keys(ROLE_LABEL);

  // Shorthand → email mapping + demo-mode credentials. In supabase
  // mode NO password lives here — these emails must exist in
  // Supabase Auth (docs/supabase/DEPLOYMENT.md step 4).
  const ACCOUNTS = [
    { user: 'solar_user', email: 'solar@swppl.demo',  pass: 'Solar@123', name: 'Solar Engineer',     role: 'solar' },
    { user: 'wtg_user',   email: 'wtg@swppl.demo',    pass: 'Wtg@123',   name: 'WTG Engineer',       role: 'wtg'   },
    { user: 'bop_user',   email: 'bop@swppl.demo',    pass: 'Bop@123',   name: 'BOP Engineer',       role: 'bop'   },
    { user: 'land_user',  email: 'land@swppl.demo',   pass: 'Land@123',  name: 'Land Coordinator',   role: 'land'  },
    { user: 'proc_user',  email: 'proc@swppl.demo',   pass: 'Proc@123',  name: 'Procurement Officer',role: 'procurement' },
    { user: 'store_user', email: 'store@swppl.demo',  pass: 'Store@123', name: 'Store Keeper',       role: 'store' },
    { user: 'plan_user',  email: 'plan@swppl.demo',   pass: 'Plan@123',  name: 'Planning Engineer',  role: 'planner' },
    { user: 'site_user',  email: 'admin@swppl.demo',  pass: 'Site@123',  name: 'Site Manager',       role: 'admin' },
  ];

  let _profile = null;
  const _listeners = new Set();

  function _mkProfile(uid, name, role, email) {
    role = ALL_ROLES.includes(role) ? role : 'viewer';
    const admin = role === 'admin';
    return {
      uid, name: name || ROLE_LABEL[role] || 'User', role, email: email || null,
      isAdmin: admin,
      isSolar: admin || role === 'solar',
      isWtg:   admin || role === 'wtg',
      isBop:   admin || role === 'bop',
      isLand:  admin || role === 'land',
      isProcurement: admin || role === 'procurement',
      isStore:   admin || role === 'store',
      isPlanner: admin || role === 'planner',
      isViewer:  role === 'viewer',
    };
  }

  function current() { return _profile; }
  function _emit() { _listeners.forEach(fn => { try { fn(_profile); } catch (e) {} }); }
  function onChange(fn) {
    _listeners.add(fn);
    queueMicrotask(() => { try { fn(_profile); } catch (e) {} });
    return () => _listeners.delete(fn);
  }

  function canEdit(section) {
    if (!_profile) return false;
    if (_profile.isViewer) return false;
    if (section === undefined || section === null || section === '') return true;
    if (_profile.role === 'admin') return true;
    if (section === 'all') return false;
    return _profile.role === String(section).toLowerCase();
  }

  function _checkRequiredRole(role, requiredRole) {
    if (!requiredRole || requiredRole === '') return;
    if (requiredRole === 'all') {
      if (role !== 'admin') throw new Error('This action requires Site Manager credentials.');
      return;
    }
    if (role !== 'admin' && role !== requiredRole) {
      throw new Error('These credentials are for ' + (ROLE_LABEL[role] || role) +
        '. This action needs ' + (ROLE_LABEL[requiredRole] || requiredRole) + ' or Site Manager.');
    }
  }

  // -----------------------------------------------------------
  // SUPABASE implementation
  // -----------------------------------------------------------
  const sbi = {};
  if (MODE === 'supabase') {
    const sb = global.sb;

    async function _loadProfile(user) {
      let rec = null;
      try {
        const { data, error } = await sb.from('users').select('name,role').eq('id', user.id).maybeSingle();
        if (error) throw error;
        rec = data;
      } catch (e) {
        console.warn('[auth] role lookup failed — defaulting to viewer:', e && e.message);
      }
      const meta = (user.user_metadata || {});
      return _mkProfile(user.id, (rec && rec.name) || meta.name, (rec && rec.role) || 'viewer', user.email);
    }

    sb.auth.onAuthStateChange(async (event, session) => {
      if (!session || !session.user) {
        _profile = null; _emit(); return;
      }
      _profile = await _loadProfile(session.user);
      console.log('[auth] signed in:', _profile.role, '(' + _profile.email + ')');
      _emit();
    });
    // restore an existing session on load
    sb.auth.getSession().then(async ({ data }) => {
      if (data && data.session && data.session.user && !_profile) {
        _profile = await _loadProfile(data.session.user);
        _emit();
      }
    });

    sbi.login = async function (userOrEmail, pass, requiredRole) {
      let email = String(userOrEmail || '').trim();
      const acc = ACCOUNTS.find(a => a.user === email);
      if (acc) email = acc.email;
      if (!/@/.test(email)) throw new Error('Enter your email address (e.g. solar@swppl.demo).');
      const { data, error } = await sb.auth.signInWithPassword({ email, password: String(pass || '') });
      if (error) {
        if (/invalid login credentials/i.test(error.message || ''))
          throw new Error('Wrong email or password.');
        if (/rate limit|too many/i.test(error.message || ''))
          throw new Error('Too many attempts — try again in a few minutes.');
        if (/email logins are disabled|signups not allowed/i.test(error.message || ''))
          throw new Error('Email/Password sign-in is not enabled in the Supabase dashboard yet (see docs/supabase/DEPLOYMENT.md step 4).');
        throw new Error(error.message || 'Sign-in failed.');
      }
      const prof = await _loadProfile(data.user);
      try { _checkRequiredRole(prof.role, requiredRole); }
      catch (err) { await sb.auth.signOut(); throw err; }
      _profile = prof;
      _emit();
      return _profile;
    };

    sbi.logout = async function () {
      await sb.auth.signOut();
      _profile = null; _emit();
      if (global.realtime && realtime.detachAll) { try { realtime.detachAll(); } catch (e) {} }
    };

    sbi.setMyName = async function (name) {
      if (!_profile) throw new Error('Sign in first.');
      name = String(name || '').trim().slice(0, 80);
      if (!name) throw new Error('Name cannot be empty.');
      const { error } = await sb.from('users').update({ name }).eq('id', _profile.uid);
      if (error) throw new Error(error.message);
      _profile = { ..._profile, name };
      _emit();
    };

    sbi.adminAssignRole = async function (uid, role) {
      if (!_profile || !_profile.isAdmin) throw new Error('Site Manager only.');
      if (!ALL_ROLES.includes(role)) throw new Error('Unknown role: ' + role);
      const { error } = await sb.from('users').update({ role }).eq('id', uid);
      if (error) throw new Error(error.message);
    };

    sbi.listAllUsers = async function () {
      const { data, error } = await sb.from('users').select('id,name,email,role').order('email');
      if (error) throw new Error(error.message);
      return (data || []).map(u => ({ uid: u.id, name: u.name, email: u.email, role: u.role }));
    };
  }

  // -----------------------------------------------------------
  // DEMO fallback (unchanged: sessionStorage gate, NOT security)
  // -----------------------------------------------------------
  const dm = {};
  const SS_KEY = 'swppl_demo_unlocked_v3';
  if (MODE === 'demo') {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && ROLE_LABEL[o.role]) _profile = _mkProfile('demo:' + o.role, o.name, o.role);
      }
    } catch (e) {}
    function _persist() {
      try {
        if (_profile) sessionStorage.setItem(SS_KEY, JSON.stringify({ role: _profile.role, name: _profile.name }));
        else sessionStorage.removeItem(SS_KEY);
      } catch (e) {}
    }
    dm.login = async function (user, pass, requiredRole) {
      user = String(user || '').trim();
      const match = ACCOUNTS.find(a => (a.user === user || a.email === user) && a.pass === String(pass || ''));
      if (!match) throw new Error('Wrong username or password.');
      _checkRequiredRole(match.role, requiredRole);
      _profile = _mkProfile('demo:' + match.role, match.name, match.role, match.email);
      _persist(); _emit();
      console.log('[auth] DEMO unlock as', match.role, '— not real security');
      return _profile;
    };
    dm.logout = async function () { _profile = null; _persist(); _emit(); };
    dm.setMyName = async function (name) {
      if (!_profile) throw new Error('Unlock first.');
      _profile = { ..._profile, name: String(name || '').trim().slice(0, 80) || _profile.name };
      _persist(); _emit();
    };
    dm.adminAssignRole = () => Promise.reject(new Error('Not available in demo mode.'));
    dm.listAllUsers = () => Promise.resolve(ACCOUNTS.map(a => ({ uid: 'demo:' + a.role, name: a.name, role: a.role, email: a.email })));
  }

  const impl = MODE === 'supabase' ? sbi : dm;

  // -----------------------------------------------------------
  // requireRole + login modal (unchanged UX)
  // -----------------------------------------------------------
  function requireRole(role, cb) {
    role = (role || '').toLowerCase();
    if (role === 'all' ? canEdit('all') : canEdit(role)) { cb(); return; }
    _openLoginModal({
      requiredRole: role || 'admin',
      after: () => {
        if (role === 'all') { if (_profile && _profile.isAdmin) cb(); }
        else if (canEdit(role)) cb();
      }
    });
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let _pendingAfter = null, _pendingRequired = null;
  function _openLoginModal(opts) {
    _pendingAfter = (opts && opts.after) || null;
    _pendingRequired = (opts && opts.requiredRole) || null;
    const modal = document.getElementById('lw');
    if (!modal) {
      const u = window.prompt(MODE === 'supabase' ? 'Email:' : 'Username:'); if (u === null) return;
      const p = window.prompt('Password:'); if (p === null) return;
      impl.login(u, p, _pendingRequired)
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
    if (t) t.textContent = '🔐 ' + niceRole + ' — Sign in';
    if (s) {
      if (MODE === 'supabase') {
        s.innerHTML = 'Sign in with your <b>email and password</b> to enable ' +
          esc(niceRole) + ' actions.<br><span style="color:var(--t3);font-size:9px;">' +
          'Access is enforced server-side by Row Level Security — the login is required for every write.</span>';
      } else {
        const hint = ACCOUNTS.find(a => a.role === (_pendingRequired === 'all' ? 'admin' : _pendingRequired)) || ACCOUNTS[ACCOUNTS.length - 1];
        s.innerHTML = 'Enter the demo credentials for <b>' + esc(niceRole) + '</b>.<br>' +
          '<span style="color:var(--t3);font-size:9px;">Demo: <code>' + esc(hint.user + ' / ' + hint.pass) + '</code> · ' +
          '<b>demo mode is NOT security</b> (see docs/supabase/SECURITY.md).</span>';
      }
    }
    if (e) e.textContent = '';
    if (u) {
      u.style.display = '';
      u.placeholder = MODE === 'supabase' ? 'you@company.com' : 'e.g. solar_user';
      const suggest = ACCOUNTS.find(a => a.role === (_pendingRequired === 'all' ? 'admin' : _pendingRequired));
      u.value = suggest ? (MODE === 'supabase' ? suggest.email : suggest.user) : '';
    }
    if (p) { p.style.display = ''; p.value = ''; setTimeout(() => p.focus(), 50); }
    const submit = modal.querySelector('[data-role="submit"]');
    if (submit) submit.style.display = '';
    modal.style.display = 'flex';
  }

  function _closeLogin() {
    const modal = document.getElementById('lw');
    if (modal) modal.style.display = 'none';
    _pendingAfter = null; _pendingRequired = null;
  }

  async function doLoginForm() {
    const u = (document.getElementById('l-u') || {}).value || '';
    const p = (document.getElementById('l-p') || {}).value || '';
    const errEl = document.getElementById('l-e');
    const btn = document.querySelector('#lw [data-role="submit"]');
    try {
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Signing in…'; }
      await impl.login(u, p, _pendingRequired);
      const after = _pendingAfter;
      _closeLogin();
      if (after) after();
    } catch (e) {
      if (errEl) errEl.textContent = '⚠️ ' + (e.message || 'Wrong credentials');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
    }
  }

  global.auth = {
    MODE,
    login: (...a) => impl.login(...a),
    logout: (...a) => impl.logout(...a),
    current, onChange, requireRole, canEdit,
    setMyName: (...a) => impl.setMyName(...a),
    adminAssignRole: (...a) => impl.adminAssignRole(...a),
    listAllUsers: (...a) => impl.listAllUsers(...a),
    doLoginForm, closeLogin: _closeLogin, openLogin: _openLoginModal,
    accounts: ACCOUNTS.map(a => ({ user: a.user, email: a.email, role: a.role, name: a.name })),
    ROLE_LABEL,
  };

})(window);
