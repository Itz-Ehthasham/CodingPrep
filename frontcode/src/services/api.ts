import { apiUrl } from '../config'
import type { PracticeProblem } from '../data/sampleProblem'

export const defaultJsonHeaders: HeadersInit = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const url = apiUrl(path)
  const res = await fetch(url, {
    ...init,
    method: 'GET',
    headers: { ...defaultJsonHeaders, ...init?.headers },
  })
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export type CompileLanguage = 'java' | 'python' | 'javascript'

export type CompileResult = {
  output: string
  compileTime?: string
  executionTime?: string
  memoryUsage?: number
}

type CompileErrorJson = {
  error?: string
  compileTime?: string
  executionTime?: string
}

/** Runs code on the backend (Java / Python / Node). Uses `/api` + Vite proxy in dev. */
export async function compileCode(params: {
  code: string
  language: CompileLanguage
  input?: string
}): Promise<CompileResult> {
  const url = apiUrl('/api/compile')
  const res = await fetch(url, {
    method: 'POST',
    headers: defaultJsonHeaders,
    body: JSON.stringify({
      code: params.code,
      language: params.language,
      input: params.input ?? '',
    }),
  })

  const data = (await res.json().catch(() => ({}))) as
    | CompileResult
    | CompileErrorJson

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'error' in data && data.error
        ? String(data.error)
        : `POST ${url} failed: ${res.status}`
    const err = new Error(msg) as Error & CompileErrorJson
    if (typeof data === 'object' && data) {
      if (data.compileTime != null) err.compileTime = data.compileTime
      if (data.executionTime != null) err.executionTime = data.executionTime
    }
    throw err
  }

  return data as CompileResult
}

export type AssistChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

/** True when the network/stream was aborted (user action or React cleanup). */
export function wasAssistCancelled(
  signal: AbortSignal | undefined,
  err: unknown,
): boolean {
  if (signal?.aborted) return true
  if (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    typeof (err as { name?: unknown }).name === 'string' &&
    (err as { name: string }).name === 'AbortError'
  )
    return true
  const msg =
    err instanceof DOMException ? err.message : err instanceof Error ? err.message : ''
  if (/\baborted\b|abort(?:ed)?\s+(?:the\s+|a\s+)?request|The operation\s+was aborted/i.test(msg))
    return true
  return false
}

function parseAssistSseBlocks(buffer: string): {
  remainder: string
  events: Array<{ type?: string; text?: string; message?: string }>
} {
  const events: Array<{ type?: string; text?: string; message?: string }> = []
  let remainder = buffer
  for (;;) {
    const idx = remainder.indexOf('\n\n')
    if (idx === -1) break
    const block = remainder.slice(0, idx).trimEnd()
    remainder = remainder.slice(idx + 2)
    let data = ''
    for (const line of block.split('\n')) {
      const t = line.trim()
      if (t.startsWith('data:')) {
        data += t.slice(5).trimStart()
      }
    }
    if (!data) continue
    try {
      events.push(JSON.parse(data) as { type?: string; text?: string; message?: string })
    } catch {
      /* ignore bad frame */
    }
  }
  return { remainder, events }
}

/** Reads backend assist SSE frames until `done` or throws on `error` frame. */
export async function consumeAssistSseStream(
  res: Response,
  handlers: {
    onDelta: (text: string) => void
  },
  opts?: { signal?: AbortSignal },
): Promise<void> {
  const signal = opts?.signal
  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error('No response stream from assist endpoint')
  }
  const dec = new TextDecoder()
  let buf = ''

  try {
    for (;;) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => {})
        return
      }

      let readResult
      try {
        readResult = await reader.read()
      } catch (readErr) {
        if (wasAssistCancelled(signal, readErr)) {
          await reader.cancel().catch(() => {})
          return
        }
        throw readErr
      }

      const { done, value } = readResult
      buf += dec.decode(value ?? new Uint8Array(), { stream: !done })
      const { remainder, events } = parseAssistSseBlocks(buf)
      buf = remainder
      for (const ev of events) {
        if (ev?.type === 'delta' && typeof ev.text === 'string') {
          handlers.onDelta(ev.text)
        }
        if (ev?.type === 'error') {
          throw new Error(
            typeof ev.message === 'string' && ev.message
              ? ev.message
              : 'Assist stream error',
          )
        }
        if (ev?.type === 'done') {
          return
        }
      }
      if (done) {
        break
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* ignore if already unlocked */
    }
  }

  if (signal?.aborted) return
  throw new Error('assist stream ended without completion')
}

