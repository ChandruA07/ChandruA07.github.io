# SWPPL v9 — Public Dashboard + Email/Password Auth

This pass implements the requested architecture:

- **Public dashboard** — no login required to view
- **Email/password login** required only for editing
- **Role-based access control** — viewer / solar / wtg / bop / admin
- **Firebase Realtime DB** with `onValue()` real-time updates
- **No localStorage** for project data

---

## What changed in this pass

### 🔓 Anonymous auth removed → email/password only

- **`js/auth.js`** rewritten:
  - No more `signInAnonymously()`, no `_ensureSignedIn()` boot routine.
  - New `auth.login(email, password)` wrapping `signInWithEmailAndPassword`.
  - New `auth.logout()` wrapping `signOut`.
  - `onAuthStateChanged` no longer triggers re-sign-in when user is null;
    being logged-out is now a valid steady state.
  - `auth.canEdit(section)` exposed as the canonical permission check
    (matches the truth table in the prompt).

### 👁 Public dashboard — no auth wall

- App boots straight into the home view. Listeners in `state-bridge.js`
  hydrate data without needing a signed-in user, because:
- **`security/rules.json`** root rule changed to `".read": "true"` so
  everyone can read project data.
- `/users` is private — only admin can list users; an individual user
  can read their own record. (Rule: `auth.uid === $uid || admin`.)
- `/audit` stays admin-only.

### 🔐 Login UI

- **`views/login.html`** — clean email/password form with Cancel / Sign In.
- **`views/topbar.html`** — three-button auth bar:
  - **🔓 Login** — visible when signed out
  - **👤 Name · role** — opens User Panel (visible when signed in)
  - **🚪 Logout** — visible when signed in
- Auth bar is wired by `js/user-panel.js → _refreshAuthBar()`, which
  subscribes to `auth.onChange()`.

### 🛡 Role gating

- `auth.canEdit(section)` is the new canonical check (matches the
  prompt's truth table exactly):
  ```js
  canEdit('solar', 'solar') === true
  canEdit('solar', 'wtg')   === false
  canEdit('any',   'admin') === true
  canEdit('any',   'viewer')=== false
  ```
- Existing renderers (`render-wtg.js`, `render-solar.js`,
  `render-home.js`, etc.) already use `CU.role === 'wtg'` / `'solar'` /
  `'all'` (legacy admin alias) for input gating with `disabled`
  attributes. `state-bridge.js` continues to populate `CU` from
  `auth.current()`. No render code change needed.
- For brand-new code, prefer `auth.canEdit(section)` over reading `CU`.

### 🛂 First admin bootstrap (manual, one-time)

The previous "first user becomes admin" rule is gone — it doesn't
make sense with email/password (anyone could create an account and
race for admin). The first admin must be seeded manually:

1. **Firebase Console → Authentication → Users → Add user**
   (email + password).
2. **Firebase Console → Realtime Database → Data**, manually create:
   ```
   /users/<that-uid>/role = "admin"
   /users/<that-uid>/name = "Site Manager"
   ```
3. From now on, the admin assigns roles via the in-app User Panel.

This is documented in the login modal as well.

### 🗑 localStorage purged

Already done in the previous pass; preserved here. Only
`swppl_theme` (UI dark/light toggle) remains in localStorage —
that's not project data.

---

## Files touched in this pass

| File | Change |
|---|---|
| `js/auth.js` | rewritten — email/password, no anon, `canEdit()` |
| `js/user-panel.js` | new auth bar wiring + `authLogoutClick` |
| `views/login.html` | email/password form |
| `views/topbar.html` | 3-button auth bar (Login / User / Logout) |
| `security/rules.json` | public root read; `/users` admin-readable; role-validate |

All 21 JS files pass `node --check`; `security/rules.json` parses as
valid JSON.

---

## Security posture

| Resource          | Read              | Write                                              |
|-------------------|-------------------|----------------------------------------------------|
| `/` (root)        | **public**        | denied                                             |
| `/solar`          | public            | admin or solar (leaf-validated)                    |
| `/wtg`            | public            | admin or wtg (leaf-validated)                      |
| `/bop`            | public            | admin or bop                                       |
| `/land`           | public            | admin only                                         |
| `/hse`            | public            | not viewer (`by` = `auth.uid` enforced)            |
| `/pod/{date}`     | public            | not viewer (date format + `by` validated)          |
| `/milestones`     | public            | admin / solar / wtg / bop                          |
| `/rowIssues`      | public            | not viewer (enum-validated)                        |
| `/ganttRows`      | public            | admin only                                         |
| `/dailyProgress`  | public            | not viewer                                         |
| `/blockers`       | public            | not viewer                                         |
| `/schedule`       | public            | admin only                                         |
| `/users`          | admin only        | admin (self-update on `name` for own record)       |
| `/users/{uid}`    | self or admin     | admin (or self for `name`/`email`)                 |
| `/audit`          | admin only        | append-only, signed `by` = `auth.uid`              |

Public read on project data is intentional — that's the requested model.
Anyone can browse to the URL and see live progress. Editing requires
both a signed-in account *and* the matching role.

---

## How a typical session works

1. **Visitor** opens the URL → sees live dashboard immediately, no login,
   real-time updates fan in via `realtime.*` listeners.
2. **Solar In-charge** clicks an editable activity → `reqLogin('solar', ...)`
   opens the login modal → enters email/password →
   `signInWithEmailAndPassword()` → `auth.js` loads role from
   `/users/{uid}` → `CU` becomes `{role:'solar', name:'…'}` → the
   pending edit runs.
3. **Site Manager** opens the User Panel → sees all users → changes a
   role from a dropdown → `dataApi.adminAssignRole(uid, role)` writes
   to `/users/{uid}/role` → that user's `auth.js` `/users/{uid}` watcher
   fires → their role updates live, no refresh needed.
4. Anyone clicks **🚪 Logout** → `signOut()` → `CU` becomes null →
   editable inputs across the app become `disabled` (banners reappear) →
   data still flows in via public listeners.
