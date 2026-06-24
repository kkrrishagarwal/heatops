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
          const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
          console.log('[ask-ai dev middleware] incoming request:', { question: body.question, context: body.context })

          const { callGemini } = await server.ssrLoadModule('/api/_lib/askAI.js')
          const { answer } = await callGemini({ question: body.question, context: body.context })
          console.log('[ask-ai dev middleware] Gemini answered:', answer.slice(0, 120))

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ answer }))
        } catch (err) {
          console.error('[ask-ai dev middleware] error:', err.status || 500, err.message)
          const status = err?.status || 500
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message || 'Internal server error.', retryAfterSeconds: err?.retryAfterSeconds ?? null }))
        }
      })
    }
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), askAIDevMiddleware(mode), geoJsonCompressionMiddleware()],
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