/** Coding tutor chat with token streaming (`POST /api/assist/stream`). */
export async function assistChatStream(params: {
  messages: AssistChatMessage[]
  code?: string
  language?: string
  signal?: AbortSignal
  onDelta: (text: string) => void
}): Promise<void> {
  const url = apiUrl('/api/assist/stream')
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: params.messages,
        code: params.code,
        language: params.language,
      }),
      signal: params.signal,
    })
  } catch (e) {
    if (wasAssistCancelled(params.signal, e)) return
    throw e
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(
      typeof data.error === 'string' && data.error
        ? data.error
        : `POST ${url} failed: ${res.status}`,
    )
  }

  try {
    await consumeAssistSseStream(
      res,
      {
        onDelta: params.onDelta,
      },
      { signal: params.signal },
    )
  } catch (e) {
    if (wasAssistCancelled(params.signal, e)) return
    throw e
  }
}

/** Coding tutor chat (single JSON reply from `POST /api/assist`). */
export async function assistChat(params: {
  messages: AssistChatMessage[]
  code?: string
  language?: string
  signal?: AbortSignal
}): Promise<{ message: string }> {
  const url = apiUrl('/api/assist')
  const res = await fetch(url, {
    method: 'POST',
    headers: defaultJsonHeaders,
    body: JSON.stringify({
      messages: params.messages,
      code: params.code,
      language: params.language,
    }),
    signal: params.signal,
  })

  const data = (await res.json().catch(() => ({}))) as
    | { message?: string }
    | { error?: string }

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'error' in data && data.error
        ? String(data.error)
        : `POST ${url} failed: ${res.status}`
    throw new Error(msg)
  }

  if (
    typeof data === 'object' &&
    data &&
    'message' in data &&
    typeof data.message === 'string'
  ) {
    return { message: data.message }
  }

  throw new Error('Invalid response from assist endpoint')
}

/* ---- LeetCode proxy (CodingPrep backend) -------------------------------- */

export type LeetCodeListItem = {
  title: string
  titleSlug: string
  difficulty: string
  frontendId: string
  paidOnly: boolean
}

export type LeetCodeListResponse = {
  total: number
  skip: number
  limit: number
  questions: LeetCodeListItem[]
}

export async function fetchLeetCodeQuestionList(params?: {
  skip?: number
  limit?: number
}): Promise<LeetCodeListResponse> {
  const search = new URLSearchParams()
  if (params?.skip != null) search.set('skip', String(params.skip))
  if (params?.limit != null) search.set('limit', String(params.limit))
  const qs = search.toString()
  const url = apiUrl(
    qs ? `/api/leetcode/question-list?${qs}` : '/api/leetcode/question-list',
  )
  const res = await fetch(url)
  const data = (await res.json().catch(() => ({}))) as LeetCodeListResponse & {
    error?: string
  }
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : `GET ${url} failed`,
    )
  }
  return data as LeetCodeListResponse
}

export async function fetchLeetCodeProblem(
  slug: string,
  opts?: { editorLang?: string },
): Promise<{ problem: PracticeProblem }> {
  const search = new URLSearchParams()
  if (opts?.editorLang)
    search.set('lang', String(opts.editorLang).toLowerCase())
  const qs = search.toString()
  const encoded = encodeURIComponent(slug.trim().toLowerCase())
  const url = apiUrl(
    qs ? `/api/leetcode/problems/${encoded}?${qs}` : `/api/leetcode/problems/${encoded}`,
  )
  const res = await fetch(url)
  const data = (await res.json().catch(() => ({}))) as {
    problem?: PracticeProblem
    error?: string
  }
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : `GET practice problem failed (${res.status})`,
    )
  }
  if (!data.problem) throw new Error('Malformed problem payload from API')
  return { problem: data.problem }
}
