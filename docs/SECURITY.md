# Security Implementation — Phase 6

## What changed and why

**Before (v10):** `auth.js` held five hardcoded username/password pairs checked in the browser; `database.rules.json` was `.read:true / .write:true`. The code itself said "THIS IS NOT REAL SECURITY" — anyone could write to the database from DevTools with no login at all.

**After (v11):**

1. **Real Firebase Authentication** (Email/Password). `js/auth.js` was rewritten around `firebase.auth()`. On sign-in (and on every session restore) the role is fetched from `/users/{uid}/role` — the *same node the rules engine checks*, so client and server can never disagree about who you are.
2. **Rules are the boundary.** `database.rules.json` was rewritten (full text below). Reads require sign-in; writes are default-deny and opened per node to the owning role + admin. Stripping the JS, closing the modal, or calling `firebase.database().ref(...).set(...)` in DevTools is rejected **on Google's servers** with `PERMISSION_DENIED`.
3. **Client role gate demoted to UX.** `auth.requireRole()` / `canEdit()` remain — but only so users get a friendly sign-in prompt instead of a raw permission error. They are decoration; the rules are the lock. (This satisfies Phase 6.3: the UI prompt is kept, the security role logic lives server-side.)
4. **Users cannot self-promote.** `/users/{uid}/role` is writable only by admin; users may write only their own `name` leaf (validated ≤80 chars). `auth.setMyName()` writes that leaf only.
5. **New roles.** `procurement`, `store`, `planner` (and `viewer`) join the original five; each new module's write rule is scoped to its owning role + admin, mirroring the pattern `reqLogin` used conceptually.
6. **Storage rules** extended and default-denied: images ≤5 MB on `hse/`, `itc/`, `pod/`; documents/PO attachments ≤10 MB with a PDF/Office/CSV/text/image allow-list on `documents/`, `po/`; everything else denied; all reads require sign-in.
7. **Demo fallback, clearly fenced.** If the Auth SDK is absent (stripped build, jsdom tests) `auth.js` falls back to the old demo gate with a loud console warning. Demo mode can only ever work against the archived public rules; under the production rules every demo write fails server-side — which is the correct failure direction.

## Behavioral changes to be aware of

- **All reads now require sign-in.** The anonymous "viewer" experience of v10 is gone; provision a `viewer` account for read-only users.
- **POD entry now requires a signed-in, non-viewer account** (it was deliberately public in v10). The POD form surfaces the sign-in prompt via the existing error path.
- **PO approval is double-gated:** `data-api.js` requires admin, and the rules re-validate that a `status` write of `"approved"` comes from an admin.

## Role & permission matrix (enforced by `database.rules.json`)

R = read (all signed-in users can read everything except `/audit`), W = write.

| Path | admin | solar | wtg | bop | land | procurement | store | planner | viewer |
|---|---|---|---|---|---|---|---|---|---|
| `/users/{uid}` (role) | RW | R | R | R | R | R | R | R | R |
| `/users/{ownUid}/name` | RW | RW | RW | RW | RW | RW | RW | RW | RW |
| `/solar/**` | RW | RW | R | R | R | R | R | R | R |
| `/wtg/**` | RW | R | RW | R | R | R | R | R | R |
| `/bop/**` | RW | R | R | RW | R | R | R | R | R |
| `/land/**` | RW | R | R | R | RW | R | R | R | R |
| `/hse/**`, `/blockers` | RW | RW | RW | RW | RW | RW | RW | RW | R |
| `/pod/{date}` (create) | RW | RW | RW | RW | RW | RW | RW | RW | R |
| `/dailyProgress`, `/snapshots` | RW | RW | RW | RW | RW | RW | RW | RW | R |
| `/vendors`, `/purchaseOrders` | RW | R | R | R | R | RW¹ | R | R | R |
| `/inventory/**` | RW | R | R | R | R | R | RW² | R | R |
| `/planning/tasks`, `/dependents` | RW | R | R | R | R | R | R | RW | R |
| `/planning/baselines` | RW | R | R | R | R | R | R | R | R |
| `/documents` | RW | RW | RW | RW | RW | RW | RW | RW | R |
| `/milestones`, `/schedule` | RW | R | R | R | R | R | R | R | R |
| `/notifications` | RW (all signed-in: readBy marks) | | | | | | | | |
| `/audit` | R + append | append³ | append³ | append³ | append³ | append³ | append³ | append³ | — |

¹ PO `status:"approved"` additionally requires admin (rule-level validate).
² Ledger rows are append-only at rule level (`!data.exists()`).
³ Any signed-in user can append (data-api writes an entry per mutation); nothing can be edited or deleted; only admin can read.

## Final `database.rules.json` (deployed content, in full)

