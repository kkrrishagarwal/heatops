// Historic weather storage — tier 2: Postgres (optional).
//
// Activated by setting DATABASE_URL (any Postgres: Neon / Vercel Postgres / Supabase /
// Railway / local). Every refresh run inserts one row per city into
// weather_observations, keyed by (observed_at, city, state), so re-running a backfill or a
// cron retry is idempotent (ON CONFLICT DO NOTHING). The snapshot files in
// api/_lib/weatherHistory.js keep working with or without this; the read API prefers the
// database when it is configured because it can answer arbitrary ranges in one query.
import pg from 'pg'
import { SNAPSHOT_FIELDS } from './weatherHistory.js'

const { Pool } = pg
let pool = null

export function isDbConfigured() {
  return !!process.env.DATABASE_URL
}

function getPool() {
  if (pool) return pool
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  // Hosted Postgres (Neon, Supabase, Vercel) requires TLS; a local server usually doesn't.
  const local = /localhost|127\.0\.0\.1/.test(url)
  pool = new Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 3 })
  return pool
}

export const SCHEMA_SQL = `
CREATE TABLE weather_runs (
  observed_at timestamptz PRIMARY KEY,
  city_count  integer     NOT NULL,
  source      text        NOT NULL DEFAULT 'cron'
);
CREATE TABLE weather_observations (
  observed_at timestamptz NOT NULL REFERENCES weather_runs(observed_at) ON DELETE CASCADE,
  city        text        NOT NULL,
  state       text        NOT NULL,
  temp        real,
  rain_chance real,
  aqi         real,
  cloud_cover real,
  pm10        real,
  PRIMARY KEY (observed_at, city, state)
);
CREATE INDEX weather_observations_city_idx
  ON weather_observations (city, state, observed_at DESC);
`

// Creates the tables on first use. Checks information_schema instead of relying on
// "IF NOT EXISTS" so a normal run costs one cheap SELECT rather than three DDL statements.
export async function ensureSchema(client) {
  const existing = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('weather_runs', 'weather_observations')"
  )
  if (existing.rows.length === 2) return false
  for (const stmt of SCHEMA_SQL.split(';').map(s => s.trim()).filter(Boolean)) {
    await client.query(stmt)
  }
  return true
}

const COLUMNS = ['observed_at', 'city', 'state', 'temp', 'rain_chance', 'aqi', 'cloud_cover', 'pm10']
const ROWS_PER_INSERT = 400

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

// payload = { lastUpdated, cityCount, cities } (live-cache shape). Returns { inserted }.
export async function saveRunToDb(payload, { source = 'cron', client: givenClient } = {}) {
  const client = givenClient || (await getPool().connect())
  try {
    await ensureSchema(client)
    await client.query('BEGIN')
    await client.query(
      'INSERT INTO weather_runs (observed_at, city_count, source) VALUES ($1, $2, $3) ON CONFLICT (observed_at) DO NOTHING',
      [payload.lastUpdated, payload.cityCount ?? Object.keys(payload.cities || {}).length, source]
    )
    const rows = Object.values(payload.cities || {})
      .filter(c => c?.city)
      .map(c => [payload.lastUpdated, c.city, c.state || '', num(c.temp), num(c.rainChance), num(c.aqi), num(c.cloudCover), num(c.pm10)])
    let inserted = 0
    for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
      const chunk = rows.slice(i, i + ROWS_PER_INSERT)
      const values = []
      const placeholders = chunk.map((row, r) => {
        values.push(...row)
        return '(' + row.map((_, c) => `$${r * COLUMNS.length + c + 1}`).join(', ') + ')'
      })
      const res = await client.query(
        `INSERT INTO weather_observations (${COLUMNS.join(', ')}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
        values
      )
      inserted += res.rowCount || 0
    }
    await client.query('COMMIT')
    return { inserted, rows: rows.length }
  } catch (err) {
    try { await client.query('ROLLBACK') } catch {}
    throw err
  } finally {
    if (!givenClient) client.release()
  }
}

// One city's series, newest run per UTC day, oldest first.
export async function queryCityHistory({ city, state, days = 30 }, { client: givenClient } = {}) {
  const client = givenClient || (await getPool().connect())
  try {
    const limit = Math.max(1, Math.min(Number(days) || 30, 366))
    const since = new Date(Date.now() - limit * 24 * 60 * 60 * 1000).toISOString()
    const params = [String(city || '').trim(), since]
    let stateClause = ''
    if (state) { params.push(String(state).trim()); stateClause = 'AND lower(state) = lower($3)' }
    const res = await client.query(
      `SELECT observed_at, city, state, temp, rain_chance, aqi, cloud_cover, pm10
         FROM weather_observations
        WHERE lower(city) = lower($1) ${stateClause}
          AND observed_at >= $2::timestamptz
        ORDER BY observed_at ASC`,
      params
    )
    return res.rows.map(r => ({
      date: new Date(r.observed_at).toISOString().slice(0, 10),
      observedAt: new Date(r.observed_at).toISOString(),
      city: r.city,
      state: r.state,
      temp: r.temp, rainChance: r.rain_chance, aqi: r.aqi, cloudCover: r.cloud_cover, pm10: r.pm10
    }))
  } finally {
    if (!givenClient) client.release()
  }
}

export async function listRuns({ limit = 60 } = {}, { client: givenClient } = {}) {
  const client = givenClient || (await getPool().connect())
  try {
    const res = await client.query(
      'SELECT observed_at, city_count, source FROM weather_runs ORDER BY observed_at DESC LIMIT $1',
      [Math.max(1, Math.min(Number(limit) || 60, 1000))]
    )
    return res.rows.map(r => ({ observedAt: new Date(r.observed_at).toISOString(), cityCount: r.city_count, source: r.source }))
  } finally {
    if (!givenClient) client.release()
  }
}

export { SNAPSHOT_FIELDS }
