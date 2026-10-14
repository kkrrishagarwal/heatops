import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'

// Vite's dev server serves files under public/ as plain static files with no
// compression and Cache-Control: no-cache — fine for small files, but the
// India districts/states GeoJSON are 10s of MB, so every map load/reload was
// re-transferring the full uncompressed file with no caching at all. This
// only matters in dev (Vercel/most static hosts already gzip + cache
// production assets), but it's exactly what local `npm run dev` testing hits.
//
// IMPORTANT: this serves a pre-compressed *.geojson.gz sitting next to the
// source file (generated once via `gzip -9 -k`), NOT live on-the-fly gzip —
// compressing a 17MB file fresh on every request is CPU-bound and took ~10s
// per request, which made things much worse, not better. Pre-compressing
// once ahead of time costs nothing at request time.
function geoJsonCompressionMiddleware() {
  return {
    name: 'geojson-compression-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/data/') || !req.url.endsWith('.geojson')) return next()
        const acceptsGzip = (req.headers['accept-encoding'] || '').includes('gzip')
        if (!acceptsGzip) return next()

        const gzPath = path.join(process.cwd(), 'public', req.url.split('?')[0]) + '.gz'
        try {
          await stat(gzPath)
        } catch {
          return next()
        }

        res.setHeader('Content-Type', 'application/geo+json')
        res.setHeader('Content-Encoding', 'gzip')
        res.setHeader('Cache-Control', 'public, max-age=3600')
        createReadStream(gzPath).pipe(res)
      })
    }
  }
}

// Dev-only middleware so `npm run dev` serves POST /api/ask-ai the same way
// Vercel/Netlify do in production, without needing `vercel dev`. It calls the
// exact same shared lib (api/_lib/askAI.js) as the deployed serverless
// function, so local behavior matches production behavior.
//
// IMPORTANT: Vite does NOT automatically put .env values into process.env —
// it only exposes VITE_-prefixed vars to import.meta.env on the client. Server
// code (this middleware, api/_lib/askAI.js) reads process.env directly, so we
// have to load .env ourselves with loadEnv() and copy GEMINI_API_KEY across.
// Without this, process.env.GEMINI_API_KEY is always undefined in local dev
// even if it's set in .env.
function askAIDevMiddleware(mode) {
  return {
    name: 'ask-ai-dev-middleware',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), '')
      if (env.GEMINI_API_KEY) {
        process.env.GEMINI_API_KEY = env.GEMINI_API_KEY
      }

      server.middlewares.use('/api/ask-ai', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Allow', 'POST')
          res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }))
          return
        }
        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          let body = {}
          if (chunks.length) {
            try {
              body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            } catch {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Request body must be valid JSON.', retryAfterSeconds: null }))
              return
            }
          }
          const { handleAskAI, getClientKey } = await server.ssrLoadModule('/api/_lib/askAI.js')
          const clientKey = getClientKey(req.headers, req.socket?.remoteAddress)
          console.log('[ask-ai dev middleware] incoming request:', { question: body.question, context: body.context, clientKey })

          const { answer } = await handleAskAI({ question: body.question, context: body.context, history: body.history, clientKey })
          console.log('[ask-ai dev middleware] Gemini answered:', answer.slice(0, 120))

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ answer }))
        } catch (err) {
          console.error('[ask-ai dev middleware] error:', err.status || 500, err.message)
          const status = err?.status || 500
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          if (err?.retryAfterSeconds) res.setHeader('Retry-After', String(err.retryAfterSeconds))
          res.end(JSON.stringify({ error: err.message || 'Internal server error.', retryAfterSeconds: err?.retryAfterSeconds ?? null }))
        }
      })
    }
  }
}

// Dev-only guard: Vite's dev server answers HTTP 500 to any URL with a broken percent
// escape (e.g. "?demo=%zz:46"), before the app can load. Production (Vercel) serves such
// URLs normally, so mirror that: escape stray "%" and redirect; if the URL still cannot be
// decoded (invalid UTF-8 bytes), drop the query string. Keeps a hand-typed demo link from
// white-screening a local demo.
function malformedUrlGuard() {
  return {
    name: 'malformed-url-guard',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        try { decodeURI(req.url); return next() } catch { /* repair below */ }
        let target = req.url.replace(/%(?![0-9A-Fa-f]{2})/g, '%25')
        try { decodeURI(target) } catch { target = req.url.split('?')[0] || '/' }
        res.statusCode = 302
        res.setHeader('Location', target)
        res.end()
      })
    }
  }
}

// Dev-only mirror of api/heat-agent.js (Agent37 Heat Response Co-Pilot) so `npm run dev`
// serves GET/POST /api/heat-agent exactly like production, through the same shared lib.
// AGENT37_API_KEY / AGENT37_INSTANCE_ID are copied from .env into process.env here (Vite
// does not do that for server code); without them the route returns the labelled fallback.
function heatAgentDevMiddleware(mode) {
  return {
    name: 'heat-agent-dev-middleware',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), '')
      for (const k of ['AGENT37_API_KEY', 'AGENT37_INSTANCE_ID', 'AGENT37_TIMEOUT_MS']) {
        if (env[k] && !process.env[k]) process.env[k] = env[k]
      }
      server.middlewares.use('/api/heat-agent', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        try {
          const { handleHeatAgent, pingHeatAgent } = await server.ssrLoadModule('/api/_lib/heatAgent.js')
          if (req.method === 'GET') { res.end(JSON.stringify(await pingHeatAgent())); return }
          if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'GET, POST'); res.end(JSON.stringify({ error: 'Method not allowed. Use GET or POST.' })); return }
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          let body
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch {
            res.statusCode = 400; res.end(JSON.stringify({ error: 'Request body must be valid JSON.' })); return
          }
          const { getClientKey } = await server.ssrLoadModule('/api/_lib/askAI.js')
          const result = await handleHeatAgent({ body, clientKey: getClientKey(req.headers, req.socket?.remoteAddress) })
          console.log('[heat-agent dev middleware]', result.source, result.reason || result.meta?.elapsedMs)
          res.end(JSON.stringify(result))
        } catch (err) {
          res.statusCode = err?.status || 500
          if (err?.retryAfterSeconds) res.setHeader('Retry-After', String(err.retryAfterSeconds))
          res.end(JSON.stringify({ error: err?.message || 'Internal server error.', retryAfterSeconds: err?.retryAfterSeconds ?? null }))
        }
      })
    }
  }
}

// Dev-only mirror of api/weather-history.js so `npm run dev` can serve
// GET /api/weather-history exactly like production. Snapshot files are read from disk.
function weatherHistoryDevMiddleware(mode) {
  return {
    name: 'weather-history-dev-middleware',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), '')
      if (env.DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL
      server.middlewares.use('/api/weather-history', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method !== 'GET') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed. Use GET.' })); return }
        try {
          const { handleWeatherHistory } = await server.ssrLoadModule('/api/_lib/weatherHistoryApi.js')
          const query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)
          const { readFile } = await import('fs/promises')
          const loadStatic = async (rel) => JSON.parse(await readFile(path.join(process.cwd(), 'public', rel), 'utf8'))
          const { status, body } = await handleWeatherHistory(query, { loadStatic })
          res.statusCode = status
          res.end(JSON.stringify(body))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    }
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [malformedUrlGuard(), react(), askAIDevMiddleware(mode), heatAgentDevMiddleware(mode), weatherHistoryDevMiddleware(mode), geoJsonCompressionMiddleware()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          maps: ['react-simple-maps', 'd3']
        }
      }
    }
  }
}))
