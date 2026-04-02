import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { ChevronDown, Loader2, Play, Terminal } from 'lucide-react'

const DEFAULT_CODE = `// Online editor — start coding here.
// AI assistant and run will plug in later.

function greet(name: string): string {
  return \`Hello, \${name}!\`
}

console.log(greet('CodingPrep'))
`

type EditorLanguage = 'typescript' | 'javascript' | 'python'

const languageOptions: { id: EditorLanguage; label: string; monaco: string }[] =
  [
    { id: 'typescript', label: 'TypeScript', monaco: 'typescript' },
    { id: 'javascript', label: 'JavaScript', monaco: 'javascript' },
    { id: 'python', label: 'Python', monaco: 'python' },
  ]

function formatLogArg(arg: unknown): string {
  if (arg === undefined) return 'undefined'
  if (arg === null) return 'null'
  if (typeof arg === 'string') return arg
  if (
    typeof arg === 'number' ||
    typeof arg === 'boolean' ||
    typeof arg === 'bigint'
  ) {
    return String(arg)
  }
  if (arg instanceof Error) return arg.stack ?? arg.message
  try {
    return JSON.stringify(arg)
  } catch {
    return String(arg)
  }
}

/** Run plain JS in-page; capture console.log (educational — same-origin only). */
function runJavaScriptInBrowser(src: string): string {
  const lines: string[] = []
  const capture = {
    log: (...args: unknown[]) =>
      lines.push(args.map(formatLogArg).join(' ')),
    info: (...args: unknown[]) =>
      lines.push(args.map(formatLogArg).join(' ')),
    warn: (...args: unknown[]) =>
      lines.push('[warn] ' + args.map(formatLogArg).join(' ')),
    error: (...args: unknown[]) =>
      lines.push('[error] ' + args.map(formatLogArg).join(' ')),
  }
  try {
    const fn = new Function('console', '"use strict";\n' + src)
    fn(capture)
  } catch (e) {
    lines.push(e instanceof Error ? e.message : String(e))
  }
  return lines.length
    ? lines.join('\n')
    : '(no output — add console.log(...) to see results)'
}

export function EditorPage() {
  const [language, setLanguage] = useState<EditorLanguage>('typescript')
  const [code, setCode] = useState(DEFAULT_CODE)
  const [output, setOutput] = useState<string>(
    'Click Run to execute. JavaScript runs in the browser; TypeScript and Python need the sandbox API.',
  )
  const [isRunning, setIsRunning] = useState(false)

  const monacoLang =
    languageOptions.find((o) => o.id === language)?.monaco ?? 'typescript'

  const languageLabel =
    languageOptions.find((o) => o.id === language)?.label ?? 'TypeScript'

  const handleRun = useCallback(() => {
    setIsRunning(true)
    window.setTimeout(() => {
      const started = performance.now()
      let body = ''
      try {
        if (language === 'javascript') {
          body = runJavaScriptInBrowser(code)
        } else if (language === 'typescript') {
          body =
            `[${languageLabel}] In-browser run is not available for TypeScript yet.\n` +
            'Switch to JavaScript to try execution here, or use the sandbox API when it is connected.'
        } else {
          body =
            `[${languageLabel}] Python runs in the sandbox — connect the backend runner to execute here.`
        }
      } catch (e) {
        body = e instanceof Error ? e.message : String(e)
      }
      const ms = Math.round(performance.now() - started)
      const suffix =
        language === 'javascript'
          ? `\n\n— finished in ${ms} ms`
          : `\n\n— checked in ${ms} ms`
      setOutput(body + suffix)
      setIsRunning(false)
    }, 0)
  }, [code, language, languageLabel])

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            className="shrink-0 text-sm font-semibold tracking-tight text-zinc-100 transition hover:text-emerald-400"
          >
            CodingPrep
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
          <span className="hidden text-xs text-zinc-600 sm:inline">AI · soon</span>
        </nav>
      </header>

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
            onChange={(e) =>
              setLanguage(e.target.value as EditorLanguage)
            }
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
  )
}
