// One-off backfill: rebuild the historic weather snapshots from git history.
//
// The daily cron has been committing public/live-weather-cache.json for weeks, so every
// past day's readings are still in the repo's commit history. This walks those commits,
// extracts each run's payload, and writes it as a compact snapshot under
// public/data/history/ (one file per UTC day — the latest run of a day wins) plus the
// index. With --db it also inserts every run into Postgres (DATABASE_URL), idempotently.
//
// Usage:  node scripts/backfillWeatherHistory.mjs          # snapshot files only
//         node scripts/backfillWeatherHistory.mjs --db     # + Postgres
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { buildSnapshot, updateIndex, emptyIndex, historyFilePath, INDEX_PATH } from '../api/_lib/weatherHistory.js'
import { isDbConfigured, saveRunToDb } from '../api/_lib/weatherHistoryDb.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const CACHE_PATH = 'public/live-weather-cache.json'
const withDb = process.argv.includes('--db')

const git = (...args) => execFileSync('git', args, { cwd: REPO_ROOT, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' })

const shas = git('log', '--format=%H', '--', CACHE_PATH).trim().split('\n').filter(Boolean).reverse() // oldest first
console.log(`Found ${shas.length} commits touching ${CACHE_PATH}`)

const byDate = new Map() // date -> payload (latest lastUpdated for that date wins)
let parsed = 0
for (const sha of shas) {
  let payload
  try {
    payload = JSON.parse(git('show', `${sha}:${CACHE_PATH}`))
  } catch {
    continue
  }
  if (!payload?.lastUpdated || !payload?.cities) continue
  parsed++
  const date = new Date(payload.lastUpdated).toISOString().slice(0, 10)
  const existing = byDate.get(date)
  if (!existing || existing.lastUpdated < payload.lastUpdated) byDate.set(date, payload)
}
console.log(`Parsed ${parsed} runs → ${byDate.size} distinct days (${[...byDate.keys()].sort()[0]} … ${[...byDate.keys()].sort().slice(-1)[0]})`)

let index = emptyIndex()
const indexAbs = path.join(REPO_ROOT, INDEX_PATH)
try { index = JSON.parse(fs.readFileSync(indexAbs, 'utf8')) } catch {}
fs.mkdirSync(path.dirname(indexAbs), { recursive: true })

let written = 0
let dbRows = 0
for (const date of [...byDate.keys()].sort()) {
  const payload = byDate.get(date)
  const snapshot = buildSnapshot(payload)
  fs.writeFileSync(path.join(REPO_ROOT, historyFilePath(snapshot.date)), JSON.stringify(snapshot))
  index = updateIndex(index, snapshot)
  written++
  if (withDb) {
    if (!isDbConfigured()) throw new Error('--db given but DATABASE_URL is not set')
    const r = await saveRunToDb(payload, { source: 'backfill' })
    dbRows += r.inserted
    process.stdout.write(`  ${date}: ${snapshot.cityCount} cities, +${r.inserted} db rows\n`)
  }
}
fs.writeFileSync(indexAbs, JSON.stringify(index, null, 2))
console.log(`Wrote ${written} snapshot files, index now lists ${index.days.length} days${withDb ? `, ${dbRows} rows inserted into Postgres` : ''}`)
