# Bug Fix List — v11

Only bugs actually found in the shipped code are listed (per the brief: no invented hypotheticals). Each was located by static scan + jsdom runtime, fixed, and covered by the test suites where practical.

**#1 — Unescaped user-settable name in three modals (XSS).**
`js/render-home.js` (ROW-issue modal ~line 679, add-milestone ~1063, edit-milestone ~1103) interpolated `${cu.name}`/`${cu.role}` into `innerHTML` without `esc()`. `cu.name` is user-settable via `auth.setMyName()` (length-capped but not sanitized), so a display name like `<img src=x onerror=…>` would execute for that user. Found by an automated regex scan for interpolated `innerHTML` sites missing `esc(` (the rest of the codebase — 100+ sites — was already escaped). Fixed with `esc()`. The equivalent check for the NEW modules is asserted in `tools/test-new-modules.js` ("vendor name is HTML-escaped").

**#2 — Duplicate `toggleTheme` (dead code + misleading).**
`render-misc.js:2006` defined a second `toggleTheme` that set `data-theme=''` (an invalid state) and updated only the sidebar icon. `advanced.js` loads *after* it (index.html script order) so this version could never run — pure dead code that would mislead maintenance. Removed with an explanatory comment.

**#3 — Duplicate `exportExcel` (~45 lines dead).**
Same shadowing pattern: `render-misc.js:2016` built a KPI CSV, but `advanced.js:230` redefines `exportExcel` as a wrapper over `exportToCSV`, and loads later. The sidebar's `exportExcel()` always hit the advanced.js version. Dead copy removed; behavior unchanged.

**#4 — Triple-defined 66kV table helpers.**
`render-bop.js:792-794` defined `toggle66TowerTable`/`show66TowerTable`/`show66Vendor`, all shadowed by the canonical definitions at ~line 927 in the same file. First trio removed.

**#5 — Sidebar theme icon never flipped.**
The sidebar "Theme" item's `th-i` icon showed 🌙 forever because the live `toggleTheme` (advanced.js) only updated the topbar orb. Now updates both.

**#6 — Double login on Enter.**
`loader.js:62` attached a second Enter-key handler calling `doLogin()`, while `views/login.html` already wires `onkeydown → auth.doLoginForm()` on the same input. Pressing Enter fired sign-in twice (two auth round-trips in firebase mode). Duplicate listener removed.

**#7 — PO history key collision (found in the NEW code by the test suite).**
`updatePOStatus` originally keyed history rows by bare `Date.now()`; two transitions inside the same millisecond overwrote each other (caught by `test-new-modules.js`'s scripted approve→deliver→close). Keys are now `ts_rand4` with the timestamp stored in the row.

**Not changed (reviewed, judged working):** the remaining ~180 `innerHTML=` sites either contain no interpolation, interpolate only code-owned constants (activity definitions, ids), or already pass user fields through `esc()`/`safeHTML()` — consistent with the incremental-migration policy in ARCHITECTURE.md §6.
