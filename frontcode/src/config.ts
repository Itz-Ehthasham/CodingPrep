/**
 * Base URL for API calls. In dev, leave unset so requests use `/api` and the Vite proxy.
 * For production, set `VITE_API_URL` to your API origin (no trailing slash).
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.trim()
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '')
  }
  return ''
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const base = getApiBaseUrl()
  return base ? `${base}${normalized}` : normalized
}

/**
 * When true, editor assist uses `POST /api/assist/stream` (SSE).
 * Default false uses `POST /api/assist` (single JSON) — usually faster in dev because
 * the Vite proxy can buffer event streams until the response finishes.
 * Set `VITE_ASSIST_STREAM=true` to enable streaming; with the proxy, also try
 * `VITE_API_URL=http://localhost:3001` so requests hit the API directly.
 */
export function assistUsesStreaming(): boolean {
  return String(import.meta.env.VITE_ASSIST_STREAM ?? '').toLowerCase() === 'true'
}
