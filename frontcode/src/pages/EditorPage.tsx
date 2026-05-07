import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { ChevronDown, Loader2, MessageCircle, Play, Terminal } from 'lucide-react'
import { EditorAssistChat } from '@/components/editor/EditorAssistChat'
import {
  compileCode,
  type CompileLanguage,
} from '@/services/api'

type EditorLanguage = 'javascript' | 'python' | 'java'

const languageOptions: {
  id: EditorLanguage
  label: string
  monaco: string
  api: CompileLanguage
}[] = [
  { id: 'javascript', label: 'JavaScript', monaco: 'javascript', api: 'javascript' },
  { id: 'python', label: 'Python', monaco: 'python', api: 'python' },
  { id: 'java', label: 'Java', monaco: 'java', api: 'java' },
]

const STARTER_CODE: Record<EditorLanguage, string> = {
  javascript: `// Online editor - start coding here.
// Run sends this file to the local API (Node).

function greet(name) {
  return \`Hello, \${name}!\`
}

console.log(greet('Sathcode'))
`,
  python: `# Online editor - start coding here.

def greet(name):
    return f"Hello, {name}!"

print(greet("Sathcode"))
`,
  java: `// Online editor - start coding here.
// Class must be named Main (required by the runner).

public class Main {
    public static void main(String[] args) {
        System.out.println(greet("Sathcode"));
    }

    static String greet(String name) {
        return "Hello, " + name + "!";
    }
}
`,
}

export function EditorPage() {
  const [language, setLanguage] = useState<EditorLanguage>('javascript')
  const [code, setCode] = useState(STARTER_CODE.javascript)
  const [output, setOutput] = useState<string>(
    'Click Run to execute on the backend (JavaScript, Python, Java). Start the API on port 3001 or set VITE_API_PROXY_TARGET.',
  )
  const [isRunning, setIsRunning] = useState(false)
  const [assistOpen, setAssistOpen] = useState(false)

  const monacoLang =
    languageOptions.find((o) => o.id === language)?.monaco ?? 'javascript'

  const apiLanguage =
    languageOptions.find((o) => o.id === language)?.api ?? 'javascript'

  const handleRun = useCallback(async () => {
    setIsRunning(true)
    try {
      const result = await compileCode({
        code,
        language: apiLanguage,
        input: '',
      })
      const lines = [(result.output ?? '').replace(/\n$/, '')]
      if (result.compileTime != null && result.compileTime !== '0.00') {
        lines.push(`compile: ${result.compileTime} ms`)
      }
      if (result.executionTime != null) {
        lines.push(`run: ${result.executionTime} ms`)
      }
      setOutput(lines.filter(Boolean).join('\n'))
    } catch (e) {
      setOutput(e instanceof Error ? e.message : String(e))
    } finally {
      setIsRunning(false)
    }
  }, [apiLanguage, code])

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            className="shrink-0 text-sm font-semibold tracking-tight text-zinc-100 transition hover:text-emerald-400"
          >
            Sathcode
          </Link>
          <span className="hidden h-4 w-px bg-zinc-700 sm:block" aria-hidden />
          <div className="flex items-center gap-1.5 text-zinc-500">
            <Terminal className="size-4 shrink-0 text-emerald-500/80" />
            <span className="truncate text-sm font-medium text-zinc-300">
              Editor
            </span>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAssistOpen((o) => !o)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
              assistOpen
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-600'
            }`}
          >
            <MessageCircle className="size-3.5 shrink-0" aria-hidden />
            Assist
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-zinc-950 shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunning ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Play className="size-3.5 shrink-0 fill-current" aria-hidden />
            )}
            Run
          </button>
          <Link
            to="/practice"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          >
            Practice
          </Link>
        </nav>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-10 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-900/50 px-3">
            <label
              htmlFor="editor-language"
              className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500"
            >
              Language
            </label>
            <div className="relative inline-block min-w-[11rem]">
              <select
                id="editor-language"
                value={language}
                onChange={(e) => {
                  const next = e.target.value as EditorLanguage
                  setLanguage(next)
                  setCode(STARTER_CODE[next])
                }}
                className="w-full cursor-pointer appearance-none rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-3 pr-9 text-sm font-medium text-zinc-200 shadow-sm outline-none transition hover:border-zinc-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
              >
                {languageOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                aria-hidden
              />
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <Editor
              height="100%"
              language={monacoLang}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value ?? '')}
              options={{
                minimap: { enabled: true, scale: 0.85 },
                fontSize: 14,
                fontFamily:
                  '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                tabSize: 2,
                automaticLayout: true,
                wordWrap: 'on',
              }}
            />
          </div>

          <footer className="flex min-h-[7rem] max-h-40 shrink-0 flex-col border-t border-zinc-800 bg-zinc-900/90">
            <div className="flex items-center border-b border-zinc-800/80 px-3 py-1.5">
              <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
                Output
              </span>
            </div>
            <pre className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-xs leading-relaxed text-zinc-300">
              {output}
            </pre>
          </footer>
        </div>

        {assistOpen ? (
          <>
            <button
              type="button"
              className="absolute inset-0 z-30 bg-black/55 md:hidden"
              onClick={() => setAssistOpen(false)}
              aria-label="Dismiss assistance"
            />
            <div className="absolute inset-y-0 right-0 z-40 flex h-full min-h-0 w-full max-w-md flex-col md:static md:z-0 md:h-full md:w-[min(28rem,42vw)] md:max-w-none">
              <EditorAssistChat
                code={code}
                languageId={monacoLang}
                onClose={() => setAssistOpen(false)}
                className="min-h-0 flex-1"
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
