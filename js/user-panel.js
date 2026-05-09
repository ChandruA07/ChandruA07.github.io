'use strict';
// =============================================================
//  user-panel.js  —  In-app user / role management
//
//  Two views from one button:
//    • Non-admin: shows your UID, name, role, and a name-edit field.
//      Tells you to ask the Site Manager for elevated access.
//    • Admin: shows the same plus a list of all users with role
//      dropdowns. Changes propagate live via the auth.js
//      /users/{uid} watcher.
// =============================================================

(function (global) {

  function openUserPanel() {
    const me = (typeof auth !== 'undefined' && auth.current()) ? auth.current() : null;
    if (!me) {
      showToast('⏳ Signing you in… try again in a moment.', 'wn');
      return;
    }
    document.getElementById('p-t').textContent = '👤 User & Roles';

    const isAdmin = me.role === 'admin';
    const myCard = `
      <div class="al ${me.role === 'admin' ? 'al-g' : (me.role === 'viewer' ? 'al-w' : 'al-b')}" style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="min-width:0;">
            <div style="font-size:11px;font-weight:700;">${_esc(me.name)}</div>
            ${me.email ? `<div style="font-size:9px;color:var(--t3);overflow:hidden;text-overflow:ellipsis;">${_esc(me.email)}</div>` : ''}
            <div style="font-size:9px;color:var(--t3);">UID: <code style="background:rgba(255,255,255,.06);padding:1px 5px;border-radius:3px;">${_esc((me.uid||'').slice(0,16))}…</code></div>
          </div>
          <div style="font-family:var(--f2);font-size:14px;font-weight:700;color:${_roleColor(me.role)};">${me.role.toUpperCase()}</div>
        </div>
      </div>
      <div class="fg" style="margin-bottom:12px;">
        <label class="fl">Display name (shows on edits & audit log)</label>
        <div style="display:flex;gap:6px;">
          <input class="fi" id="up-my-name" value="${_esc(me.name)}" maxlength="80" style="flex:1;">
          <button class="btn btsol" onclick="userPanelSaveName()">Save</button>
        </div>
      </div>`;

    if (!isAdmin) {
      // Non-admin view
      document.getElementById('p-b').innerHTML = `
        ${myCard}
        <div class="al al-w">
          <b>Need elevated access?</b><br>
          <span style="font-size:10px;line-height:1.5;">
            Contact your Site Manager. They can promote you to
            <b>Solar / WTG / BOP</b> (or admin) from this panel on their device.
            Your role updates instantly — no need to refresh.
          </span>
        </div>
        <div style="display:flex;gap:7px;margin-top:12px;">
          <button class="btn" style="flex:1;" onclick="cov('pov')">Close</button>
          <button class="btn" style="flex:1;" onclick="cov('pov');authLogoutClick()" data-tt="Lock edits in this tab">🔒 Lock edits</button>
        </div>`;
      ov('pov');
      return;
    }

    // Admin view — render skeleton, then populate
    document.getElementById('p-b').innerHTML = `
      ${myCard}
      <div class="ph2" style="margin-bottom:8px;">
        <div class="pt">All Users</div>
        <button class="btn bts" onclick="userPanelRefresh()" data-tt="Reload user list">↻ Refresh</button>
      </div>
      <div id="up-list" class="tsc" style="max-height:50vh;overflow-y:auto;">
        <div style="text-align:center;padding:30px;color:var(--t3);">Loading users…</div>
      </div>
      <div style="display:flex;gap:7px;margin-top:12px;">
        <button class="btn" style="flex:1;" onclick="cov('pov')">Close</button>
      </div>`;
    ov('pov');
    userPanelRefresh();
  }

  async function userPanelRefresh() {
    const list = document.getElementById('up-list');
    if (!list) return;
    try {
      const users = await auth.listAllUsers();
      const me    = auth.current();
      if (users.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t3);">No users yet.</div>';
        return;
      }
      list.innerHTML = `
        <table class="tbl" style="font-size:10px;">
          <thead>
            <tr>
              <th style="text-align:left;">Name</th>
              <th style="text-align:left;">UID</th>
              <th style="text-align:left;">Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
          ${users.map(u => `
            <tr>
              <td style="font-weight:600;">${_esc(u.name || '—')}${u.uid === me.uid ? ' <span style="color:var(--ac);font-size:8px;">(you)</span>' : ''}</td>
              <td><code style="font-size:9px;background:rgba(255,255,255,.04);padding:1px 4px;border-radius:3px;">${_esc((u.uid||'').slice(0,12))}…</code></td>
              <td>
                <select class="fs" id="up-role-${_esc(u.uid)}" style="font-size:9px;padding:2px 4px;width:90px;" ${u.uid === me.uid ? 'disabled' : ''}>
                  <option value="admin"  ${u.role==='admin' ?'selected':''}>admin</option>
                  <option value="solar"  ${u.role==='solar' ?'selected':''}>solar</option>
                  <option value="wtg"    ${u.role==='wtg'   ?'selected':''}>wtg</option>
                  <option value="bop"    ${u.role==='bop'   ?'selected':''}>bop</option>
                  <option value="viewer" ${u.role==='viewer'?'selected':''}>viewer</option>
                </select>
              </td>
              <td>
                ${u.uid === me.uid
                  ? '<span style="font-size:8px;color:var(--t3);">self</span>'
                  : `<button class="btn bts" onclick="userPanelAssign('${_esc(u.uid)}')" data-tt="Apply role change">Apply</button>`}
              </td>
            </tr>
          `).join('')}
          </tbody>
        </table>
        <div style="margin-top:10px;font-size:9px;color:var(--t3);line-height:1.5;">
          • Roles take effect instantly across all of that user's open devices.<br>
          • You can't change your own role here (avoids accidental lockout).
        </div>`;
    } catch (e) {
      console.error('[user-panel]', e);
      list.innerHTML = `<div style="color:var(--er);padding:20px;">${_esc(e.message || 'Failed to load')}</div>`;
    }
  }

  async function userPanelAssign(targetUid) {
    const sel = document.getElementById('up-role-' + targetUid);
    if (!sel) return;
    const newRole = sel.value;
    try {
      await auth.adminAssignRole(targetUid, newRole);
      showToast('✅ Role updated to ' + newRole, 'ok');
      userPanelRefresh();
    } catch (e) {
      showToast('❌ ' + (e.message || 'Failed'), 'er');
    }
  }

  async function userPanelSaveName() {
    const name = (document.getElementById('up-my-name') || {}).value || '';
    try {
      await auth.setMyName(name);
      showToast('✅ Name saved', 'ok');
    } catch (e) {
      showToast('❌ ' + (e.message || 'Failed'), 'er');
    }
  }

  // -----------------------------------------------------------
  // Keep the topbar Login / User / Logout buttons in sync with
  // the current auth state.
  // -----------------------------------------------------------
  function _refreshAuthBar(profile) {
    const loginBtn  = document.getElementById('auth-login-btn');
    const userBtn   = document.getElementById('auth-user-btn');
    const logoutBtn = document.getElementById('auth-logout-btn');
    const nameSpan  = document.getElementById('auth-user-name');
    if (!loginBtn || !userBtn || !logoutBtn) return;
    if (profile) {
      loginBtn.style.display  = 'none';
      userBtn.style.display   = '';
      logoutBtn.style.display = '';
      const dot = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' +
                  _roleColor(profile.role) + ';margin-right:4px;"></span>';
      if (nameSpan) {
        nameSpan.innerHTML = dot + _esc(profile.name) + ' · ' + profile.role;
        nameSpan.style.color = _roleColor(profile.role);
      }
    } else {
      loginBtn.style.display  = '';
      userBtn.style.display   = 'none';
      logoutBtn.style.display = 'none';
    }
  }
  if (typeof auth !== 'undefined' && auth.onChange) auth.onChange(_refreshAuthBar);
  setTimeout(() => _refreshAuthBar(typeof auth !== 'undefined' ? auth.current() : null), 800);

  // Logout button click handler — confirms then signs out.
  async function authLogoutClick() {
    if (!confirm('Lock edits in this tab? You\'ll need to re-enter the demo password to edit again.')) return;
    try {
      await auth.logout();
      showToast('🔒 Edits locked — view-only mode', 'wn');
    } catch (e) {
      showToast('❌ ' + (e.message || 'Sign-out failed'), 'er');
    }
  }
  global.authLogoutClick = authLogoutClick;

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _roleColor(r) {
    return ({
      admin:  '#ff5252',
      solar:  '#ffaa00',
      wtg:    '#00c8ff',
      bop:    '#9c27b0',
      viewer: '#90a4ae'
    })[r] || '#90a4ae';
  }

  global.openUserPanel        = openUserPanel;
  global.userPanelRefresh     = userPanelRefresh;
  global.userPanelAssign      = userPanelAssign;
  global.userPanelSaveName    = userPanelSaveName;

})(window);
