'use strict';
// =====================================================================
//  supabase-mock.js — TEST-ONLY supabase-js v2 subset over local pg.
//
//  Implements exactly the query-builder surface js/data-api.js and
//  js/realtime.js use, translated to parameterized SQL against the
//  local Postgres that already ran sql/schema.sql (+seed, +rls).
//  This lets the automated suite run the REAL production data layer
//  against the REAL schema — no hosted Supabase needed.
//
//  Not implemented (not used by the app): or(), like(), range(),
//  csv(), auth flows (tests use a role mock), storage (stubbed).
// =====================================================================
const { Pool, types } = require('pg');

// PostgREST/Supabase return dates and timestamps as STRINGS; node-pg
// defaults to JS Date objects. Match Supabase so the production code
// under test sees identical value types.
types.setTypeParser(1082, v => v);                                   // date  → 'YYYY-MM-DD'
types.setTypeParser(1114, v => new Date(v + 'Z').toISOString());     // timestamp
types.setTypeParser(1184, v => new Date(v).toISOString());           // timestamptz

function createMock(connString) {
  const pool = new Pool({ connectionString: connString });
  const jsonCols = {};   // table → Set(colName) of json/jsonb columns

  async function loadJsonCols(table) {
    if (jsonCols[table]) return jsonCols[table];
    const r = await pool.query(
      `select column_name from information_schema.columns
        where table_schema='public' and table_name=$1 and data_type in ('json','jsonb')`, [table]);
    return (jsonCols[table] = new Set(r.rows.map(x => x.column_name)));
  }

  function prep(table, row, jset) {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = (jset.has(k) && v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
    }
    return out;
  }

  // set per-request JWT claims (how PostgREST passes auth to RLS)
  let _claims = null;           // { sub, role } | null
  function setClaims(c) { _claims = c; }

  async function runSQL(text, values) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      if (_claims) {
        if (_claims.dbRole) await client.query('set local role ' + _claims.dbRole);
        await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [_claims.sub || '']);
      }
      const res = await client.query({ text, values });
      await client.query('commit');
      return res;
    } catch (e) {
      try { await client.query('rollback'); } catch (_) {}
      throw e;
    } finally {
      client.release();
    }
  }

  class Builder {
    constructor(table) {
      this.table = table;
      this._op = 'select'; this._cols = '*';
      this._filters = []; this._order = []; this._limit = null;
      this._payload = null; this._single = false; this._maybe = false;
      this._returning = null; this._onConflict = null; this._ignoreDup = false;
    }
    select(cols, _opts) {
      if (this._op === 'select') this._cols = cols || '*';
      else this._returning = cols || '*';
      return this;
    }
    insert(rows) { this._op = 'insert'; this._payload = Array.isArray(rows) ? rows : [rows]; return this; }
    update(obj)  { this._op = 'update'; this._payload = obj; return this; }
    upsert(rows, opts) {
      this._op = 'upsert';
      this._payload = Array.isArray(rows) ? rows : [rows];
      this._onConflict = (opts && opts.onConflict) || 'id';
      this._ignoreDup = !!(opts && opts.ignoreDuplicates);
      return this;
    }
    delete() { this._op = 'delete'; return this; }
    eq(col, v)  { this._filters.push([col, '=', v]);  return this; }
    neq(col, v) { this._filters.push([col, '<>', v]); return this; }
    gte(col, v) { this._filters.push([col, '>=', v]); return this; }
    lte(col, v) { this._filters.push([col, '<=', v]); return this; }
    gt(col, v)  { this._filters.push([col, '>', v]);  return this; }
    lt(col, v)  { this._filters.push([col, '<', v]);  return this; }
    in(col, arr){ this._filters.push([col, 'in', arr]); return this; }
    order(col, opts) { this._order.push(`"${col}" ${opts && opts.ascending === false ? 'desc' : 'asc'}`); return this; }
    limit(n) { this._limit = n; return this; }
    single()      { this._single = true; return this; }
    maybeSingle() { this._maybe  = true; return this; }

    async _exec() {
      const jset = await loadJsonCols(this.table);
      const vals = [];
      const P = v => { vals.push(v); return '$' + vals.length; };
      const where = () => this._filters.length
        ? ' where ' + this._filters.map(([c, op, v]) =>
            op === 'in'
              ? `"${c}" = any(${P(v)})`
              : `"${c}" ${op} ${P(v)}`).join(' and ')
        : '';
      let sql;
      if (this._op === 'select') {
        const cols = this._cols === '*' ? '*' : this._cols.split(',').map(c => `"${c.trim()}"`).join(',');
        sql = `select ${cols} from "${this.table}"` + where();
        if (this._order.length) sql += ' order by ' + this._order.join(', ');
        if (this._limit != null) sql += ` limit ${Number(this._limit)}`;
      } else if (this._op === 'insert' || this._op === 'upsert') {
        const rows = this._payload.map(r => prep(this.table, r, jset));
        const cols = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
        const tuples = rows.map(r => '(' + cols.map(c => c in r ? P(r[c]) : 'default').join(',') + ')').join(',');
        sql = `insert into "${this.table}" (${cols.map(c => `"${c}"`).join(',')}) values ${tuples}`;
        if (this._op === 'upsert') {
          const conflict = this._onConflict.split(',').map(c => `"${c.trim()}"`).join(',');
          sql += this._ignoreDup
            ? ` on conflict (${conflict}) do nothing`
            : ` on conflict (${conflict}) do update set ` +
              cols.filter(c => !this._onConflict.split(',').map(s => s.trim()).includes(c))
                  .map(c => `"${c}" = excluded."${c}"`).join(', ');
        }
        if (this._returning) sql += ' returning ' + (this._returning === '*' ? '*' : this._returning.split(',').map(c => `"${c.trim()}"`).join(','));
      } else if (this._op === 'update') {
        const row = prep(this.table, this._payload, jset);
        const sets = Object.entries(row).map(([c, v]) => `"${c}" = ${P(v)}`).join(', ');
        sql = `update "${this.table}" set ${sets}` + where();
        if (this._returning) sql += ' returning ' + this._returning;
      } else if (this._op === 'delete') {
        sql = `delete from "${this.table}"` + where();
        if (this._returning) sql += ' returning ' + this._returning;
      }
      try {
        const res = await runSQL(sql, vals);
        let data = res.rows;
        if (this._single || this._maybe) {
          if (this._single && data.length !== 1) {
            return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
          }
          data = data.length ? data[0] : null;
        }
        return { data, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message, code: e.code } };
      }
    }
    then(res, rej) { return this._exec().then(res, rej); }
    catch(rej) { return this._exec().catch(rej); }
  }

  const _channels = [];   // recording stub for realtime tests

  const client = {
    from: t => new Builder(t),
    rpc: async (name, params) => {
      params = params || {};
      const keys = Object.keys(params);
      const vals = [];
      const args = keys.map((k, i) => {
        const v = params[k];
        vals.push(v !== null && typeof v === 'object' ? JSON.stringify(v) : v);
        const cast = (v !== null && typeof v === 'object') ? '::jsonb' : '';
        return `${k} := $${i + 1}${cast}`;
      }).join(', ');
      try {
        const res = await runSQL(`select public.${name}(${args}) as result`, vals);
        return { data: res.rows.length ? res.rows[0].result : null, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message, code: e.code } };
      }
    },
    channel: (name) => {
      const chan = {
        name, handlers: [],
        on(_type, _spec, handler) { this.handlers.push(handler); return this; },
        subscribe(cb) { if (cb) cb('SUBSCRIBED'); return this; },
        // test hook: push a synthetic postgres_changes payload
        _emit(payload) { this.handlers.forEach(h => h(payload)); }
      };
      _channels.push(chan);
      return chan;
    },
    removeChannel: (chan) => {
      const i = _channels.indexOf(chan);
      if (i >= 0) _channels.splice(i, 1);
    },
    _channels,
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
      getSession: async () => ({ data: { session: null } })
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: p => ({ data: { publicUrl: 'https://test.local/' + p } }), remove: async () => ({ error: null }) }) },
    _setClaims: setClaims,
    _end: () => pool.end(),
    _pool: pool
  };
  return client;
}

module.exports = { createMock };
