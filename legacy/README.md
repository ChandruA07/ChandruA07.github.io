# legacy/ — pre-migration Firebase artefacts (kept for rollback + diffing)

| File | Was | Replaced by |
|---|---|---|
| firebase.js.bak | Firebase bootstrap (fbDB/fbStorage) | js/supabase-config.js + js/supabase-init.js |
| data-api.firebase.js.bak | RTDB write layer | js/data-api.js (Supabase) |
| realtime.firebase.js.bak | RTDB listeners | js/realtime.js (postgres_changes) + js/shape-map.js |
| auth.firebase.js.bak | Firebase Auth | js/auth.js (Supabase Auth) |
| storage.firebase.js.bak | Firebase Storage | js/storage.js (Supabase Storage) + sql/storage-buckets.sql |
| test-new-modules.firebase.js.bak | v11 suite (RTDB stub) | tools/test-new-modules.js (real Postgres) |
| database.rules.json | RTDB security rules | sql/rls-policies.sql (+ tools/test-rls.sh) |
| firebase.json | Firebase Hosting/DB config | docs/supabase/DEPLOYMENT.md |
| firebase-seed.json | RTDB seed (kept at repo root too — it is the INPUT to tools/convert-seed.py) | sql/seed.sql |

Rollback plan: see docs/supabase/DEPLOYMENT.md §Rollback — the pre-migration
ZIP redeploys as-is; nothing in this migration touched the Firebase project.
