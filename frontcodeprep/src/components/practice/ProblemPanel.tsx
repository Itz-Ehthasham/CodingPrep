import type { SampleProblem } from '@/data/sampleProblem'

type ProblemPanelProps = {
  problem: SampleProblem
  className?: string
}

function formatDescription(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-zinc-100">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export function ProblemPanel({ problem, className = '' }: ProblemPanelProps) {
  return (
    <aside
      className={`flex flex-col overflow-hidden border-zinc-800 bg-zinc-900/80 ${className}`}
    >
      <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">Description</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-none text-sm leading-relaxed text-zinc-300">
          <p className="whitespace-pre-line leading-relaxed">
            {formatDescription(problem.description)}
          </p>

          {problem.examples.map((ex, idx) => (
            <div key={idx} className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-zinc-200">
                Example {idx + 1}:
              </h3>
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm">
                <p>
                  <span className="font-medium text-zinc-400">Input: </span>
                  <code className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-emerald-300/95">
                    {ex.input}
                  </code>
                </p>
                <p>
                  <span className="font-medium text-zinc-400">Output: </span>
                  <code className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-sky-300/95">
                    {ex.output}
                  </code>
                </p>
                {ex.explanation ? (
                  <p className="text-zinc-400">
                    <span className="font-medium text-zinc-500">
                      Explanation:{' '}
                    </span>
                    {ex.explanation}
                  </p>
                ) : null}
              </div>
            </div>
          ))}

          <div className="mt-8">
            <h3 className="mb-2 text-sm font-semibold text-zinc-200">
              Constraints
            </h3>
            <ul className="list-inside list-disc space-y-1.5 text-sm text-zinc-400">
              {problem.constraints.map((c, i) => (
                <li key={i}>
                  <code className="text-zinc-300">{c}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </aside>
  )
}
