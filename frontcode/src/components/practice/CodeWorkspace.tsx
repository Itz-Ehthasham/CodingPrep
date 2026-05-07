import { useCallback, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Loader2, Play } from 'lucide-react'
import { compileCode, type CompileLanguage } from '@/services/api'

type CodeWorkspaceProps = {
  initialCode: string
  language?: string
  className?: string
}

function backendLanguage(monacoId: string): CompileLanguage | null {
  const id = monacoId.toLowerCase()
  if (id === 'java') return 'java'
  if (id === 'python') return 'python'
  if (id === 'javascript') return 'javascript'
  return null
}

export function CodeWorkspace({
  initialCode,
  language = 'javascript',
  className = '',
}: CodeWorkspaceProps) {
  const [code, setCode] = useState(initialCode)
  const [stdin, setStdin] = useState('')
  const [activeTab, setActiveTab] = useState<'code' | 'testcase'>('code')
  const [consoleText, setConsoleText] = useState<string>(
    '// Output appears here after you run.',
  )
  const [isRunning, setIsRunning] = useState(false)

  const runLang = useMemo(() => backendLanguage(language), [language])
  const canRun = runLang !== null

  const handleRun = useCallback(async () => {
    if (!runLang) {
      setConsoleText(
        '// Server run supports Java, Python, and JavaScript only. Change the Monaco language or editor mode.',
      )
      return
    }

    setIsRunning(true)
    try {
      const result = await compileCode({
        code,
        language: runLang,
        input: stdin,
      })
      const parts = [(result.output ?? '').replace(/\s+$/, '')]
      if (result.compileTime != null && result.compileTime !== '0.00') {
        parts.push(`\n// compile: ${result.compileTime} ms`)
      }
      if (result.executionTime != null) {
        parts.push(`\n// run: ${result.executionTime} ms`)
      }
      setConsoleText(parts.join(''))
    } catch (e) {
      setConsoleText(e instanceof Error ? e.message : String(e))
    } finally {
      setIsRunning(false)
    }
  }, [code, runLang, stdin])

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col bg-zinc-950 ${className}`}
    >
      <div
        className="flex h-10 shrink-0 items-end gap-0 border-b border-zinc-800 px-2"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'code'}
          onClick={() => setActiveTab('code')}
          className={`relative rounded-t-md px-3 py-2 text-xs font-medium transition ${
            activeTab === 'code'
              ? 'text-zinc-100 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-emerald-500'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Code
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'testcase'}
          onClick={() => setActiveTab('testcase')}
          className={`rounded-t-md px-3 py-2 text-xs font-medium transition ${
            activeTab === 'testcase'
              ? 'text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Custom input
        </button>
        <div className="ml-auto flex items-center pr-1">
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={isRunning || !canRun}
            title={
              canRun
                ? 'Run on server'
                : 'Switch editor language to JavaScript, Python, or Java'
            }
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[0.7rem] font-semibold text-zinc-950 shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Play className="size-3.5 shrink-0 fill-current" aria-hidden />
            )}
            Run
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {activeTab === 'code' ? (
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value ?? '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily:
                '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              padding: { top: 12, bottom: 12 },
              tabSize: 2,
              automaticLayout: true,
              wordWrap: 'on',
            }}
          />
        ) : (
          <div className="flex h-full flex-col bg-zinc-950 p-3">
            <label
              htmlFor="workspace-stdin"
              className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-zinc-500"
            >
              Stdin (fed to your program)
            </label>
            <textarea
              id="workspace-stdin"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Paste input lines here…"
              className="min-h-0 flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-emerald-600/40"
            />
          </div>
        )}
      </div>

      <footer className="h-32 shrink-0 border-t border-zinc-800 bg-zinc-900/50">
        <div className="flex h-8 items-center border-b border-zinc-800 px-3 text-[0.7rem] font-semibold uppercase tracking-wide text-zinc-500">
          Console
        </div>
        <pre className="max-h-[calc(100%-2rem)] overflow-y-auto whitespace-pre-wrap break-words p-3 font-mono text-xs text-zinc-300">
          {consoleText}
        </pre>
      </footer>
    </section>
  )
}
