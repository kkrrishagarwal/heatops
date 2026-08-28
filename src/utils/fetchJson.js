// Small shared fetch helper so every JSON request in the app fails the same way:
//   - a real timeout (AbortController) instead of hanging forever on a slow API
//   - non-2xx responses become errors instead of "successfully" parsing an HTML
//     error page and blowing up somewhere downstream
//   - a non-JSON body is reported as a parse error rather than an opaque
//     SyntaxError escaping from `res.json()`
//
// Every failure is a FetchJsonError with a `kind` so callers can decide what to
// tell the user (see describeFetchError) without string-matching messages.

export class FetchJsonError extends Error {
  constructor(message, { kind, status = null, url = '' } = {}) {
    super(message)
    this.name = 'FetchJsonError'
    this.kind = kind // 'timeout' | 'network' | 'http' | 'parse'
    this.status = status
    this.url = url
  }
}

export const DEFAULT_TIMEOUT_MS = 10000

export async function fetchJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...init } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  // Let a caller-supplied signal (component unmount, superseded request) abort too.
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let res
  try {
    res = await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err?.name === 'AbortError') {
      if (signal?.aborted) throw err // caller cancelled on purpose — not a failure
      throw new FetchJsonError(`Request timed out after ${Math.round(timeoutMs / 1000)}s`, { kind: 'timeout', url })
    }
    throw new FetchJsonError(`Network error: ${err?.message || 'request failed'}`, { kind: 'network', url })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new FetchJsonError(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`, {
      kind: 'http',
      status: res.status,
      url
    })
  }

  try {
    return await res.json()
  } catch {
    throw new FetchJsonError('Response was not valid JSON', { kind: 'parse', status: res.status, url })
  }
}

// Short, user-facing sentence for an error from fetchJson (or anything else).
export function describeFetchError(err, what = 'data') {
  if (err instanceof FetchJsonError) {
    switch (err.kind) {
      case 'timeout': return `Loading ${what} took too long. Please try again.`
      case 'network': return `Could not reach the server to load ${what}. Check your connection and try again.`
      case 'http': return err.status === 429
        ? `The ${what} service is busy (rate limited). Please try again in a moment.`
        : `Could not load ${what} (server responded ${err.status}). Please try again.`
      case 'parse': return `Received an unreadable response while loading ${what}. Please try again.`
      default: break
    }
  }
  return `Could not load ${what}. Please try again.`
}
