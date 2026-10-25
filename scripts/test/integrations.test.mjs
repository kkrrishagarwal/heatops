// Contract tests for the sponsor integrations against local mock servers (no real keys used):
// Hackyard LLM Gateway (OpenAI-compatible) and the Browser Use task flow.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

const seen = []
const srv = http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c
  seen.push({ url: req.url, method: req.method, auth: req.headers.authorization, body })
  res.setHeader('Content-Type', 'application/json')
  if (req.url === '/v1/chat/completions') return res.end(JSON.stringify({ model: 'mock-model', usage: { total_tokens: 42 }, choices: [{ message: { content: '{"ok":true}' } }] }))
  if (req.url === '/bu/runs' && req.method === 'POST') return res.end(JSON.stringify({ id: 'task123', status: 'queued' }))
  if (req.url === '/bu/runs/task123') return res.end(JSON.stringify({ status: 'completed', output: { state: 'Rajasthan', current_demand_mw: 14520, peak_demand_met_mw: 16210, as_of: '24-10-2026 14:30', page_url: 'https://vidyutpravah.in/state-data/rajasthan' }, result: 'done' }))
  res.statusCode = 404; res.end('{}')
})
await new Promise(r => srv.listen(0, r))
const port = srv.address().port
after(() => srv.close())

test('gateway: OpenAI-compatible request and parsed answer', async () => {
  process.env.LLM_GATEWAY_URL = `http://127.0.0.1:${port}/v1`; process.env.LLM_GATEWAY_KEY = 'k-test'; process.env.LLM_GATEWAY_MODEL = 'mock-model'
  const { gatewayChat } = await import('../../api/_lib/llmGateway.js')
  const out = await gatewayChat({ system: 'sys', messages: [{ role: 'user', content: 'hi' }], json: true })
  assert.equal(out.ok, true); assert.equal(out.text, '{"ok":true}'); assert.equal(out.meta.tokens, 42)
  const req = seen.find(s => s.url === '/v1/chat/completions')
  assert.equal(req.auth, 'Bearer k-test')
  const b = JSON.parse(req.body); assert.equal(b.model, 'mock-model'); assert.equal(b.messages[0].role, 'system'); assert.deepEqual(b.response_format, { type: 'json_object' })
})
test('gateway: not configured → clear reason, no request', async () => {
  delete process.env.LLM_GATEWAY_URL
  const { gatewayChat } = await import('../../api/_lib/llmGateway.js')
  const out = await gatewayChat({ messages: [] }); assert.equal(out.ok, false); assert.match(out.reason, /not configured/)
})
function mockRes() { const r = { code: 200, headers: {}, body: null, status(c) { this.code = c; return this }, setHeader(k, v) { this.headers[k] = v }, json(b) { this.body = b; return this } }; return r }
test('Browser Use v4: create run with schema, poll, parse MW figures', async () => {
  process.env.BROWSER_USE_API_KEY = 'bu-test'; process.env.BROWSER_USE_API_BASE = `http://127.0.0.1:${port}/bu`
  const { default: handler } = await import('../../api/grid-demand.js')
  const r1 = mockRes(); await handler({ query: { state: 'Rajasthan' } }, r1)
  assert.equal(r1.code, 202); assert.equal(r1.body.task, 'task123')
  const r2 = mockRes(); await handler({ query: { state: 'Rajasthan', task: 'task123' } }, r2)
  assert.equal(r2.code, 200); assert.equal(r2.body.demandMW, 14520); assert.equal(r2.body.peakMW, 16210); assert.match(r2.body.source, /Vidyut PRAVAH/)
  const startReq = seen.find(s => s.url === '/bu/runs'); const sb = JSON.parse(startReq.body); assert.match(sb.task, /vidyutpravah\.in\/state-data\/rajasthan/); assert.equal(sb.outputSchema.type, 'object'); assert.equal(startReq.auth, undefined)
  const r3 = mockRes(); await handler({ query: { state: 'Rajasthan' } }, r3); assert.equal(r3.body.cached, true)
})
