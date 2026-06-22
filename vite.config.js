import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

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
  plugins: [react(), askAIDevMiddleware(mode)],
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