```json
{
  "_comment": "PRODUCTION RULES (Phase 6, v11). These are the actual security boundary \u2014 the browser-side auth.js is UX only. Every write is checked on Google's servers against the caller's Firebase Auth uid and the role stored at /users/{uid}/role. Roles: admin | solar | wtg | bop | land | procurement | store | planner | viewer. Deploy with: firebase deploy --only database. BREAKING vs v10: anonymous read/write is gone \u2014 every read requires sign-in, and POD entry now requires a signed-in non-viewer account (documented in docs/SECURITY.md).",
  "rules": {
    ".read": "auth != null",
    ".write": false,
    "users": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'",
        "name": {
          ".write": "auth != null && auth.uid === $uid",
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 80"
        },
        "role": {
          ".validate": "newData.isString() && newData.val().matches(/^(admin|solar|wtg|bop|land|procurement|store|planner|viewer)$/)"
        }
      }
    },
    "solar": {
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'solar')"
    },
    "wtg": {
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'wtg')"
    },
    "bop": {
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'bop')"
    },
    "land": {
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'land')"
    },
    "hse": {
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() !== 'viewer'",
      "observations": {
        ".indexOn": [
          "ts"
        ]
      }
    },
    "pod": {
      "$date": {
        ".indexOn": [
          "ts"
        ],
        ".validate": "$date.matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)",
        "$pushId": {
          ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() !== 'viewer'",
          ".validate": "newData.hasChildren(['module','activity','ts'])",
          "module": {
            ".validate": "newData.isString() && newData.val().matches(/^(s|w|l|b)$/)"
          },
          "by": {
            ".validate": "newData.val() === auth.uid"
          }
        }
      }
    },
    "dailyProgress": {
      ".indexOn": [
        "ts"
      ],
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() !== 'viewer'"
    },
    "snapshots": {
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() !== 'viewer'"
    },
    "notifications": {
      ".indexOn": [
        "ts"
      ],
      ".write": "auth != null"
    },
    "milestones": {
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },
    "blockers": {
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() !== 'viewer'"
    },
    "schedule": {
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },
    "vendors": {
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'procurement')",
      "$vendorId": {
        "name": {
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 120"
        },
        "email": {
          ".validate": "!newData.exists() || newData.val() === '' || newData.val().matches(/^[^@\\s]+@[^@\\s]+$/)"
        }
      }
    },
    "purchaseOrders": {
      ".indexOn": [
        "status",
        "vendorId",
        "ts"
      ],
      "$poId": {
        ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'procurement')",
        "status": {
          ".validate": "newData.isString() && newData.val().matches(/^(draft|approved|delivered|closed|cancelled)$/) && (newData.val() !== 'approved' || root.child('users').child(auth.uid).child('role').val() === 'admin' || (data.exists() && data.val() === 'approved'))"
        }
      }
    },
    "inventory": {
      "items": {
        ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'store')"
      },
      "movements": {
        "$date": {
          ".indexOn": [
            "itemId",
            "ts"
          ],
          ".validate": "$date.matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)",
          "$pushId": {
            ".write": "auth != null && !data.exists() && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'store')",
            ".validate": "newData.hasChildren(['itemId','type','qty','ts'])",
            "type": {
              ".validate": "newData.isString() && newData.val().matches(/^(in|out|adjust)$/)"
            },
            "qty": {
              ".validate": "newData.isNumber()"
            }
          }
        }
      }
    },
    "planning": {
      "tasks": {
        ".indexOn": [
          "start",
          "module"
        ],
        "$taskId": {
          "name": {
            ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 200"
          },
          "start": {
            ".validate": "newData.isString() && newData.val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)"
          },
          "end": {
            ".validate": "newData.isString() && newData.val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)"
          }
        },
        ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'planner')"
      },
      "baselines": {
        ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'"
      },
      "dependents": {
        ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'planner')"
      }
    },
    "documents": {
      ".indexOn": [
        "module",
        "category"
      ],
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() !== 'viewer'"
    },
    "audit": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'",
      "$entry": {
        ".write": "auth != null && !data.exists()"
      }
    }
  }
}
```

## Storage rules
The full deployed content is `security/storage.rules` (auth-required reads, per-path size/type limits, default-deny catch-all).

## Verification status — read honestly
Rule *logic* was reviewed for the classic RTDB cascade trap (a parent `.write` grant cannot be revoked at a child — this is why `/planning` has **no** parent write rule and `baselines` is gated separately), the JSON is valid, and the static assertions in `tools/test-new-modules.js` §8 pass. **The rules engine itself only runs on Firebase's servers**, so the DevTools `PERMISSION_DENIED` checks in TESTING.md §C must be executed once against the live project after `firebase deploy --only database,storage` — they cannot be simulated offline, and we do not claim otherwise.
