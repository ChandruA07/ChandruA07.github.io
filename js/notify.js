'use strict';
// =============================================================
//  notify.js — WhatsApp-style notification layer
//
//  • dataApi writers push records to /notifications (push ids):
//      { module, action, desc, byName, ts, readBy:{uid:true} }
//  • This file renders a 🔔 bell in the topbar with a live
//    unread badge, and a slide-in panel listing the last 50
//    notifications newest-first, styled like a WhatsApp chat
//    list (module colour stripe | description | time).
//  • child_added / child_changed listeners → new notifications
//    appear at the top of the panel instantly, on every device.
//  • Role filtering: admins see everything; module-scoped users
//    (solar / wtg / bop / land) see their module + general + hse.
//  • "Mark as read" writes readBy/{uid}=true to Firebase, and a
//    localStorage mirror keeps the badge correct for anonymous
//    viewers (who share the 'anon' uid).
// =============================================================

(function (global) {

  const MAX_ITEMS = 50;
  const _items = new Map();       // id -> record
  let _panelOpen = false;
  let _started = false;
  const LS_KEY = 'swppl_notif_read_v1';

  // ── local read-state mirror (works even for anonymous users) ──
  function _localRead() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return {}; }
  }
  function _markLocalRead(id) {
    try {
      const m = _localRead(); m[id] = 1;
      const keys = Object.keys(m);
      if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(k => delete m[k]);
      localStorage.setItem(LS_KEY, JSON.stringify(m));
    } catch (e) {}
  }

  function _me()  { return (global.auth && auth.current && auth.current()) || { uid: 'anon', name: 'Anonymous', role: 'viewer' }; }
  function _role(){ return (_me().role || 'viewer').toLowerCase(); }
  function _uid() { return _me().uid || 'anon'; }

  // Which modules this role is allowed to see
  function _visible(rec) {
    const r = _role();
    if (r === 'admin' || r === 'viewer' || r === 'manager') return true;     // admins + read-only viewers see all
    const m = (rec.module || 'general').toLowerCase();
    if (m === 'general' || m === 'hse') return true;                          // safety + general are everyone's business
    return m === r;                                                           // solar/wtg/bop/land scoped
  }

  function _isRead(rec, id) {
    if (rec.readBy && rec.readBy[_uid()]) return true;
    return !!_localRead()[id];
  }

  const MOD_COLOR = {
    solar: 'var(--sol,#ffca28)', wtg: 'var(--wtg,#4fc3f7)', bop: 'var(--bop,#ab47bc)',
    land:  'var(--ok,#66bb6a)',  hse: 'var(--er,#ff5252)',  general: 'var(--ac,#1565c0)'
  };
  const MOD_LABEL = { solar:'Solar', wtg:'WTG', bop:'BOP', land:'Land', hse:'HSE', general:'General' };

  function _fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts), now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return hm;
    return d.toLocaleDateString([], { day: '2-digit', month: 'short' }) + ' ' + hm;
  }

  // ── badge ──
  function _refreshBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    let unread = 0;
    _items.forEach((rec, id) => { if (_visible(rec) && !_isRead(rec, id)) unread++; });
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }

  // ── panel ──
  function _renderPanel() {
    const list = document.getElementById('notif-list');
    if (!list) return;
    const rows = [...(_items.entries())]
      .filter(([id, rec]) => _visible(rec))
      .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0))
      .slice(0, MAX_ITEMS);

    if (!rows.length) {
      mount(list, el('div', { class: 'notif-empty' }, 'No notifications yet. POD submissions, progress updates, HSE observations and blockers will appear here live.'));
      return;
    }

    const nodes = rows.map(([id, rec]) => {
      const read = _isRead(rec, id);
      const col = MOD_COLOR[(rec.module || 'general').toLowerCase()] || MOD_COLOR.general;
      const row = el('div', { class: 'notif-item' + (read ? '' : ' unread') },
        el('div', { class: 'notif-stripe', style: { background: col } }),
        el('div', { class: 'notif-body' },
          el('div', { class: 'notif-top' },
            el('span', { class: 'notif-mod', style: { color: col } }, MOD_LABEL[(rec.module || 'general').toLowerCase()] || rec.module),
            el('span', { class: 'notif-action' }, rec.action || ''),
            el('span', { class: 'notif-time' }, _fmtTime(rec.ts))
          ),
          el('div', { class: 'notif-desc' }, rec.desc || ''),
          el('div', { class: 'notif-by' }, '👤 ' + (rec.byName || 'Anonymous'),
            read ? null : el('button', {
              class: 'notif-read-btn',
              onclick: (e) => { e.stopPropagation(); markRead(id); }
            }, '✓ Mark as read'))
        )
      );
      if (!read) row.addEventListener('click', () => markRead(id));
      return row;
    });
    mount(list, nodes);
  }

  function markRead(id) {
    if (typeof id === 'string' && id.indexOf('pod-') === 0) return;   // synthetic fallback item, no DB record
    _markLocalRead(id);
    try { dataApi.markNotificationRead(id); } catch (e) {}
    const rec = _items.get(id);
    if (rec) { rec.readBy = rec.readBy || {}; rec.readBy[_uid()] = true; }
    _refreshBadge(); _renderPanel();
  }

  function markAllRead() {
    _items.forEach((rec, id) => { if (_visible(rec) && !_isRead(rec, id)) markRead(id); });
  }

  function togglePanel(force) {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    _panelOpen = force !== undefined ? !!force : !_panelOpen;
    panel.classList.toggle('open', _panelOpen);
    if (_panelOpen) _renderPanel();
  }

  // ── DOM bootstrap: bell + panel (injected so topbar.html stays slim) ──
  function _injectUI() {
    if (document.getElementById('notif-bell')) return;
    const tbr = document.querySelector('#tb .tbr');
    if (!tbr) return;

    const bell = el('button', {
      id: 'notif-bell', class: 'btn bts', 'data-tt': 'Live notifications — POD, progress, HSE, blockers',
      onclick: () => togglePanel()
    }, '🔔', el('span', { id: 'notif-badge', class: 'notif-badge', style: { display: 'none' } }, '0'));
    tbr.insertBefore(bell, tbr.firstChild);

    const panel = el('div', { id: 'notif-panel' },
      el('div', { class: 'notif-head' },
        el('span', { style: { fontWeight: '800', fontSize: '12px' } }, '🔔 Live Notifications'),
        el('div', { style: { display: 'flex', gap: '6px' } },
          el('button', { class: 'btn bts', style: { fontSize: '9px' }, onclick: markAllRead }, '✓✓ Mark all read'),
          el('button', { class: 'btn bts', style: { fontSize: '9px' }, onclick: () => togglePanel(false) }, '✕')
        )
      ),
      el('div', { id: 'notif-list', class: 'notif-list' })
    );
    document.body.appendChild(panel);

    // click-outside closes
    document.addEventListener('click', (e) => {
      if (!_panelOpen) return;
      const p = document.getElementById('notif-panel');
      const b = document.getElementById('notif-bell');
      if (p && !p.contains(e.target) && b && !b.contains(e.target)) togglePanel(false);
    });
  }

  // ── Topbar ticker REMOVED (v10.14) ─────────────────────────
  // Live updates now scroll in the header hero marquee (render-home.js
  // renderHeroMarquee). Only the bell + history panel remain here.
  // Backlog gate kept for the "new event" ping on the bell badge.
  let _bootAt = Date.now();
  let _backlogDone = false;
  setTimeout(() => { _backlogDone = true; }, 4000);

  // ── Supabase realtime listener (shape unchanged: {kind,id,val}) ──
  function _startListeners() {
    if (_started || !window.realtime || !realtime.listenNotifications) return;
    _started = true;
    realtime.listenNotifications(evt => {
      if (evt.kind === 'remove') _items.delete(evt.id);
      else _items.set(evt.id, evt.val || {});
      _refreshBadge();
      if (_panelOpen) _renderPanel();
    }, MAX_ITEMS);
  }

  function _boot() {
    // topbar mounts asynchronously via loader.js — poll briefly
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (document.querySelector('#tb .tbr')) {
        clearInterval(t);
        _injectUI();
        _startListeners();
      } else if (tries > 100) clearInterval(t);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();

  global.notify = { togglePanel, markRead, markAllRead,
    refresh: () => { _refreshBadge(); _renderPanel(); } };

})(window);
