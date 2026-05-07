import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { MessageCircle, Send, X, Loader2 } from 'lucide-react'
import { assistUsesStreaming } from '@/config'
import {
  assistChat,
  assistChatStream,
  wasAssistCancelled,
  type AssistChatMessage,
} from '@/services/api'

const WELCOME: AssistChatMessage = {
  role: 'assistant',
  content:
    "Hi! I'm here to help you practice, debug, or work through a problem. Ask anything. When 'Include my code' is on, I can see what's in your editor.",
}

type EditorAssistChatProps = {
  code: string
  /** Shown in the system prompt (e.g. javascript, python, java). */
  languageId: string
  onClose: () => void
  className?: string
}

export function EditorAssistChat({
  code,
  languageId,
  onClose,
  className = '',
}: EditorAssistChatProps) {
  const streamAssist = assistUsesStreaming()
  const [messages, setMessages] = useState<AssistChatMessage[]>([WELCOME])
  const [draft, setDraft] = useState('')
  const [includeCode, setIncludeCode] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [waitingNotice, setWaitingNotice] = useState(false)

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useLayoutEffect(() => {
    scrollToBottom()
  }, [messages, sending, scrollToBottom])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const last = messages[messages.length - 1]
  const showAssistLoader =
    sending &&
    (streamAssist
      ? last?.role !== 'assistant' || last.content === ''
      : last?.role === 'user')

  useEffect(() => {
    if (!showAssistLoader) {
      setWaitingNotice(false)
      return
    }
    const t = window.setTimeout(() => setWaitingNotice(true), 3200)
    return () => {
      window.clearTimeout(t)
      setWaitingNotice(false)
    }
  }, [showAssistLoader])

  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return

    setError(null)
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    const userMsg: AssistChatMessage = { role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setDraft('')
    setSending(true)

    try {
      if (streamAssist) {
        await assistChatStream({
          messages: history,
          code: includeCode ? code : undefined,
          language: languageId,
          signal: ac.signal,
          onDelta(chunk) {
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (last?.role !== 'assistant') {
                return [...prev, { role: 'assistant', content: chunk }]
              }
              const next = [...prev]
              next[next.length - 1] = {
                role: 'assistant',
                content: last.content + chunk,
              }
              return next
            })
          },
        })
      } else {
        const { message } = await assistChat({
          messages: history,
          code: includeCode ? code : undefined,
          language: languageId,
          signal: ac.signal,
        })
        setMessages((prev) => [...prev, { role: 'assistant', content: message }])
      }
    } catch (e) {
      if (wasAssistCancelled(ac.signal, e)) {
        /* user navigated away, new send superseded stream, React dev double-mount */
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && last.content === '') {
          return prev.slice(0, -1)
        }
        return prev
      })
    } finally {
      setSending(false)
      if (abortRef.current === ac) abortRef.current = null
    }
  }, [code, draft, includeCode, languageId, messages, sending, streamAssist])

  return (
    <aside
      className={`flex min-h-0 flex-col border-l border-zinc-800 bg-zinc-950 ${className}`}
      aria-label="Assistance chat"
    >
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <MessageCircle
            className="size-4 shrink-0 text-emerald-500"
            aria-hidden
          />
          <span className="truncate text-sm font-semibold text-zinc-100">
            Assistance
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Close assistance panel"
        >
          <X className="size-4" />
        </button>
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
      >
        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[95%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'ml-auto bg-emerald-600/25 text-zinc-100 ring-1 ring-emerald-500/25'
                  : 'mr-auto bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}
          {showAssistLoader ? (
            streamAssist ? (
            <div
              role="status"
              aria-busy="true"
              aria-label="Generating response"
              className="mr-auto max-w-[95%] space-y-2 rounded-xl bg-zinc-900 px-4 py-3 ring-1 ring-zinc-800"
            >
              <div className="flex items-center gap-3">
                <span className="relative flex size-9 shrink-0 items-center justify-center">
                  <span className="absolute inset-0 rounded-full border border-emerald-500/20" />
                  <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin" />
                  <Loader2
                    className="relative size-4 text-emerald-500"
                    aria-hidden
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-300">
                    Generating response…
                  </p>
                  <div className="mt-2 flex gap-1" aria-hidden>
                    <span className="size-2 rounded-full bg-emerald-500/80 animate-bounce [animation-delay:-0.3s]" />
                    <span className="size-2 rounded-full bg-emerald-500/70 animate-bounce [animation-delay:-0.15s]" />
                    <span className="size-2 rounded-full bg-emerald-500/60 animate-bounce" />
                  </div>
                </div>
              </div>
              <div className="space-y-2 pl-[3rem] pt-0.5" aria-hidden>
                <div className="h-2 w-[88%] max-w-[16rem] rounded bg-zinc-800/95 animate-pulse" />
                <div className="h-2 w-[62%] max-w-[11rem] rounded bg-zinc-800/85 animate-pulse" />
              </div>
              {waitingNotice ? (
                <p className="pl-[3rem] pt-1 text-[0.6875rem] leading-snug text-zinc-500">
                  Still connecting to the model—network or provider may be slow.
                </p>
              ) : null}
            </div>
            ) : (
              <div className="flex max-w-[95%] flex-col gap-2">
                <div
                  role="status"
                  aria-busy="true"
                  aria-label="Waiting for response"
                  className="mr-auto inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-xs text-zinc-500 ring-1 ring-zinc-800"
                >
                  <Loader2
                    className="size-3.5 shrink-0 animate-spin text-emerald-500"
                    aria-hidden
                  />
                  <span>Thinking…</span>
                </div>
                {waitingNotice ? (
                  <p className="mr-auto pl-1 text-[0.6875rem] leading-snug text-zinc-500">
                    Still waiting—the model or network may be slow.
                  </p>
                ) : null}
              </div>
            )
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-zinc-800 px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
          <input
            type="checkbox"
            checked={includeCode}
            onChange={(e) => setIncludeCode(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/30"
          />
          Include my code in requests
        </label>
        {error ? (
          <p className="mt-2 text-xs text-red-400/90">{error}</p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-zinc-800 p-3">
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder="Ask for a hint, help with an error, or how to approach this…"
            rows={3}
            className="min-h-0 flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600/50"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !draft.trim()}
            className="inline-flex h-10 shrink-0 items-center justify-center self-end rounded-lg bg-emerald-600 px-3 text-zinc-950 shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
          </button>
        </div>
        <p className="mt-2 text-[0.65rem] text-zinc-600">
          Enter to send · Shift+Enter for newline · replies stream in as they arrive
        </p>
      </div>
    </aside>
  )
}
