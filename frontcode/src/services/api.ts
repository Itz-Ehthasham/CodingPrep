import { apiUrl } from '../config'

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

/** Coding tutor chat (OpenAI-compatible API on the backend). */
export async function assistChat(params: {
  messages: AssistChatMessage[]
  code?: string
  language?: string
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
