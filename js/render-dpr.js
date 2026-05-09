'use strict';
// =============================================================
//  render-dpr.js  (v10) — Daily Progress Report bullet view
//
//  Auto-generated from POD data; no separate entry form.
//  Format per spec:
//      14:32 · Solar · Pile Drilling · 50 units
//
//  Shows today + yesterday, grouped by date, newest first per group.
// =============================================================

(function (global) {

  const MODULE_LABEL = { s: 'Solar', w: 'WTG', l: 'Land', b: 'BOP' };
  const MODULE_COLOR = { s: 'var(--so,#ffb74d)', w: 'var(--wt,#64b5f6)', l: 'var(--ln,#a1887f)', b: 'var(--bo,#ba68c8)' };

  function _todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth()+1).padStart(2,'0') + '-' +
           String(d.getDate()).padStart(2,'0');
  }

  function _yesterdayISO() {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' +
           String(d.getMonth()+1).padStart(2,'0') + '-' +
           String(d.getDate()).padStart(2,'0');
  }

  function _formatTime(ts) {
    if (!ts) return '--:--';
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function _formatDateLabel(iso) {
    const today = _todayISO(), y = _yesterdayISO();
    if (iso === today) return 'Today (' + iso + ')';
    if (iso === y)     return 'Yesterday (' + iso + ')';
    return iso;
  }

  function _gather() {
    // Pull from DB.pod (already hydrated by legacy-shim across today+yesterday)
    const all = [];
    ['s','w','l','b'].forEach(m => {
      (DB.pod[m] || []).forEach(e => {
        all.push({ ...e, module: m });
      });
    });
    // Group by date
    const byDate = {};
    all.forEach(e => {
      const d = e.date || _todayISO();
      (byDate[d] = byDate[d] || []).push(e);
    });
    // Sort each group newest-first
    Object.keys(byDate).forEach(d => byDate[d].sort((a,b)=>(b.ts||0)-(a.ts||0)));
    return byDate;
  }

  function rndrDPR() {
    const el = document.getElementById('view-dpr');
    if (!el) return;

    const byDate = _gather();
    const dates = Object.keys(byDate).sort().reverse(); // today first

    // Build the page using safe DOM construction (esc + el from dom.js)
    const root = el.querySelector('.view-content') || el;
    mount(root);

    // Header card
    const header = el2div('pnl', { style: 'position:relative;margin-bottom:12px;' },
      el('div', { class: 'ph2' },
        el('div', { class: 'pt' }, '📋 Daily Progress Report'),
        el('div', { style: 'display:flex;gap:8px;align-items:center;font-size:9px;color:var(--t3);' },
          el('span', null, 'Auto-generated from POD entries'),
          el('span', { id: 'dpr-count', class: 'chip cg', style:'font-size:8px;' }, '0 entries')
        )
      ),
      el('div', { class: 'al al-i', style:'margin-bottom:0;font-size:9px;' },
        'ℹ️ This page is built automatically from Plan-of-Day entries. Add entries via the POD page; they will appear here as bullets in real time. Showing today + yesterday.'
      )
    );
    root.appendChild(header);

    let totalCount = 0;

    if (!dates.length || dates.every(d => !byDate[d].length)) {
      root.appendChild(
        el2div('pnl', { style: 'text-align:center;padding:30px;color:var(--t3);font-size:11px;' },
          el('div', { style: 'font-size:24px;margin-bottom:8px;' }, '📭'),
          el('div', null, 'No POD entries yet for today or yesterday.'),
          el('button', {
            class: 'btn bta',
            style: 'margin-top:14px;',
            onClick: () => nav('pod')
          }, '→ Go to POD page')
        )
      );
    } else {
      dates.forEach(date => {
        const entries = byDate[date] || [];
        if (!entries.length) return;
        totalCount += entries.length;

        const card = el2div('pnl', { style:'margin-bottom:10px;' });
        // Date heading
        card.appendChild(el('div', {
          class: 'ph2',
          style: 'border-bottom:1px solid var(--b2);padding-bottom:6px;margin-bottom:8px;'
        },
          el('div', { class: 'pt', style: 'font-size:12px;' }, _formatDateLabel(date)),
          el('span', { class: 'chip cg', style: 'font-size:8px;' }, entries.length + ' entries')
        ));

        // Per-module sub-counts
        const counts = entries.reduce((a, e) => { a[e.module] = (a[e.module]||0)+1; return a; }, {});
        const sub = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;' });
        Object.entries(counts).forEach(([m, c]) => {
          sub.appendChild(el('span', {
            class: 'chip',
            style: 'font-size:8px;background:var(--card3);color:'+MODULE_COLOR[m]+';border:1px solid '+MODULE_COLOR[m]+'33;'
          }, MODULE_LABEL[m] + ': ' + c));
        });
        card.appendChild(sub);

        // Bullet list
        const ul = el('ul', { style:'list-style:none;padding:0;margin:0;' });
        entries.forEach(e => {
          ul.appendChild(_renderBullet(e));
        });
        card.appendChild(ul);
        root.appendChild(card);
      });
    }

    const counter = document.getElementById('dpr-count');
    if (counter) counter.textContent = totalCount + ' entries';

    // Refresh-on-edit: render a small re-sync indicator
    const ts = el('div', {
      style:'text-align:center;color:var(--t3);font-size:8px;margin-top:14px;'
    }, '🔄 Updates live as POD entries are added on any device · Last refresh ' +
       new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' }));
    root.appendChild(ts);
  }

  function _renderBullet(e) {
    const time = _formatTime(e.ts);
    const mod = MODULE_LABEL[e.module] || e.module;
    const qtyStr = e.qty ? (Number(e.qty).toLocaleString() + (e.unit ? ' ' + e.unit : ' units')) : '—';

    const li = el('li', {
      style: 'display:flex;gap:9px;align-items:flex-start;padding:7px 9px;border-radius:6px;'+
             'background:var(--card3);border:1px solid var(--b2);margin-bottom:5px;font-size:10px;'+
             'border-left:3px solid '+MODULE_COLOR[e.module]+';'
    });

    // Bullet dot
    li.appendChild(el('span', {
      style:'color:'+MODULE_COLOR[e.module]+';font-weight:700;flex-shrink:0;line-height:1.4;'
    }, '•'));

    // Main line: Time · Module · Activity · Qty
    const mainLine = el('div', { style:'flex:1;line-height:1.45;' },
      el('span', { style:'color:var(--t2);font-family:monospace;font-weight:600;' }, time),
      el('span', { style:'color:var(--t3);margin:0 5px;' }, '·'),
      el('span', { style:'color:'+MODULE_COLOR[e.module]+';font-weight:600;' }, mod),
      el('span', { style:'color:var(--t3);margin:0 5px;' }, '·'),
      el('span', { style:'color:var(--t1);' }, e.activity || '(no activity)'),
      el('span', { style:'color:var(--t3);margin:0 5px;' }, '·'),
      el('span', { style:'color:var(--t1);font-weight:600;' }, qtyStr)
    );
    li.appendChild(mainLine);

    return li;
  }

  // small helper: wraps el(div, {class}) with the class merge
  function el2div(cls, attrs, ...kids) {
    const merged = Object.assign({}, attrs || {}, { class: ((attrs||{}).class ? cls+' '+attrs.class : cls) });
    return el('div', merged, ...kids);
  }

  global.rndrDPR = rndrDPR;

})(window);
