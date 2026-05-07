import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { MessageCircle, Send, X, Loader2 } from 'lucide-react'
import { assistChat, type AssistChatMessage } from '@/services/api'

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
  const [messages, setMessages] = useState<AssistChatMessage[]>([WELCOME])
  const [draft, setDraft] = useState('')
  const [includeCode, setIncludeCode] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useLayoutEffect(() => {
    scrollToBottom()
  }, [messages, sending, scrollToBottom])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return

    setError(null)
    const userMsg: AssistChatMessage = { role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setDraft('')
    setSending(true)

    try {
      const { message } = await assistChat({
        messages: history,
        code: includeCode ? code : undefined,
        language: languageId,
      })
      setMessages((m) => [...m, { role: 'assistant', content: message }])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }, [code, draft, includeCode, languageId, messages, sending])

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
          {sending ? (
            <div className="mr-auto inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-xs text-zinc-500 ring-1 ring-zinc-800">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Thinking…
            </div>
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
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </aside>
  )
}
