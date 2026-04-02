import { useState } from 'react'
import Editor from '@monaco-editor/react'

type CodeWorkspaceProps = {
  initialCode: string
  language?: string
  className?: string
}

export function CodeWorkspace({
  initialCode,
  language = 'typescript',
  className = '',
}: CodeWorkspaceProps) {
  const [code, setCode] = useState(initialCode)
  const [activeTab, setActiveTab] = useState<'code' | 'testcase'>('code')

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
          Testcase
        </button>
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
          <div className="flex h-full items-center justify-center bg-zinc-950 px-4">
            <p className="max-w-sm text-center text-sm text-zinc-500">
              Test cases will plug in here when the compiler is wired up. For
              now, edit your solution in the <strong>Code</strong> tab.
            </p>
          </div>
        )}
      </div>

      <footer className="h-32 shrink-0 border-t border-zinc-800 bg-zinc-900/50">
        <div className="flex h-8 items-center border-b border-zinc-800 px-3 text-[0.7rem] font-semibold uppercase tracking-wide text-zinc-500">
          Console
        </div>
        <div className="p-3 font-mono text-xs text-zinc-500">
          <span className="text-zinc-600">// </span>
          Output will appear here after you run code.
        </div>
      </footer>
    </section>
  )
}
