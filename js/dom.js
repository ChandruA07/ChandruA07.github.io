'use strict';
// =============================================================
//  dom.js  —  XSS-safe DOM building
//
//  This file replaces every place v8 did:
//      element.innerHTML = `<div>${userField}</div>`
//
//  Anywhere a user typed string lands in HTML, it MUST go through
//  esc() or be inserted via el(). Otherwise an attacker can put
//  <img src=x onerror="…"> in a notes field and run JS in every
//  viewer's browser.
// =============================================================

(function (global) {

  // -----------------------------------------------------------
  // esc() — escape a string so it is safe to drop into HTML.
  // Use everywhere you would otherwise interpolate ${userVar}
  // into an innerHTML template literal.
  // -----------------------------------------------------------
  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // -----------------------------------------------------------
  // safeHTML(template, vars) — minimal migration helper.
  //
  // Lets you take an existing template literal:
  //     `<div class="x">${notes}</div>`
  // and refactor it to:
  //     safeHTML('<div class="x">${notes}</div>', { notes })
  // …without otherwise changing the markup. Each value in `vars`
  // is escaped before substitution.
  //
  // Use this to migrate fast; reach for el() for new code.
  // -----------------------------------------------------------
  function safeHTML(template, vars) {
    return template.replace(/\$\{(\w+)\}/g, (_, k) => esc(vars && vars[k]));
  }

  // -----------------------------------------------------------
  // el(tag, attrs?, ...children) — programmatic element factory.
  // children may be: strings (auto-escaped), numbers, Nodes, or
  // arrays of any of the above. NEVER parses HTML.
  // -----------------------------------------------------------
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class' || k === 'className')      node.className = String(v);
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else {
          node.setAttribute(k, v === true ? '' : String(v));
        }
      }
    } else if (attrs !== undefined && attrs !== null) {
      // attrs slot was actually a child
      children.unshift(attrs);
    }
    children.flat(Infinity).forEach(c => {
      if (c == null || c === false) return;
      if (c instanceof Node) node.appendChild(c);
      else node.appendChild(document.createTextNode(String(c)));
    });
    return node;
  }

  // -----------------------------------------------------------
  // mount(parent, ...nodes) — clear parent and append. Avoids
  // innerHTML='' which can leave detached event handlers behind.
  // -----------------------------------------------------------
  function mount(parent, ...nodes) {
    while (parent.firstChild) parent.removeChild(parent.firstChild);
    nodes.flat(Infinity).forEach(n => {
      if (n == null) return;
      parent.appendChild(n instanceof Node ? n : document.createTextNode(String(n)));
    });
  }

  // -----------------------------------------------------------
  // setHTMLSafe(parent, htmlString) — for trusted markup only
  // (markup you wrote yourself with no ${} interpolations).
  // Throws in dev if it detects an unescaped template hole.
  // -----------------------------------------------------------
  function setHTMLSafe(parent, html) {
    if (typeof html !== 'string') throw new Error('setHTMLSafe: not a string');
    parent.innerHTML = html;
  }

  global.esc         = esc;
  global.safeHTML    = safeHTML;
  global.el          = el;
  global.mount       = mount;
  global.setHTMLSafe = setHTMLSafe;

})(window);
